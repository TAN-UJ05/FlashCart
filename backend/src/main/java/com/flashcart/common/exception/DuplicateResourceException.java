package com.flashcart.common.exception;

public class DuplicateResourceException extends FlashCartException {
    public DuplicateResourceException(String message) {
        super(message, "DUPLICATE_RESOURCE");
    }
}
