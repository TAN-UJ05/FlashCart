package com.flashcart.common.exception;

public class FlashCartException extends RuntimeException {
    private final String errorCode;

    public FlashCartException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
