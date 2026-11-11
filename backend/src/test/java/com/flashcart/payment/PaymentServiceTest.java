package com.flashcart.payment;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.PaymentStatus;
import com.flashcart.common.enums.ReservationStatus;
import com.flashcart.common.enums.UserRole;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.inventory.service.InventoryService;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.notification.service.NotificationService;
import com.flashcart.order.entity.Order;
import com.flashcart.order.repository.OrderRepository;
import com.flashcart.payment.dto.PaymentCallbackRequest;
import com.flashcart.payment.dto.PaymentDto;
import com.flashcart.payment.entity.Payment;
import com.flashcart.payment.repository.PaymentRepository;
import com.flashcart.payment.service.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private InventoryReservationRepository reservationRepository;
    @Mock private InventoryService inventoryService;
    @Mock private OutboxService outboxService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private PaymentService paymentService;

    private User customer;
    private User admin;
    private Order order;
    private Payment payment;

    @BeforeEach
    void setUp() {
        customer = User.builder().id(UUID.randomUUID()).email("c@flashcart.com").role(UserRole.CUSTOMER).build();
        admin = User.builder().id(UUID.randomUUID()).email("a@flashcart.com").role(UserRole.ADMIN).build();
        order = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("FC-999")
                .user(customer)
                .status(OrderStatus.PAYMENT_PENDING)
                .totalAmount(new BigDecimal("199.99"))
                .subtotal(new BigDecimal("199.99"))
                .build();
        payment = Payment.builder()
                .id(UUID.randomUUID())
                .order(order)
                .idempotencyKey("pay-key-1")
                .amount(new BigDecimal("199.99"))
                .status(PaymentStatus.PENDING)
                .transactionId("TXN-123")
                .build();
    }

    @Test
    void handleCallback_succeeded_confirmsInventoryAndOrder() {
        when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(inventoryService.confirmOrderReservations(order.getId())).thenReturn(true);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        PaymentDto dto = paymentService.handleCallback(customer,
                PaymentCallbackRequest.builder().paymentId(payment.getId()).outcome("SUCCEEDED").build());

        assertThat(dto.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        verify(outboxService).recordEvent(eq("Payment"), any(), eq("PaymentSucceeded"), anyMap());
    }

    @Test
    void handleCallback_duplicateSucceeded_doesNotDoubleConfirm() {
        payment.setStatus(PaymentStatus.SUCCEEDED);
        order.setStatus(OrderStatus.CONFIRMED);

        when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        PaymentDto dto = paymentService.handleCallback(customer,
                PaymentCallbackRequest.builder().paymentId(payment.getId()).outcome("SUCCEEDED").build());

        assertThat(dto.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        verify(inventoryService, never()).confirmOrderReservations(any());
        verify(outboxService, never()).recordEvent(any(), any(), any(), any());
    }

    @Test
    void handleCallback_latePaymentAfterExpiry_autoRefundsAndCancelsOrder() {
        when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(inventoryService.confirmOrderReservations(order.getId())).thenReturn(false);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        PaymentDto dto = paymentService.handleCallback(customer,
                PaymentCallbackRequest.builder().paymentId(payment.getId()).outcome("SUCCEEDED").build());

        assertThat(dto.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        verify(inventoryService).releaseOrderReservations(order.getId(), ReservationStatus.EXPIRED);
    }

    @Test
    void handleCallback_timeout_marksOrderPaymentFailed() {
        when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        PaymentDto dto = paymentService.handleCallback(customer,
                PaymentCallbackRequest.builder().paymentId(payment.getId()).outcome("TIMEOUT").build());

        assertThat(dto.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(dto.getFailureReason()).contains("timed out");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAYMENT_FAILED);
    }

    @Test
    void refundPayment_customerOnShippedOrDeliveredOrder_throwsInvalidOperation() {
        payment.setStatus(PaymentStatus.SUCCEEDED);
        order.setStatus(OrderStatus.SHIPPED);

        when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> paymentService.refundPayment(customer, payment.getId()))
                .isInstanceOf(InvalidOperationException.class);
        verify(inventoryService, never()).restoreConfirmedOrderStock(any());

        order.setStatus(OrderStatus.DELIVERED);
        assertThatThrownBy(() -> paymentService.refundPayment(customer, payment.getId()))
                .isInstanceOf(InvalidOperationException.class);
    }

    @Test
    void refundPayment_adminOnShippedOrder_succeeds() {
        payment.setStatus(PaymentStatus.SUCCEEDED);
        order.setStatus(OrderStatus.SHIPPED);

        when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        PaymentDto dto = paymentService.refundPayment(admin, payment.getId());

        assertThat(dto.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.REFUNDED);
        verify(inventoryService).restoreConfirmedOrderStock(order.getId());
    }

    @Test
    void refundPayment_customerOnConfirmedOrder_succeeds() {
        payment.setStatus(PaymentStatus.SUCCEEDED);
        order.setStatus(OrderStatus.CONFIRMED);

        when(paymentRepository.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        PaymentDto dto = paymentService.refundPayment(customer, payment.getId());

        assertThat(dto.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(inventoryService).restoreConfirmedOrderStock(order.getId());
    }
}
