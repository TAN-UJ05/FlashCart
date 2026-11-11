package com.flashcart.common.exception;

public class ResourceNotFoundException extends FlashCartException {
    public ResourceNotFoundException(String resource, String id) {
        super(resource + " not found with id: " + id, "RESOURCE_NOT_FOUND");
    }

    public ResourceNotFoundException(String message) {
        super(message, "RESOURCE_NOT_FOUND");
    }
}
