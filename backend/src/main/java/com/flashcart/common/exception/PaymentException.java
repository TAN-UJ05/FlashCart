package com.flashcart.common.exception;

public class PaymentException extends FlashCartException {
    public PaymentException(String message) {
        super(message, "PAYMENT_ERROR");
    }
}
