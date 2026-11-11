package com.flashcart.common.exception;

public class UnauthorizedException extends FlashCartException {
    public UnauthorizedException(String message) {
        super(message, "UNAUTHORIZED");
    }
}
