package com.flashcart.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryRequest {
    @NotBlank(message = "Category name is required")
    @Size(max = 100)
    private String name;

    private String description;

    @Size(max = 100)
    private String slug;

    private String imageUrl;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private int sortOrder = 0;

    private Long parentId;
}
