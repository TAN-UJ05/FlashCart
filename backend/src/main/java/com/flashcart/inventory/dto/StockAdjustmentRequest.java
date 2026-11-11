package com.flashcart.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAdjustmentRequest {
    /**
     * Delta to add/subtract (optional if newTotalStock is specified).
     */
    private Integer adjustment;

    /**
     * Absolute new total stock (optional if adjustment is specified).
     */
    @Min(value = 0, message = "Total stock cannot be negative")
    private Integer newTotalStock;

    private String reason;
}
