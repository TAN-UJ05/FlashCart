package com.flashcart.common.exception;

public class InsufficientInventoryException extends FlashCartException {
    public InsufficientInventoryException(String message) {
        super(message, "INSUFFICIENT_INVENTORY");
    }
}
