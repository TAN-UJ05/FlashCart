package com.flashcart.payment.dto;

import com.flashcart.common.enums.PaymentProvider;
import com.flashcart.common.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentDto {
    private UUID id;
    private UUID orderId;
    private String orderNumber;
    private String idempotencyKey;
    private BigDecimal amount;
    private PaymentStatus status;
    private PaymentProvider provider;
    private String transactionId;
    private String failureReason;
    private Instant processedAt;
    private Instant createdAt;
}
