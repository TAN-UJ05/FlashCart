package com.flashcart.flashsale.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
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
public class FlashSaleItemRequest {
    @NotNull(message = "Product ID is required")
    private UUID productId;

    @NotNull(message = "Sale price is required")
    @DecimalMin(value = "0.00", message = "Sale price must be >= 0")
    private BigDecimal salePrice;

    @Min(value = 1, message = "Sale stock must be at least 1")
    private int saleStock;
}
