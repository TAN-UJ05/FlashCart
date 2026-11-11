package com.flashcart.common.exception;

public class InvalidOperationException extends FlashCartException {
    public InvalidOperationException(String message) {
        super(message, "INVALID_OPERATION");
    }
}
