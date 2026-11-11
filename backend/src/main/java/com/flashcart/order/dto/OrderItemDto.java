package com.flashcart.order.dto;

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
public class OrderItemDto {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private BigDecimal unitPrice;
    private int quantity;
    private BigDecimal totalPrice;
    private UUID flashSaleId;
}
