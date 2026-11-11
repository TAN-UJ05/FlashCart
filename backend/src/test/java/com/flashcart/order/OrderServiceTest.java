package com.flashcart.order;

import com.flashcart.auth.entity.User;
import com.flashcart.cart.entity.Cart;
import com.flashcart.cart.entity.CartItem;
import com.flashcart.cart.repository.CartRepository;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.UserRole;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.config.FlashSaleStockCache;
import com.flashcart.flashsale.entity.FlashSale;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.entity.InventoryReservation;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.inventory.service.InventoryService;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.notification.service.NotificationService;
import com.flashcart.order.dto.CheckoutRequest;
import com.flashcart.order.dto.OrderDto;
import com.flashcart.order.entity.Order;
import com.flashcart.order.repository.OrderRepository;
import com.flashcart.order.service.OrderService;
import com.flashcart.product.entity.Product;
import com.flashcart.user.repository.AddressRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private CartRepository cartRepository;
    @Mock private AddressRepository addressRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private FlashSaleItemRepository flashSaleItemRepository;
    @Mock private InventoryReservationRepository reservationRepository;
    @Mock private InventoryService inventoryService;
    @Mock private OutboxService outboxService;
    @Mock private NotificationService notificationService;
    @Mock private FlashSaleStockCache flashSaleStockCache;
    @Mock private CacheInvalidationService cacheInvalidationService;

    @InjectMocks
    private OrderService orderService;

    @Test
    void getOrderById_differentCustomer_throwsUnauthorizedException() {
        User owner = User.builder().id(UUID.randomUUID()).email("owner@flashcart.com").role(UserRole.CUSTOMER).build();
        User attacker = User.builder().id(UUID.randomUUID()).email("other@flashcart.com").role(UserRole.CUSTOMER).build();
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("FC-1")
                .user(owner)
                .status(OrderStatus.PENDING)
                .subtotal(BigDecimal.TEN)
                .totalAmount(BigDecimal.TEN)
                .items(new ArrayList<>())
                .build();

        when(orderRepository.findByIdWithItems(order.getId())).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.getOrderById(attacker, order.getId(), false))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void checkout_idempotencyKeyOwnershipMismatch_throwsUnauthorized() {
        User attacker = User.builder().id(UUID.randomUUID()).email("attacker@flashcart.com").role(UserRole.CUSTOMER).build();
        User victim = User.builder().id(UUID.randomUUID()).email("victim@flashcart.com").role(UserRole.CUSTOMER).build();
        InventoryReservation victimReservation = InventoryReservation.builder()
                .id(UUID.randomUUID())
                .user(victim)
                .orderId(UUID.randomUUID())
                .build();

        String expectedScopedPrefix = attacker.getId() + ":chk:shared-key:";
        when(reservationRepository.findFirstByIdempotencyKeyStartingWith(expectedScopedPrefix))
                .thenReturn(Optional.of(victimReservation));

        CheckoutRequest req = CheckoutRequest.builder()
                .shippingFullName("Attacker")
                .shippingAddressLine1("123 Street")
                .shippingCity("Mumbai")
                .shippingState("MH")
                .shippingPostalCode("400001")
                .build();

        assertThatThrownBy(() -> orderService.checkout(attacker, req, "shared-key"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void checkout_withLiveFlashSaleItem_locksInventoryBeforeFlashSaleItem() {
        User buyer = User.builder().id(UUID.randomUUID()).email("buyer@flashcart.com").role(UserRole.CUSTOMER).build();
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .name("Laptop")
                .sku("LAP-1")
                .price(new BigDecimal("1000.00"))
                .active(true)
                .build();
        Inventory inventory = Inventory.builder()
                .id(UUID.randomUUID())
                .product(product)
                .totalStock(20)
                .reservedStock(0)
                .build();
        FlashSale sale = FlashSale.builder()
                .id(UUID.randomUUID())
                .name("Flash Sale")
                .startTime(Instant.now().minus(1, ChronoUnit.HOURS))
                .endTime(Instant.now().plus(1, ChronoUnit.HOURS))
                .active(true)
                .build();
        FlashSaleItem saleItem = FlashSaleItem.builder()
                .id(UUID.randomUUID())
                .flashSale(sale)
                .product(product)
                .salePrice(new BigDecimal("700.00"))
                .saleStock(10)
                .soldCount(0)
                .build();

        Cart cart = Cart.builder().id(UUID.randomUUID()).user(buyer).items(new ArrayList<>()).build();
        CartItem cartItem = CartItem.builder().id(UUID.randomUUID()).cart(cart).product(product).quantity(1).build();
        cart.getItems().add(cartItem);

        when(cartRepository.findByUserIdWithItems(buyer.getId())).thenReturn(Optional.of(cart));
        when(inventoryRepository.findByProductIdIn(List.of(product.getId()))).thenReturn(List.of(inventory));
        when(inventoryService.lockInventoryByProductId(product.getId())).thenReturn(inventory);
        when(flashSaleItemRepository.findLiveByProductId(eq(product.getId()), any(Instant.class)))
                .thenReturn(Optional.of(saleItem));
        when(flashSaleItemRepository.findByIdForUpdate(saleItem.getId())).thenReturn(Optional.of(saleItem));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(UUID.randomUUID());
            return o;
        });

        CheckoutRequest req = CheckoutRequest.builder()
                .shippingFullName("Buyer")
                .shippingAddressLine1("123 Main")
                .shippingCity("Bengaluru")
                .shippingState("KA")
                .shippingPostalCode("560001")
                .build();

        OrderDto result = orderService.checkout(buyer, req, null);
        assertThat(result.getTotalAmount()).isEqualByComparingTo("700.00");

        InOrder orderCheck = inOrder(inventoryService, flashSaleItemRepository);
        orderCheck.verify(inventoryService).lockInventoryByProductId(product.getId());
        orderCheck.verify(flashSaleItemRepository).findByIdForUpdate(saleItem.getId());
        assertThat(cart.getItems()).isEmpty();
    }

    @Test
    void updateOrderStatus_validTransition_succeeds() {
        User owner = User.builder().id(UUID.randomUUID()).email("owner@flashcart.com").role(UserRole.CUSTOMER).build();
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("FC-1")
                .user(owner)
                .status(OrderStatus.CONFIRMED)
                .subtotal(BigDecimal.TEN)
                .totalAmount(BigDecimal.TEN)
                .items(new ArrayList<>())
                .build();

        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        OrderDto result = orderService.updateOrderStatus(order.getId(), OrderStatus.PROCESSING);
        assertThat(result.getStatus()).isEqualTo(OrderStatus.PROCESSING);
    }

    @Test
    void updateOrderStatus_invalidTransition_throwsInvalidOperation() {
        User owner = User.builder().id(UUID.randomUUID()).email("owner@flashcart.com").role(UserRole.CUSTOMER).build();
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("FC-1")
                .user(owner)
                .status(OrderStatus.CANCELLED)
                .subtotal(BigDecimal.TEN)
                .totalAmount(BigDecimal.TEN)
                .items(new ArrayList<>())
                .build();

        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.updateOrderStatus(order.getId(), OrderStatus.SHIPPED))
                .isInstanceOf(InvalidOperationException.class);
    }
}
