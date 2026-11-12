package com.flashcart.flashsale.service;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.UserRole;
import org.springframework.security.access.AccessDeniedException;
import com.flashcart.common.exception.FlashSaleException;
import com.flashcart.common.exception.InsufficientInventoryException;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.common.util.IdempotencyKeyUtils;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.config.FlashSaleStockCache;
import com.flashcart.config.RedisConfig;
import com.flashcart.flashsale.dto.*;
import com.flashcart.flashsale.entity.FlashSale;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.flashsale.repository.FlashSaleRepository;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.entity.InventoryReservation;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.inventory.service.InventoryService;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.order.dto.OrderDto;
import com.flashcart.order.entity.Order;
import com.flashcart.order.entity.OrderItem;
import com.flashcart.order.repository.OrderRepository;
import com.flashcart.order.service.OrderService;
import com.flashcart.product.entity.Product;
import com.flashcart.product.entity.ProductImage;
import com.flashcart.product.repository.ProductRepository;
import com.flashcart.user.entity.Address;
import com.flashcart.user.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class FlashSaleService {

    private final FlashSaleRepository flashSaleRepository;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryReservationRepository reservationRepository;
    private final OrderRepository orderRepository;
    private final AddressRepository addressRepository;
    private final InventoryService inventoryService;
    private final OrderService orderService;
    private final OutboxService outboxService;
    private final CacheInvalidationService cacheInvalidationService;
    private final FlashSaleStockCache flashSaleStockCache;

    @Cacheable(value = RedisConfig.CACHE_FLASH_SALES, key = "'activeAndUpcoming'")
    @Transactional(readOnly = true)
    public List<FlashSaleDto> getActiveAndUpcomingFlashSales() {
        return new ArrayList<>(flashSaleRepository.findActiveAndUpcomingFlashSales(Instant.now())
                .stream()
                .map(this::toDto)
                .toList());
    }

    @Cacheable(value = RedisConfig.CACHE_FLASH_SALES, key = "'live'")
    @Transactional(readOnly = true)
    public List<FlashSaleDto> getLiveFlashSales() {
        return new ArrayList<>(flashSaleRepository.findLiveFlashSales(Instant.now())
                .stream()
                .map(this::toDto)
                .toList());
    }

    @Transactional(readOnly = true)
    public List<FlashSaleDto> getAllFlashSalesForAdmin() {
        return flashSaleRepository.findAllWithItems()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public FlashSaleDto getFlashSaleById(UUID id) {
        FlashSale sale = flashSaleRepository.findByIdWithItems(id)
                .orElseThrow(() -> new ResourceNotFoundException("FlashSale", id.toString()));
        return toDto(sale);
    }

    @Transactional
    public FlashSaleDto createFlashSale(User admin, FlashSaleRequest request) {
        if (!request.getEndTime().isAfter(request.getStartTime())) {
            throw new InvalidOperationException("Flash sale endTime must be after startTime");
        }

        FlashSale flashSale = FlashSale.builder()
                .name(request.getName().trim())
                .description(request.getDescription())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .active(request.isActive())
                .createdBy(admin)
                .build();

        flashSale = flashSaleRepository.save(flashSale);

        if (request.getItems() != null) {
            for (FlashSaleItemRequest itemReq : request.getItems()) {
                FlashSaleItem item = addItemInternal(flashSale, itemReq);
                flashSale.getItems().add(item);
            }
        }

        cacheInvalidationService.evictFlashSaleCaches();
        return toDto(flashSale);
    }

    @Transactional
    public FlashSaleDto updateFlashSale(UUID id, FlashSaleRequest request) {
        if (!request.getEndTime().isAfter(request.getStartTime())) {
            throw new InvalidOperationException("Flash sale endTime must be after startTime");
        }

        FlashSale flashSale = flashSaleRepository.findByIdWithItems(id)
                .orElseThrow(() -> new ResourceNotFoundException("FlashSale", id.toString()));

        flashSale.setName(request.getName().trim());
        flashSale.setDescription(request.getDescription());
        flashSale.setStartTime(request.getStartTime());
        flashSale.setEndTime(request.getEndTime());
        flashSale.setActive(request.isActive());

        flashSale = flashSaleRepository.save(flashSale);

        UUID fsId = flashSale.getId();
        boolean active = flashSale.isActive();
        Instant endTime = flashSale.getEndTime();
        List<ItemStockSnapshot> snapshots = flashSale.getItems().stream()
                .map(item -> new ItemStockSnapshot(item.getProduct().getId(), item.getRemainingStock()))
                .toList();

        flashSaleStockCache.runAfterCommit(() -> {
            for (ItemStockSnapshot snap : snapshots) {
                if (active && endTime.isAfter(Instant.now())) {
                    flashSaleStockCache.warm(fsId, snap.productId(), snap.remainingStock(), endTime);
                } else {
                    flashSaleStockCache.evict(fsId, snap.productId());
                }
            }
            cacheInvalidationService.evictFlashSaleCaches();
        });

        return toDto(flashSale);
    }

    @Transactional
    public FlashSaleDto addOrUpdateItem(UUID flashSaleId, FlashSaleItemRequest itemReq) {
        FlashSale flashSale = flashSaleRepository.findByIdWithItems(flashSaleId)
                .orElseThrow(() -> new ResourceNotFoundException("FlashSale", flashSaleId.toString()));

        Optional<FlashSaleItem> existingOpt = flashSaleItemRepository
                .findByFlashSaleIdAndProductId(flashSaleId, itemReq.getProductId());

        if (existingOpt.isPresent()) {
            FlashSaleItem item = existingOpt.get();
            if (itemReq.getSaleStock() < item.getSoldCount()) {
                throw new InvalidOperationException("Sale stock cannot be less than already sold count (" + item.getSoldCount() + ")");
            }
            validateInventoryCoversSaleStock(itemReq.getProductId(), itemReq.getSaleStock());
            item.setSalePrice(itemReq.getSalePrice());
            item.setSaleStock(itemReq.getSaleStock());
            flashSaleItemRepository.save(item);
            warmRedisCounterAfterCommit(flashSaleId, itemReq.getProductId(), item.getRemainingStock(), flashSale.getEndTime());
        } else {
            FlashSaleItem created = addItemInternal(flashSale, itemReq);
            flashSale.getItems().add(created);
        }

        cacheInvalidationService.evictFlashSaleCaches();
        return toDto(flashSaleRepository.findByIdWithItems(flashSaleId).orElse(flashSale));
    }

    @Transactional
    public void deactivateFlashSale(UUID id) {
        FlashSale flashSale = flashSaleRepository.findByIdWithItems(id)
                .orElseThrow(() -> new ResourceNotFoundException("FlashSale", id.toString()));
        flashSale.setActive(false);
        flashSaleRepository.save(flashSale);

        List<UUID> productIds = flashSale.getItems().stream()
                .map(item -> item.getProduct().getId())
                .toList();
        flashSaleStockCache.runAfterCommit(() -> {
            for (UUID productId : productIds) {
                flashSaleStockCache.evict(id, productId);
            }
            cacheInvalidationService.evictFlashSaleCaches();
        });
    }

    /**
     * Concurrent-safe flash sale purchase:
     * 1. User-scoped idempotency key lookup (prevents cross-user IDOR)
     * 2. Atomic Lua Redis admission pre-filter (gracefully degrades to DB if key absent or Redis unavailable)
     * 3. Authoritative PostgreSQL SELECT FOR UPDATE in strict global lock order: Inventory -> FlashSaleItem
     */
    @Transactional
    public OrderDto purchaseFlashSaleItem(
            User user,
            UUID flashSaleId,
            FlashSalePurchaseRequest request,
            String headerIdempotencyKey) {

        if (user.getRole() == UserRole.ADMIN) {
            throw new AccessDeniedException("Administrators cannot purchase flash sale items");
        }

        String rawIdempotencyKey = IdempotencyKeyUtils.resolveRawKey(
                headerIdempotencyKey, request.getIdempotencyKey());
        String idempotencyKey = rawIdempotencyKey != null
                ? IdempotencyKeyUtils.scopeForUser(user.getId(), "fs:" + flashSaleId, rawIdempotencyKey)
                : "fs:" + user.getId() + ":" + flashSaleId + ":" + UUID.randomUUID();

        // 1. User-scoped idempotency check
        Optional<InventoryReservation> existingRes = reservationRepository.findByIdempotencyKey(idempotencyKey);
        if (existingRes.isPresent()) {
            InventoryReservation res = existingRes.get();
            if (res.getUser() != null && !res.getUser().getId().equals(user.getId())) {
                throw new UnauthorizedException("You do not have permission to access this reservation");
            }
            if (res.getOrderId() != null) {
                Order existingOrder = orderRepository.findByIdWithItems(res.getOrderId())
                        .orElseThrow(() -> new ResourceNotFoundException("Order", res.getOrderId().toString()));
                if (!existingOrder.getUser().getId().equals(user.getId())) {
                    throw new UnauthorizedException("You do not have permission to view this order");
                }
                return orderService.toDto(existingOrder);
            }
        }

        // 2. Atomic Lua Redis admission pre-filter
        FlashSaleStockCache.AdmissionResult admission = flashSaleStockCache.tryDecrementIfAvailable(
                flashSaleId, request.getProductId(), request.getQuantity());
        if (admission == FlashSaleStockCache.AdmissionResult.SOLD_OUT) {
            throw new FlashSaleException("Flash sale item is sold out");
        }

        boolean redisDecremented = (admission == FlashSaleStockCache.AdmissionResult.RESERVED);
        if (redisDecremented && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        flashSaleStockCache.incrementIfPresent(
                                flashSaleId, request.getProductId(), request.getQuantity());
                    }
                }
            });
        }

        try {
            // 3. Authoritative PostgreSQL locking in strict hierarchy: Inventory -> FlashSaleItem
            Inventory lockedInventory = inventoryService.lockInventoryByProductId(request.getProductId());

            FlashSaleItem saleItem = flashSaleItemRepository
                    .findByFlashSaleIdAndProductIdForUpdate(flashSaleId, request.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("FlashSaleItem for product", request.getProductId().toString()));

            FlashSale flashSale = saleItem.getFlashSale();
            if (!flashSale.isLive()) {
                throw new FlashSaleException("Flash sale is not currently active");
            }

            if (saleItem.getSoldCount() + request.getQuantity() > saleItem.getSaleStock()) {
                throw new FlashSaleException("Insufficient flash sale stock. Remaining: " + saleItem.getRemainingStock());
            }

            Product product = saleItem.getProduct();
            if (!product.isActive()) {
                throw new InvalidOperationException("Product is no longer active");
            }

            if (lockedInventory.getAvailableStock() < request.getQuantity()) {
                throw new InsufficientInventoryException(
                        "Insufficient stock for product: " + product.getId()
                                + ". Available: " + lockedInventory.getAvailableStock()
                                + ", Requested: " + request.getQuantity());
            }

            saleItem.setSoldCount(saleItem.getSoldCount() + request.getQuantity());
            flashSaleItemRepository.save(saleItem);

            OrderService.ShippingInfo shipping = resolveFlashSaleShipping(user, request);

            BigDecimal regularTotal = product.getPrice().multiply(BigDecimal.valueOf(request.getQuantity()));
            BigDecimal saleTotal = saleItem.getSalePrice().multiply(BigDecimal.valueOf(request.getQuantity()));
            BigDecimal discount = regularTotal.subtract(saleTotal).max(BigDecimal.ZERO);

            Order order = Order.builder()
                    .orderNumber(orderService.generateOrderNumber())
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
                    .subtotal(regularTotal)
                    .discountAmount(discount)
                    .totalAmount(saleTotal)
                    .notes("Flash Sale: " + flashSale.getName())
                    .build();

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .productId(product.getId())
                    .productName(product.getName())
                    .productSku(product.getSku())
                    .unitPrice(saleItem.getSalePrice())
                    .quantity(request.getQuantity())
                    .totalPrice(saleTotal)
                    .flashSaleId(flashSale.getId())
                    .build();

            order.setItems(List.of(orderItem));
            order = orderRepository.save(order);

            // Reserve against already-locked inventory
            inventoryService.reserveLockedInventory(
                    lockedInventory,
                    user,
                    order.getId(),
                    saleItem.getId(),
                    request.getQuantity(),
                    idempotencyKey
            );

            outboxService.recordEvent(
                    "Order",
                    order.getId().toString(),
                    "OrderCreated",
                    Map.of(
                            "orderId", order.getId().toString(),
                            "orderNumber", order.getOrderNumber(),
                            "userId", user.getId().toString(),
                            "flashSaleId", flashSale.getId().toString(),
                            "totalAmount", order.getTotalAmount().toString()
                    )
            );

            flashSaleStockCache.runAfterCommit(cacheInvalidationService::evictFlashSaleCaches);
            return orderService.toDto(order);
        } catch (RuntimeException ex) {
            if (redisDecremented && !TransactionSynchronizationManager.isSynchronizationActive()) {
                flashSaleStockCache.incrementIfPresent(flashSaleId, request.getProductId(), request.getQuantity());
            }
            throw ex;
        }
    }

    private FlashSaleItem addItemInternal(FlashSale flashSale, FlashSaleItemRequest itemReq) {
        Product product = productRepository.findById(itemReq.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString()));
        validateInventoryCoversSaleStock(product.getId(), itemReq.getSaleStock());

        FlashSaleItem item = FlashSaleItem.builder()
                .flashSale(flashSale)
                .product(product)
                .salePrice(itemReq.getSalePrice())
                .saleStock(itemReq.getSaleStock())
                .soldCount(0)
                .build();
        item = flashSaleItemRepository.save(item);
        warmRedisCounterAfterCommit(flashSale.getId(), product.getId(), item.getRemainingStock(), flashSale.getEndTime());
        return item;
    }

    private void validateInventoryCoversSaleStock(UUID productId, int saleStock) {
        Inventory inv = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory for product", productId.toString()));
        if (saleStock > inv.getAvailableStock()) {
            throw new InvalidOperationException(
                    "Flash sale stock (" + saleStock + ") cannot exceed available inventory (" + inv.getAvailableStock() + ")");
        }
    }

    private void warmRedisCounterAfterCommit(UUID flashSaleId, UUID productId, int remainingStock, Instant endTime) {
        flashSaleStockCache.runAfterCommit(() -> flashSaleStockCache.warm(flashSaleId, productId, remainingStock, endTime));
    }

    private OrderService.ShippingInfo resolveFlashSaleShipping(User user, FlashSalePurchaseRequest request) {
        if (request.getAddressId() != null) {
            Address addr = addressRepository.findByIdAndUserId(request.getAddressId(), user.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Address", request.getAddressId().toString()));
            return new OrderService.ShippingInfo(
                    addr.getFullName(), addr.getAddressLine1(), addr.getAddressLine2(),
                    addr.getCity(), addr.getState(), addr.getPostalCode(),
                    addr.getCountry(), addr.getPhone());
        }

        if (request.getShippingAddressLine1() != null && !request.getShippingAddressLine1().isBlank()) {
            return new OrderService.ShippingInfo(
                    request.getShippingFullName() != null ? request.getShippingFullName() : user.getFirstName(),
                    request.getShippingAddressLine1(),
                    request.getShippingAddressLine2(),
                    request.getShippingCity() != null ? request.getShippingCity() : "Bengaluru",
                    request.getShippingState() != null ? request.getShippingState() : "Karnataka",
                    request.getShippingPostalCode() != null ? request.getShippingPostalCode() : "560001",
                    request.getShippingCountry() != null ? request.getShippingCountry() : "India",
                    request.getShippingPhone() != null ? request.getShippingPhone() : user.getPhone()
            );
        }

        List<Address> addresses = addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
        if (!addresses.isEmpty()) {
            Address addr = addresses.get(0);
            return new OrderService.ShippingInfo(
                    addr.getFullName(), addr.getAddressLine1(), addr.getAddressLine2(),
                    addr.getCity(), addr.getState(), addr.getPostalCode(),
                    addr.getCountry(), addr.getPhone());
        }

        return new OrderService.ShippingInfo(
                user.getFirstName() + (user.getLastName() != null ? " " + user.getLastName() : ""),
                "Express Flash Checkout",
                null,
                "Bengaluru",
                "Karnataka",
                "560001",
                "India",
                user.getPhone()
        );
    }

    public FlashSaleDto toDto(FlashSale fs) {
        List<FlashSaleItemDto> items = fs.getItems() != null
                ? new ArrayList<>(fs.getItems().stream().map(this::toItemDto).toList())
                : new ArrayList<>();

        return FlashSaleDto.builder()
                .id(fs.getId())
                .name(fs.getName())
                .description(fs.getDescription())
                .startTime(fs.getStartTime())
                .endTime(fs.getEndTime())
                .active(fs.isActive())
                .live(fs.isLive())
                .items(items)
                .createdAt(fs.getCreatedAt())
                .build();
    }

    private FlashSaleItemDto toItemDto(FlashSaleItem item) {
        Product p = item.getProduct();
        String imageUrl = p.getImages() != null && !p.getImages().isEmpty()
                ? p.getImages().stream()
                        .filter(ProductImage::isPrimary)
                        .findFirst()
                        .orElse(p.getImages().get(0))
                        .getImageUrl()
                : null;

        return FlashSaleItemDto.builder()
                .id(item.getId())
                .flashSaleId(item.getFlashSale().getId())
                .productId(p.getId())
                .productName(p.getName())
                .productSku(p.getSku())
                .imageUrl(imageUrl)
                .regularPrice(p.getPrice())
                .salePrice(item.getSalePrice())
                .saleStock(item.getSaleStock())
                .soldCount(item.getSoldCount())
                .remainingStock(item.getRemainingStock())
                .build();
    }

    private record ItemStockSnapshot(UUID productId, int remainingStock) {}
}
