package com.flashcart.integration;

import com.flashcart.auth.dto.RegisterRequest;
import com.flashcart.auth.entity.User;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.auth.service.AuthService;
import com.flashcart.cart.dto.AddToCartRequest;
import com.flashcart.cart.service.CartService;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.PaymentStatus;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.entity.InventoryReservation;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.order.dto.CheckoutRequest;
import com.flashcart.order.dto.OrderDto;
import com.flashcart.order.service.OrderService;
import com.flashcart.payment.dto.PaymentCallbackRequest;
import com.flashcart.payment.dto.PaymentDto;
import com.flashcart.payment.dto.PaymentInitiateRequest;
import com.flashcart.payment.service.PaymentService;
import com.flashcart.product.dto.ProductDto;
import com.flashcart.product.dto.ProductRequest;
import com.flashcart.product.service.ProductService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class OrderPaymentIntegrationTest extends AbstractIntegrationTest {

    @Autowired private AuthService authService;
    @Autowired private UserRepository userRepository;
    @Autowired private ProductService productService;
    @Autowired private CartService cartService;
    @Autowired private OrderService orderService;
    @Autowired private PaymentService paymentService;
    @Autowired private InventoryRepository inventoryRepository;
    @Autowired private InventoryReservationRepository reservationRepository;

    @Test
    void checkoutAndPaymentFlow_idempotencyAndStockInvariant() {
        String email = "buyer-" + UUID.randomUUID() + "@flashcart.com";
        authService.register(RegisterRequest.builder()
                .email(email).password("Pass@12345").firstName("Buyer").build());
        User buyer = userRepository.findByEmail(email).orElseThrow();

        ProductDto product = productService.createProduct(ProductRequest.builder()
                .name("Mechanical Keyboard")
                .sku("SKU-KB-" + UUID.randomUUID().toString().substring(0, 8))
                .price(new BigDecimal("149.99"))
                .initialStock(10)
                .active(true)
                .build());

        cartService.addItem(buyer.getId(), AddToCartRequest.builder()
                .productId(product.getId()).quantity(3).build());

        CheckoutRequest checkoutReq = CheckoutRequest.builder()
                .shippingFullName("Buyer One")
                .shippingAddressLine1("123 Main St")
                .shippingCity("Bengaluru")
                .shippingState("KA")
                .shippingPostalCode("560001")
                .shippingCountry("India")
                .build();

        OrderDto order = orderService.checkout(buyer, checkoutReq, "chk-" + UUID.randomUUID());
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(order.getTotalAmount()).isEqualByComparingTo("449.97");

        Inventory afterReserve = inventoryRepository.findByProductId(product.getId()).orElseThrow();
        assertThat(afterReserve.getTotalStock()).isEqualTo(10);
        assertThat(afterReserve.getReservedStock()).isEqualTo(3);
        assertThat(afterReserve.getAvailableStock()).isEqualTo(7);

        String payKey = "pay-" + UUID.randomUUID();
        PaymentDto pay1 = paymentService.initiatePayment(buyer,
                PaymentInitiateRequest.builder().orderId(order.getId()).build(), payKey);
        PaymentDto pay2 = paymentService.initiatePayment(buyer,
                PaymentInitiateRequest.builder().orderId(order.getId()).build(), payKey);
        assertThat(pay1.getId()).isEqualTo(pay2.getId());

        // Callback succeeded + duplicate callback
        PaymentDto confirmedPay = paymentService.handleCallback(buyer,
                PaymentCallbackRequest.builder().paymentId(pay1.getId()).outcome("SUCCEEDED").build());
        PaymentDto duplicatePay = paymentService.handleCallback(buyer,
                PaymentCallbackRequest.builder().paymentId(pay1.getId()).outcome("SUCCEEDED").build());

        assertThat(confirmedPay.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        assertThat(duplicatePay.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);

        Inventory afterConfirm = inventoryRepository.findByProductId(product.getId()).orElseThrow();
        assertThat(afterConfirm.getTotalStock()).isEqualTo(7);
        assertThat(afterConfirm.getReservedStock()).isZero();
        assertThat(afterConfirm.getAvailableStock()).isEqualTo(7);
    }

    @Test
    void latePaymentAfterReservationExpiry_autoRefundsAndNeverConfirms() {
        String email = "late-" + UUID.randomUUID() + "@flashcart.com";
        authService.register(RegisterRequest.builder()
                .email(email).password("Pass@12345").firstName("Late").build());
        User buyer = userRepository.findByEmail(email).orElseThrow();

        ProductDto product = productService.createProduct(ProductRequest.builder()
                .name("Smart Watch")
                .sku("SKU-SW-" + UUID.randomUUID().toString().substring(0, 8))
                .price(new BigDecimal("299.00"))
                .initialStock(5)
                .active(true)
                .build());

        cartService.addItem(buyer.getId(), AddToCartRequest.builder()
                .productId(product.getId()).quantity(2).build());

        OrderDto order = orderService.checkout(buyer, CheckoutRequest.builder()
                .shippingFullName("Late Buyer")
                .shippingAddressLine1("456 Park Ave")
                .shippingCity("Mumbai")
                .shippingState("MH")
                .shippingPostalCode("400001")
                .build(), null);

        PaymentDto payment = paymentService.initiatePayment(buyer,
                PaymentInitiateRequest.builder().orderId(order.getId()).build(), "late-pay-" + UUID.randomUUID());

        // Simulate reservation TTL expiry before payment callback arrives
        List<InventoryReservation> reservations = reservationRepository.findByOrderId(order.getId());
        for (InventoryReservation res : reservations) {
            res.setExpiresAt(Instant.now().minus(5, ChronoUnit.MINUTES));
            reservationRepository.save(res);
        }

        PaymentDto result = paymentService.handleCallback(buyer,
                PaymentCallbackRequest.builder().paymentId(payment.getId()).outcome("SUCCEEDED").build());

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        OrderDto updatedOrder = orderService.getOrderById(buyer, order.getId(), false);
        assertThat(updatedOrder.getStatus()).isEqualTo(OrderStatus.CANCELLED);

        Inventory inv = inventoryRepository.findByProductId(product.getId()).orElseThrow();
        assertThat(inv.getTotalStock()).isEqualTo(5);
        assertThat(inv.getReservedStock()).isZero();
    }

    @Test
    void checkout_sameIdempotencyKeyAcrossDifferentUsers_isIsolatedWithoutIdor() {
        String emailA = "usera-" + UUID.randomUUID() + "@flashcart.com";
        String emailB = "userb-" + UUID.randomUUID() + "@flashcart.com";
        authService.register(RegisterRequest.builder().email(emailA).password("Pass@12345").firstName("UserA").build());
        authService.register(RegisterRequest.builder().email(emailB).password("Pass@12345").firstName("UserB").build());
        User userA = userRepository.findByEmail(emailA).orElseThrow();
        User userB = userRepository.findByEmail(emailB).orElseThrow();

        ProductDto product = productService.createProduct(ProductRequest.builder()
                .name("Shared Key Headphones")
                .sku("SKU-IDOR-" + UUID.randomUUID().toString().substring(0, 8))
                .price(new BigDecimal("99.00"))
                .initialStock(10)
                .active(true)
                .build());

        cartService.addItem(userA.getId(), AddToCartRequest.builder().productId(product.getId()).quantity(1).build());
        cartService.addItem(userB.getId(), AddToCartRequest.builder().productId(product.getId()).quantity(2).build());

        CheckoutRequest req = CheckoutRequest.builder()
                .shippingFullName("Tester")
                .shippingAddressLine1("123 St")
                .shippingCity("Pune")
                .shippingState("MH")
                .shippingPostalCode("411001")
                .build();

        OrderDto orderA = orderService.checkout(userA, req, "shared-client-key");
        OrderDto orderB = orderService.checkout(userB, req, "shared-client-key");
        OrderDto retryA = orderService.checkout(userA, req, "shared-client-key");

        assertThat(orderA.getId()).isNotEqualTo(orderB.getId());
        assertThat(orderA.getUserId()).isEqualTo(userA.getId());
        assertThat(orderB.getUserId()).isEqualTo(userB.getId());
        assertThat(orderB.getTotalAmount()).isEqualByComparingTo("198.00");
        assertThat(retryA.getId()).isEqualTo(orderA.getId());
    }
}
