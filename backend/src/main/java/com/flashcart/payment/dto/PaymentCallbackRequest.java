package com.flashcart.payment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentCallbackRequest {
    private UUID paymentId;
    private String transactionId;

    @NotBlank(message = "Outcome is required (SUCCEEDED, FAILED, TIMEOUT)")
    private String outcome;

    private String failureReason;
}
