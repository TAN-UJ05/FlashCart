package com.flashcart.category.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryDto {
    private Long id;
    private String name;
    private String description;
    private String slug;
    private String imageUrl;
    private boolean active;
    private int sortOrder;
    private Long parentId;
    private Instant createdAt;
}
