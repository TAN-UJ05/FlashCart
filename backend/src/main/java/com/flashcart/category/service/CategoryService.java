package com.flashcart.category.service;

import com.flashcart.category.dto.CategoryDto;
import com.flashcart.category.dto.CategoryRequest;
import com.flashcart.category.entity.Category;
import com.flashcart.category.repository.CategoryRepository;
import com.flashcart.common.exception.DuplicateResourceException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.config.RedisConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final CacheInvalidationService cacheInvalidationService;

    @Cacheable(value = RedisConfig.CACHE_CATEGORIES, key = "'active'")
    @Transactional(readOnly = true)
    public List<CategoryDto> getActiveCategories() {
        return new ArrayList<>(categoryRepository.findByActiveTrueOrderBySortOrderAscNameAsc()
                .stream()
                .map(this::toDto)
                .toList());
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> getAllCategories() {
        return categoryRepository.findAllByOrderBySortOrderAscNameAsc()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryDto getCategoryById(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id.toString()));
        return toDto(category);
    }

    @Transactional(readOnly = true)
    public CategoryDto getCategoryBySlug(String slug) {
        Category category = categoryRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Category", slug));
        return toDto(category);
    }

    @Transactional
    public CategoryDto createCategory(CategoryRequest request) {
        String name = request.getName().trim();
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("Category already exists with name: " + name);
        }

        String slug = (request.getSlug() != null && !request.getSlug().isBlank())
                ? slugify(request.getSlug())
                : slugify(name);
        if (categoryRepository.existsBySlug(slug)) {
            throw new DuplicateResourceException("Category already exists with slug: " + slug);
        }

        Category parent = null;
        if (request.getParentId() != null) {
            parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent Category", request.getParentId().toString()));
        }

        Category category = Category.builder()
                .name(name)
                .description(request.getDescription())
                .slug(slug)
                .imageUrl(request.getImageUrl())
                .active(request.isActive())
                .sortOrder(request.getSortOrder())
                .parent(parent)
                .build();

        Category saved = categoryRepository.save(category);
        cacheInvalidationService.evictCategoryCaches();
        return toDto(saved);
    }

    @Transactional
    public CategoryDto updateCategory(Long id, CategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id.toString()));

        String name = request.getName().trim();
        if (!category.getName().equalsIgnoreCase(name) && categoryRepository.existsByNameIgnoreCase(name)) {
            throw new DuplicateResourceException("Category already exists with name: " + name);
        }

        String slug = (request.getSlug() != null && !request.getSlug().isBlank())
                ? slugify(request.getSlug())
                : slugify(name);
        if (!category.getSlug().equals(slug) && categoryRepository.existsBySlug(slug)) {
            throw new DuplicateResourceException("Category already exists with slug: " + slug);
        }

        Category parent = null;
        if (request.getParentId() != null && !request.getParentId().equals(id)) {
            parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent Category", request.getParentId().toString()));
        }

        category.setName(name);
        category.setDescription(request.getDescription());
        category.setSlug(slug);
        category.setImageUrl(request.getImageUrl());
        category.setActive(request.isActive());
        category.setSortOrder(request.getSortOrder());
        category.setParent(parent);

        Category saved = categoryRepository.save(category);
        cacheInvalidationService.evictCategoryCaches();
        return toDto(saved);
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id.toString()));
        category.setActive(false);
        categoryRepository.save(category);
        cacheInvalidationService.evictCategoryCaches();
    }

    private String slugify(String input) {
        return input.trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-");
    }

    public CategoryDto toDto(Category category) {
        return CategoryDto.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .slug(category.getSlug())
                .imageUrl(category.getImageUrl())
                .active(category.isActive())
                .sortOrder(category.getSortOrder())
                .parentId(category.getParent() != null ? category.getParent().getId() : null)
                .createdAt(category.getCreatedAt())
                .build();
    }
}
