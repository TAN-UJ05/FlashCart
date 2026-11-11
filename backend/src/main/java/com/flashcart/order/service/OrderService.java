package com.flashcart.order.service;

import com.flashcart.auth.entity.User;
import com.flashcart.cart.entity.Cart;
import com.flashcart.cart.entity.CartItem;
import com.flashcart.cart.repository.CartRepository;
import com.flashcart.common.enums.NotificationType;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.ReservationStatus;
import com.flashcart.common.exception.InsufficientInventoryException;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.common.response.PageResponse;
import com.flashcart.common.util.IdempotencyKeyUtils;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.config.FlashSaleStockCache;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.entity.InventoryReservation;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.inventory.service.InventoryService;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.notification.service.NotificationService;
import com.flashcart.order.dto.*;
import com.flashcart.order.entity.Order;
import com.flashcart.order.entity.OrderItem;
import com.flashcart.order.repository.OrderRepository;
import com.flashcart.product.entity.Product;
import com.flashcart.user.entity.Address;
import com.flashcart.user.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final CartRepository cartRepository;
    private final AddressRepository addressRepository;
    private final InventoryRepository inventoryRepository;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final InventoryReservationRepository reservationRepository;
    private final InventoryService inventoryService;
    private final OutboxService outboxService;
    private final NotificationService notificationService;
    private final FlashSaleStockCache flashSaleStockCache;
    private final CacheInvalidationService cacheInvalidationService;

    @Transactional
    public OrderDto checkout(User user, CheckoutRequest request, String headerIdempotencyKey) {
        String rawIdempotencyKey = IdempotencyKeyUtils.resolveRawKey(
                headerIdempotencyKey, request != null ? request.getIdempotencyKey() : null);
        String scopedBaseKey = IdempotencyKeyUtils.scopeForUser(user.getId(), "chk", rawIdempotencyKey);

        if (scopedBaseKey != null) {
            Optional<InventoryReservation> existingRes = reservationRepository
                    .findFirstByIdempotencyKeyStartingWith(scopedBaseKey + ":");
            if (existingRes.isPresent()) {
                InventoryReservation res = existingRes.get();
                if (res.getUser() != null && !res.getUser().getId().equals(user.getId())) {
                    throw new UnauthorizedException("You do not have permission to access this checkout reservation");
                }
                if (res.getOrderId() != null) {
                    Order existingOrder = orderRepository.findByIdWithItems(res.getOrderId())
                            .orElseThrow(() -> new ResourceNotFoundException("Order", res.getOrderId().toString()));
                    if (!existingOrder.getUser().getId().equals(user.getId())) {
                        throw new UnauthorizedException("You do not have permission to view this order");
                    }
                    return toDto(existingOrder);
                }
            }
        }

        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> new InvalidOperationException("Cart is empty"));

        if (cart.getItems().isEmpty()) {
            throw new InvalidOperationException("Cart is empty");
        }

        ShippingInfo shipping = resolveShippingInfo(user, request);

        // Determine inventory IDs non-lockingly so we lock all Inventory rows in canonical ascending inventory.id order
        List<UUID> productIds = cart.getItems().stream()
                .map(ci -> ci.getProduct().getId())
                .toList();
        Map<UUID, UUID> productToInventoryId = inventoryRepository.findByProductIdIn(productIds).stream()
                .collect(Collectors.toMap(inv -> inv.getProduct().getId(), Inventory::getId));

        List<CartItem> sortedItems = cart.getItems().stream()
                .sorted(Comparator.comparing(
                        (CartItem ci) -> productToInventoryId.getOrDefault(ci.getProduct().getId(), ci.getProduct().getId())))
                .toList();

        // Pass 1: Lock ALL Inventory rows first (ascending inventory.id order) -> matches InventoryService lock order
        Map<UUID, Inventory> lockedInventories = new LinkedHashMap<>();
        for (CartItem cartItem : sortedItems) {
            Product product = cartItem.getProduct();
            if (!product.isActive()) {
                throw new InvalidOperationException("Product '" + product.getName() + "' is no longer active");
            }
            Inventory lockedInventory = inventoryService.lockInventoryByProductId(product.getId());
            if (lockedInventory.getAvailableStock() < cartItem.getQuantity()) {
                throw new InsufficientInventoryException(
                        "Insufficient stock for product: " + product.getId()
                                + ". Available: " + lockedInventory.getAvailableStock()
                                + ", Requested: " + cartItem.getQuantity());
            }
            lockedInventories.put(product.getId(), lockedInventory);
        }

        // Pass 2: Look up live FlashSaleItems, then lock them in ascending flashSaleItem.id order AFTER all Inventory locks
        Instant now = Instant.now();
        Map<UUID, UUID> productToCandidateSaleItemId = new HashMap<>();
        for (CartItem cartItem : sortedItems) {
            flashSaleItemRepository.findLiveByProductId(cartItem.getProduct().getId(), now)
                    .ifPresent(fsItem -> productToCandidateSaleItemId.put(cartItem.getProduct().getId(), fsItem.getId()));
        }

        Map<UUID, FlashSaleItem> lockedFlashSaleItemsById = new HashMap<>();
        productToCandidateSaleItemId.values().stream()
                .distinct()
                .sorted()
                .forEach(fsItemId -> flashSaleItemRepository.findByIdForUpdate(fsItemId)
                        .ifPresent(locked -> lockedFlashSaleItemsById.put(fsItemId, locked)));

        Order order = Order.builder()
                .orderNumber(generateOrderNumber())
                .user(user)
                .status(OrderStatus.PENDING)
                .shippingFullName(shipping.fullName())
                .shippingAddressLine1(shipping.line1())
                .shippingAddressLine2(shipping.line2())
                .shippingCity(shipping.city())
                .shippingState(shipping.state())
                .shippingPostalCode(shipping.postalCode())
                .shippingCountry(shipping.country())
                .shippingPhone(shipping.phone())
                .subtotal(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(BigDecimal.ZERO)
                .notes(request != null ? request.getNotes() : null)
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal discountTotal = BigDecimal.ZERO;
        List<OrderItem> orderItems = new ArrayList<>();
        Map<UUID, UUID> productToFlashSaleItemId = new HashMap<>();
        List<FlashSaleConsumption> flashSaleConsumptions = new ArrayList<>();

        for (CartItem cartItem : sortedItems) {
            Product product = cartItem.getProduct();
            BigDecimal regularPrice = product.getPrice();
            BigDecimal effectivePrice = regularPrice;
            UUID flashSaleId = null;
            UUID flashSaleItemId = null;

            UUID candidateFsItemId = productToCandidateSaleItemId.get(product.getId());
            if (candidateFsItemId != null) {
                FlashSaleItem lockedSaleItem = lockedFlashSaleItemsById.get(candidateFsItemId);
                if (lockedSaleItem != null && lockedSaleItem.getFlashSale().isLive()
                        && lockedSaleItem.getRemainingStock() >= cartItem.getQuantity()) {
                    lockedSaleItem.setSoldCount(lockedSaleItem.getSoldCount() + cartItem.getQuantity());
                    flashSaleItemRepository.save(lockedSaleItem);
                    effectivePrice = lockedSaleItem.getSalePrice();
                    flashSaleId = lockedSaleItem.getFlashSale().getId();
                    flashSaleItemId = lockedSaleItem.getId();
                    flashSaleConsumptions.add(new FlashSaleConsumption(
                            flashSaleId, product.getId(), cartItem.getQuantity()));
                }
            }

            BigDecimal qty = BigDecimal.valueOf(cartItem.getQuantity());
            BigDecimal lineRegular = regularPrice.multiply(qty);
            BigDecimal lineTotal = effectivePrice.multiply(qty);
            BigDecimal lineDiscount = lineRegular.subtract(lineTotal).max(BigDecimal.ZERO);

            subtotal = subtotal.add(lineRegular);
            discountTotal = discountTotal.add(lineDiscount);

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .productId(product.getId())
                    .productName(product.getName())
                    .productSku(product.getSku())
                    .unitPrice(effectivePrice)
                    .quantity(cartItem.getQuantity())
                    .totalPrice(lineTotal)
                    .flashSaleId(flashSaleId)
                    .build();
            orderItems.add(orderItem);

            if (flashSaleItemId != null) {
                productToFlashSaleItemId.put(product.getId(), flashSaleItemId);
            }
        }

        order.setSubtotal(subtotal);
        order.setDiscountAmount(discountTotal);
        order.setTotalAmount(subtotal.subtract(discountTotal).max(BigDecimal.ZERO));
        order.setItems(orderItems);
        order = orderRepository.save(order);

        String baseKey = scopedBaseKey != null ? scopedBaseKey : user.getId() + ":chk:" + order.getId();
        for (CartItem cartItem : sortedItems) {
            UUID productId = cartItem.getProduct().getId();
            String resKey = baseKey + ":" + productId;
            inventoryService.reserveLockedInventory(
                    lockedInventories.get(productId),
                    user,
                    order.getId(),
                    productToFlashSaleItemId.get(productId),
                    cartItem.getQuantity(),
                    resKey
            );
        }

        cart.getItems().clear();
        cartRepository.save(cart);

        outboxService.recordEvent(
                "Order",
                order.getId().toString(),
                "OrderCreated",
                Map.of(
                        "orderId", order.getId().toString(),
                        "orderNumber", order.getOrderNumber(),
                        "userId", user.getId().toString(),
                        "totalAmount", order.getTotalAmount().toString(),
                        "itemCount", orderItems.size()
                )
        );

        if (!flashSaleConsumptions.isEmpty() && flashSaleStockCache != null) {
            flashSaleStockCache.runAfterCommit(() -> {
                for (FlashSaleConsumption consumption : flashSaleConsumptions) {
                    flashSaleStockCache.decrementIfPresent(
                            consumption.flashSaleId(), consumption.productId(), consumption.quantity());
                }
                cacheInvalidationService.evictFlashSaleCaches();
            });
        }

        return toDto(order);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderDto> getUserOrders(UUID userId, Pageable pageable) {
        Page<OrderDto> page = orderRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toDto);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public OrderDto getOrderById(User user, UUID orderId, boolean isAdmin) {
        Order order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId.toString()));
        if (!isAdmin && !order.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have permission to view this order");
        }
        return toDto(order);
    }

    @Transactional
    public OrderDto cancelOrder(User user, UUID orderId, boolean isAdmin) {
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId.toString()));
        if (!isAdmin && !order.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have permission to cancel this order");
        }

        if (order.getStatus() == OrderStatus.CANCELLED) {
            return toDto(order);
        }

        if (order.getStatus() == OrderStatus.PENDING
                || order.getStatus() == OrderStatus.PAYMENT_PENDING
                || order.getStatus() == OrderStatus.PAYMENT_FAILED) {
            inventoryService.releaseOrderReservations(orderId, ReservationStatus.RELEASED);
            order.setStatus(OrderStatus.CANCELLED);
            return toDto(orderRepository.save(order));
        }

        if (isAdmin && (order.getStatus() == OrderStatus.CONFIRMED || order.getStatus() == OrderStatus.PROCESSING)) {
            inventoryService.restoreConfirmedOrderStock(orderId);
            order.setStatus(OrderStatus.CANCELLED);
            return toDto(orderRepository.save(order));
        }

        throw new InvalidOperationException("Order in status " + order.getStatus() + " cannot be cancelled");
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderDto> listAllOrders(OrderStatus status, Pageable pageable) {
        Page<Order> page = status != null
                ? orderRepository.findByStatusOrderByCreatedAtDesc(status, pageable)
                : orderRepository.findAllByOrderByCreatedAtDesc(pageable);
        return PageResponse.from(page.map(this::toDto));
    }

    @Transactional
    public OrderDto updateOrderStatus(UUID orderId, OrderStatus targetStatus) {
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId.toString()));

        OrderStatus current = order.getStatus();
        if (current == targetStatus) {
            return toDto(order);
        }

        validateAdminTransition(current, targetStatus);

        if ((targetStatus == OrderStatus.CANCELLED || targetStatus == OrderStatus.REFUNDED)
                && (current == OrderStatus.CONFIRMED || current == OrderStatus.PROCESSING)) {
            inventoryService.restoreConfirmedOrderStock(orderId);
        } else if (targetStatus == OrderStatus.CANCELLED
                && (current == OrderStatus.PENDING || current == OrderStatus.PAYMENT_PENDING || current == OrderStatus.PAYMENT_FAILED)) {
            inventoryService.releaseOrderReservations(orderId, ReservationStatus.RELEASED);
        }

        order.setStatus(targetStatus);
        order = orderRepository.save(order);

        if (targetStatus == OrderStatus.SHIPPED) {
            notificationService.queueNotification(
                    order.getUser(),
                    NotificationType.ORDER_SHIPPED,
                    "Your FlashCart order " + order.getOrderNumber() + " has shipped!",
                    "Great news! Order " + order.getOrderNumber() + " is on its way."
            );
        }

        return toDto(order);
    }

    private void validateAdminTransition(OrderStatus current, OrderStatus target) {
        boolean valid = switch (current) {
            case PENDING, PAYMENT_PENDING, PAYMENT_FAILED -> target == OrderStatus.CANCELLED;
            case CONFIRMED -> target == OrderStatus.PROCESSING || target == OrderStatus.SHIPPED
                    || target == OrderStatus.CANCELLED || target == OrderStatus.REFUNDED;
            case PROCESSING -> target == OrderStatus.SHIPPED || target == OrderStatus.CANCELLED
                    || target == OrderStatus.REFUNDED;
            case SHIPPED -> target == OrderStatus.DELIVERED;
            case DELIVERED -> target == OrderStatus.REFUNDED;
            case CANCELLED, REFUNDED -> false;
        };

        if (!valid) {
            throw new InvalidOperationException("Invalid order status transition from " + current + " to " + target);
        }
    }

    public ShippingInfo resolveShippingInfo(User user, CheckoutRequest request) {
        if (request != null && request.getAddressId() != null) {
            Address addr = addressRepository.findByIdAndUserId(request.getAddressId(), user.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Address", request.getAddressId().toString()));
            return new ShippingInfo(
                    addr.getFullName(), addr.getAddressLine1(), addr.getAddressLine2(),
                    addr.getCity(), addr.getState(), addr.getPostalCode(),
                    addr.getCountry(), addr.getPhone());
        }

        if (request == null || isBlank(request.getShippingFullName()) || isBlank(request.getShippingAddressLine1())
                || isBlank(request.getShippingCity()) || isBlank(request.getShippingState())
                || isBlank(request.getShippingPostalCode())) {
            throw new InvalidOperationException("Shipping address or addressId is required for checkout");
        }

        return new ShippingInfo(
                request.getShippingFullName().trim(),
                request.getShippingAddressLine1().trim(),
                request.getShippingAddressLine2(),
                request.getShippingCity().trim(),
                request.getShippingState().trim(),
                request.getShippingPostalCode().trim(),
                isBlank(request.getShippingCountry()) ? "India" : request.getShippingCountry().trim(),
                request.getShippingPhone()
        );
    }

    private boolean isBlank(String val) {
        return val == null || val.isBlank();
    }

    public String generateOrderNumber() {
        String datePart = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String randomPart = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "FC-" + datePart + "-" + randomPart;
    }

    public OrderDto toDto(Order order) {
        List<OrderItemDto> items = order.getItems().stream()
                .map(oi -> OrderItemDto.builder()
                        .id(oi.getId())
                        .productId(oi.getProductId())
                        .productName(oi.getProductName())
                        .productSku(oi.getProductSku())
                        .unitPrice(oi.getUnitPrice())
                        .quantity(oi.getQuantity())
                        .totalPrice(oi.getTotalPrice())
                        .flashSaleId(oi.getFlashSaleId())
                        .build())
                .toList();

        return OrderDto.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .userId(order.getUser().getId())
                .customerEmail(order.getUser().getEmail())
                .status(order.getStatus())
                .shippingFullName(order.getShippingFullName())
                .shippingAddressLine1(order.getShippingAddressLine1())
                .shippingAddressLine2(order.getShippingAddressLine2())
                .shippingCity(order.getShippingCity())
                .shippingState(order.getShippingState())
                .shippingPostalCode(order.getShippingPostalCode())
                .shippingCountry(order.getShippingCountry())
                .shippingPhone(order.getShippingPhone())
                .subtotal(order.getSubtotal())
                .discountAmount(order.getDiscountAmount())
                .totalAmount(order.getTotalAmount())
                .notes(order.getNotes())
                .items(items)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    private record FlashSaleConsumption(UUID flashSaleId, UUID productId, int quantity) {}

    public record ShippingInfo(
            String fullName,
            String line1,
            String line2,
            String city,
            String state,
            String postalCode,
            String country,
            String phone
    ) {}
}
