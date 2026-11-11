package com.flashcart.product.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDto {
    private UUID id;
    private String name;
    private String description;
    private String sku;
    private BigDecimal price;
    private BigDecimal compareAtPrice;
    private Long categoryId;
    private String categoryName;
    private String categorySlug;
    private boolean active;
    private int totalStock;
    private int reservedStock;
    private int availableStock;
    private BigDecimal activeFlashSalePrice;
    private UUID activeFlashSaleId;
    private List<ProductImageDto> images;
    private Instant createdAt;
    private Instant updatedAt;
}
