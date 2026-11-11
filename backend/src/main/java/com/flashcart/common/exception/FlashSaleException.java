package com.flashcart.common.exception;

public class FlashSaleException extends FlashCartException {
    public FlashSaleException(String message) {
        super(message, "FLASH_SALE_ERROR");
    }
}
