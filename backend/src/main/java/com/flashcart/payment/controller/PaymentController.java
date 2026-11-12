package com.flashcart.payment.controller;

import com.flashcart.auth.entity.User;
import com.flashcart.common.response.ApiResponse;
import com.flashcart.payment.dto.PaymentCallbackRequest;
import com.flashcart.payment.dto.PaymentDto;
import com.flashcart.payment.dto.PaymentInitiateRequest;
import com.flashcart.payment.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/initiate")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<PaymentDto>> initiatePayment(
            @AuthenticationPrincipal User user,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody PaymentInitiateRequest request) {
        PaymentDto payment = paymentService.initiatePayment(user, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Payment initiated", payment));
    }

    @PostMapping("/callback")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<PaymentDto>> handleCallback(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PaymentCallbackRequest request) {
        PaymentDto payment = paymentService.handleCallback(user, request);
        return ResponseEntity.ok(ApiResponse.success("Payment callback processed", payment));
    }

    @PostMapping("/{id}/refund")
    public ResponseEntity<ApiResponse<PaymentDto>> refundPayment(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        PaymentDto payment = paymentService.refundPayment(user, id);
        return ResponseEntity.ok(ApiResponse.success("Payment refunded", payment));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<ApiResponse<List<PaymentDto>>> getOrderPayments(
            @AuthenticationPrincipal User user,
            @PathVariable UUID orderId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPaymentsForOrder(user, orderId)));
    }
}
