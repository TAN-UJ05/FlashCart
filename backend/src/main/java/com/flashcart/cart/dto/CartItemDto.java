package com.flashcart.cart.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartItemDto {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private String imageUrl;
    private BigDecimal regularPrice;
    private BigDecimal effectivePrice;
    private boolean onFlashSale;
    private UUID flashSaleId;
    private int quantity;
    private BigDecimal lineTotal;
    private int availableStock;
}
