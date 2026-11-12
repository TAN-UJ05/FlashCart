package com.flashcart.payment.service;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.*;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.common.util.IdempotencyKeyUtils;
import com.flashcart.inventory.entity.InventoryReservation;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.inventory.service.InventoryService;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.notification.service.NotificationService;
import com.flashcart.order.entity.Order;
import com.flashcart.order.repository.OrderRepository;
import com.flashcart.payment.dto.PaymentCallbackRequest;
import com.flashcart.payment.dto.PaymentDto;
import com.flashcart.payment.dto.PaymentInitiateRequest;
import com.flashcart.payment.entity.Payment;
import com.flashcart.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final InventoryReservationRepository reservationRepository;
    private final InventoryService inventoryService;
    private final OutboxService outboxService;
    private final NotificationService notificationService;

    @Transactional
    public PaymentDto initiatePayment(User user, PaymentInitiateRequest request, String headerIdempotencyKey) {
        if (user.getRole() == UserRole.ADMIN) {
            throw new AccessDeniedException("Administrators cannot initiate customer payments");
        }
        String rawIdempotencyKey = IdempotencyKeyUtils.resolveRawKey(
                headerIdempotencyKey, request.getIdempotencyKey());
        String idempotencyKey = rawIdempotencyKey != null
                ? IdempotencyKeyUtils.scopeForUser(user.getId(), "pay", rawIdempotencyKey)
                : "pay:" + user.getId() + ":" + request.getOrderId() + ":" + UUID.randomUUID();

        Optional<Payment> existing = paymentRepository.findByIdempotencyKeyForUpdate(idempotencyKey);
        if (existing.isPresent()) {
            Payment payment = existing.get();
            if (!payment.getOrder().getUser().getId().equals(user.getId())) {
                throw new UnauthorizedException("You do not have permission to access this payment");
            }
            return toDto(payment);
        }

        Order order = orderRepository.findByIdForUpdate(request.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order", request.getOrderId().toString()));

        if (!order.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have permission to pay for this order");
        }

        if (order.getStatus() == OrderStatus.CONFIRMED || order.getStatus() == OrderStatus.DELIVERED
                || order.getStatus() == OrderStatus.SHIPPED || order.getStatus() == OrderStatus.PROCESSING) {
            throw new InvalidOperationException("Order has already been paid");
        }
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.REFUNDED) {
            throw new InvalidOperationException("Cannot pay for a cancelled or refunded order");
        }

        // Check reservation validity before initiating payment
        List<InventoryReservation> reservations = reservationRepository.findByOrderId(order.getId());
        Instant now = Instant.now();
        boolean anyExpired = reservations.isEmpty() || reservations.stream().anyMatch(
                r -> r.getStatus() != ReservationStatus.CREATED || r.getExpiresAt().isBefore(now));
        if (anyExpired) {
            inventoryService.releaseOrderReservations(order.getId(), ReservationStatus.EXPIRED);
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);
            throw new InvalidOperationException("Inventory reservation has expired. Please place a new order.");
        }

        order.setStatus(OrderStatus.PAYMENT_PENDING);
        orderRepository.save(order);

        Payment payment = Payment.builder()
                .order(order)
                .idempotencyKey(idempotencyKey)
                .amount(order.getTotalAmount())
                .status(PaymentStatus.PENDING)
                .provider(PaymentProvider.SIMULATOR)
                .transactionId("TXN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase())
                .build();

        return toDto(paymentRepository.save(payment));
    }

    @Transactional
    public PaymentDto handleCallback(User currentUser, PaymentCallbackRequest request) {
        if (currentUser.getRole() == UserRole.ADMIN) {
            throw new AccessDeniedException("Administrators cannot complete customer payments");
        }
        Payment payment = findAndLockPayment(request);
        UUID orderId = payment.getOrder().getId();
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId.toString()));

        if (!order.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedException("You do not have permission to update this payment");
        }

        String outcome = request.getOutcome().trim().toUpperCase();

        // Idempotent handling of duplicate callbacks
        if (payment.getStatus() == PaymentStatus.SUCCEEDED
                || payment.getStatus() == PaymentStatus.REFUNDED
                || payment.getStatus() == PaymentStatus.CANCELLED) {
            log.info("Idempotent duplicate payment callback ignored [paymentId={}, status={}]",
                    payment.getId(), payment.getStatus());
            return toDto(payment);
        }

        if (payment.getStatus() == PaymentStatus.FAILED
                && ("FAILED".equals(outcome) || "TIMEOUT".equals(outcome))) {
            log.info("Idempotent duplicate failure callback ignored [paymentId={}]", payment.getId());
            return toDto(payment);
        }

        Instant now = Instant.now();

        if ("SUCCEEDED".equals(outcome)) {
            if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.REFUNDED) {
                return autoRefundLatePayment(payment, order, now,
                        "Auto-refunded: order was cancelled before payment completed");
            }

            boolean confirmed = inventoryService.confirmOrderReservations(order.getId());
            if (!confirmed) {
                // Late payment arrived after reservation expired — NEVER confirm expired reservation!
                return autoRefundLatePayment(payment, order, now,
                        "Auto-refunded: inventory reservation expired before payment completion");
            }

            payment.setStatus(PaymentStatus.SUCCEEDED);
            payment.setProcessedAt(now);
            payment.setFailureReason(null);
            payment = paymentRepository.save(payment);

            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.save(order);

            outboxService.recordEvent(
                    "Payment",
                    payment.getId().toString(),
                    "PaymentSucceeded",
                    Map.of(
                            "paymentId", payment.getId().toString(),
                            "orderId", order.getId().toString(),
                            "orderNumber", order.getOrderNumber(),
                            "amount", payment.getAmount().toString(),
                            "transactionId", payment.getTransactionId()
                    )
            );

            notificationService.queueNotification(
                    order.getUser(),
                    NotificationType.ORDER_CONFIRMATION,
                    "Order Confirmed: " + order.getOrderNumber(),
                    "Your payment of " + payment.getAmount() + " succeeded for order " + order.getOrderNumber() + "."
            );

            return toDto(payment);
        }

        if ("FAILED".equals(outcome) || "TIMEOUT".equals(outcome)) {
            String reason = "TIMEOUT".equals(outcome)
                    ? "Payment gateway timed out"
                    : (request.getFailureReason() != null && !request.getFailureReason().isBlank()
                        ? request.getFailureReason()
                        : "Payment declined by simulator");

            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason(reason);
            payment.setProcessedAt(now);
            payment = paymentRepository.save(payment);

            order.setStatus(OrderStatus.PAYMENT_FAILED);
            orderRepository.save(order);

            outboxService.recordEvent(
                    "Payment",
                    payment.getId().toString(),
                    "PaymentFailed",
                    Map.of(
                            "paymentId", payment.getId().toString(),
                            "orderId", order.getId().toString(),
                            "orderNumber", order.getOrderNumber(),
                            "reason", reason
                    )
            );

            notificationService.queueNotification(
                    order.getUser(),
                    NotificationType.PAYMENT_FAILED,
                    "Payment Failed for Order " + order.getOrderNumber(),
                    "Your payment could not be processed (" + reason + "). You can retry from your order details page."
            );

            return toDto(payment);
        }

        throw new InvalidOperationException("Unsupported payment outcome: " + outcome + ". Expected SUCCEEDED, FAILED, or TIMEOUT");
    }

    @Transactional
    public PaymentDto refundPayment(User currentUser, UUID paymentId) {
        Payment payment = paymentRepository.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId.toString()));
        UUID orderId = payment.getOrder().getId();
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId.toString()));

        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;
        if (!isAdmin && !order.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedException("You do not have permission to refund this payment");
        }

        if (payment.getStatus() == PaymentStatus.REFUNDED) {
            return toDto(payment);
        }

        if (payment.getStatus() != PaymentStatus.SUCCEEDED) {
            throw new InvalidOperationException("Only succeeded payments can be refunded");
        }

        if (!isAdmin && (order.getStatus() == OrderStatus.PROCESSING
                || order.getStatus() == OrderStatus.SHIPPED
                || order.getStatus() == OrderStatus.DELIVERED)) {
            throw new InvalidOperationException(
                    "Cannot self-refund an order that is already " + order.getStatus() + ". Please contact support.");
        }

        inventoryService.restoreConfirmedOrderStock(order.getId());
        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setProcessedAt(Instant.now());
        payment.setFailureReason("Refunded upon request");
        payment = paymentRepository.save(payment);

        order.setStatus(OrderStatus.REFUNDED);
        orderRepository.save(order);

        return toDto(payment);
    }

    @Transactional(readOnly = true)
    public List<PaymentDto> getPaymentsForOrder(User user, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId.toString()));
        if (user.getRole() != UserRole.ADMIN && !order.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have permission to view payments for this order");
        }
        return paymentRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .map(this::toDto)
                .toList();
    }

    private PaymentDto autoRefundLatePayment(Payment payment, Order order, Instant now, String reason) {
        log.warn("Late payment auto-refund triggered [paymentId={}, orderId={}]: {}",
                payment.getId(), order.getId(), reason);

        inventoryService.releaseOrderReservations(order.getId(), ReservationStatus.EXPIRED);

        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setFailureReason(reason);
        payment.setProcessedAt(now);
        payment = paymentRepository.save(payment);

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        outboxService.recordEvent(
                "Payment",
                payment.getId().toString(),
                "PaymentFailed",
                Map.of(
                        "paymentId", payment.getId().toString(),
                        "orderId", order.getId().toString(),
                        "orderNumber", order.getOrderNumber(),
                        "reason", reason,
                        "autoRefunded", true
                )
        );

        notificationService.queueNotification(
                order.getUser(),
                NotificationType.PAYMENT_FAILED,
                "Payment Auto-Refunded for Order " + order.getOrderNumber(),
                reason
        );

        return toDto(payment);
    }

    private Payment findAndLockPayment(PaymentCallbackRequest request) {
        if (request.getPaymentId() != null) {
            return paymentRepository.findByIdForUpdate(request.getPaymentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Payment", request.getPaymentId().toString()));
        }
        if (request.getTransactionId() != null && !request.getTransactionId().isBlank()) {
            Payment found = paymentRepository.findByTransactionId(request.getTransactionId().trim())
                    .orElseThrow(() -> new ResourceNotFoundException("Payment with transactionId", request.getTransactionId()));
            return paymentRepository.findByIdForUpdate(found.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Payment", found.getId().toString()));
        }
        throw new InvalidOperationException("Either paymentId or transactionId is required");
    }

    public PaymentDto toDto(Payment payment) {
        return PaymentDto.builder()
                .id(payment.getId())
                .orderId(payment.getOrder().getId())
                .orderNumber(payment.getOrder().getOrderNumber())
                .idempotencyKey(payment.getIdempotencyKey())
                .amount(payment.getAmount())
                .status(payment.getStatus())
                .provider(payment.getProvider())
                .transactionId(payment.getTransactionId())
                .failureReason(payment.getFailureReason())
                .processedAt(payment.getProcessedAt())
                .createdAt(payment.getCreatedAt())
                .build();
    }
}
