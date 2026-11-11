package com.flashcart.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryDto {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private int totalStock;
    private int reservedStock;
    private int availableStock;
    private Instant updatedAt;
}
