package com.flashcart.flashsale.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlashSaleDto {
    private UUID id;
    private String name;
    private String description;
    private Instant startTime;
    private Instant endTime;
    private boolean active;
    private boolean live;
    private List<FlashSaleItemDto> items;
    private Instant createdAt;
}
