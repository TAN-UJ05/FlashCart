package com.flashcart.flashsale.dto;

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
public class FlashSaleItemDto {
    private UUID id;
    private UUID flashSaleId;
    private UUID productId;
    private String productName;
    private String productSku;
    private String imageUrl;
    private BigDecimal regularPrice;
    private BigDecimal salePrice;
    private int saleStock;
    private int soldCount;
    private int remainingStock;
}
