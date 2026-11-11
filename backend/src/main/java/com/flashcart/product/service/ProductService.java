package com.flashcart.product.service;

import com.flashcart.category.entity.Category;
import com.flashcart.category.repository.CategoryRepository;
import com.flashcart.common.exception.DuplicateResourceException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.common.response.PageResponse;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.config.RedisConfig;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.product.dto.ProductDto;
import com.flashcart.product.dto.ProductImageDto;
import com.flashcart.product.dto.ProductRequest;
import com.flashcart.product.entity.Product;
import com.flashcart.product.entity.ProductImage;
import com.flashcart.product.repository.ProductImageRepository;
import com.flashcart.product.repository.ProductRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final CategoryRepository categoryRepository;
    private final InventoryRepository inventoryRepository;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final ImageStorageService imageStorageService;
    private final CacheInvalidationService cacheInvalidationService;

    @Cacheable(
            value = RedisConfig.CACHE_PRODUCTS,
            key = "#activeOnly + '|' + (#categoryId != null ? #categoryId : 'all') + '|' + (#search != null ? #search.trim().toLowerCase() : '') + '|' + (#minPrice != null ? #minPrice : '') + '|' + (#maxPrice != null ? #maxPrice : '') + '|' + #pageable.pageNumber + '|' + #pageable.pageSize + '|' + #pageable.sort.toString()"
    )
    @Transactional(readOnly = true)
    public PageResponse<ProductDto> getProducts(
            Long categoryId,
            String search,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            boolean activeOnly,
            Pageable pageable) {

        Specification<Product> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (activeOnly) {
                predicates.add(cb.isTrue(root.get("active")));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }
            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("price"), minPrice));
            }
            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("price"), maxPrice));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern),
                        cb.like(cb.lower(root.get("sku")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Product> productPage = productRepository.findAll(spec, pageable);
        List<UUID> productIds = productPage.getContent().stream().map(Product::getId).toList();

        Map<UUID, Product> productsById;
        Map<UUID, List<ProductImage>> imagesByProductId;
        Map<UUID, Inventory> inventoryMap;
        Map<UUID, FlashSaleItem> liveSaleByProductId;

        if (productIds.isEmpty()) {
            productsById = Map.of();
            imagesByProductId = Map.of();
            inventoryMap = Map.of();
            liveSaleByProductId = Map.of();
        } else {
            productsById = productRepository.findByIdInWithCategory(productIds).stream()
                    .collect(Collectors.toMap(Product::getId, p -> p, (a, b) -> a));
            imagesByProductId = productImageRepository.findByProductIdInOrderBySortOrderAsc(productIds).stream()
                    .collect(Collectors.groupingBy(img -> img.getProduct().getId()));
            inventoryMap = inventoryRepository.findByProductIdIn(productIds).stream()
                    .collect(Collectors.toMap(inv -> inv.getProduct().getId(), inv -> inv, (a, b) -> a));
            Instant now = Instant.now();
            liveSaleByProductId = flashSaleItemRepository.findLiveByProductIds(productIds, now).stream()
                    .collect(Collectors.toMap(fsi -> fsi.getProduct().getId(), fsi -> fsi, (a, b) -> a));
        }

        Page<ProductDto> dtoPage = productPage.map(product -> {
            Product hydrated = productsById.getOrDefault(product.getId(), product);
            Inventory inv = inventoryMap.get(product.getId());
            FlashSaleItem liveSale = liveSaleByProductId.get(product.getId());
            List<ProductImage> images = imagesByProductId.getOrDefault(product.getId(), List.of());
            return toDto(hydrated, inv, liveSale, images);
        });

        return PageResponse.from(dtoPage);
    }

    @Cacheable(value = RedisConfig.CACHE_PRODUCT_DETAIL, key = "#id")
    @Transactional(readOnly = true)
    public ProductDto getProductById(UUID id) {
        Product product = productRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id.toString()));
        Inventory inventory = inventoryRepository.findByProductId(id).orElse(null);
        FlashSaleItem liveSale = flashSaleItemRepository.findLiveByProductId(id, Instant.now()).orElse(null);
        return toDto(product, inventory, liveSale);
    }

    @Transactional
    public ProductDto createProduct(ProductRequest request) {
        String sku = request.getSku().trim();
        if (productRepository.existsBySku(sku)) {
            throw new DuplicateResourceException("Product already exists with SKU: " + sku);
        }

        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category", request.getCategoryId().toString()));
        }

        Product product = Product.builder()
                .name(request.getName().trim())
                .description(request.getDescription())
                .sku(sku)
                .price(request.getPrice())
                .compareAtPrice(request.getCompareAtPrice())
                .category(category)
                .active(request.isActive())
                .build();

        product = productRepository.save(product);

        if (request.getImageUrl() != null && !request.getImageUrl().isBlank()) {
            ProductImage image = ProductImage.builder()
                    .product(product)
                    .imageUrl(request.getImageUrl().trim())
                    .altText(product.getName())
                    .sortOrder(0)
                    .isPrimary(true)
                    .build();
            product.getImages().add(productImageRepository.save(image));
        }

        int initialStock = request.getInitialStock() != null ? request.getInitialStock() : 0;
        Inventory inventory = Inventory.builder()
                .product(product)
                .totalStock(initialStock)
                .reservedStock(0)
                .build();
        inventory = inventoryRepository.save(inventory);

        cacheInvalidationService.evictProductCaches();
        return toDto(product, inventory, null);
    }

    @Transactional
    public ProductDto updateProduct(UUID id, ProductRequest request) {
        Product product = productRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id.toString()));

        String sku = request.getSku().trim();
        if (!product.getSku().equals(sku) && productRepository.existsBySku(sku)) {
            throw new DuplicateResourceException("Product already exists with SKU: " + sku);
        }

        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category", request.getCategoryId().toString()));
        }

        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setSku(sku);
        product.setPrice(request.getPrice());
        product.setCompareAtPrice(request.getCompareAtPrice());
        product.setCategory(category);
        product.setActive(request.isActive());

        product = productRepository.save(product);
        Inventory inventory = inventoryRepository.findByProductId(id).orElse(null);
        FlashSaleItem liveSale = flashSaleItemRepository.findLiveByProductId(id, Instant.now()).orElse(null);

        cacheInvalidationService.evictProductCaches();
        return toDto(product, inventory, liveSale);
    }

    @Transactional
    public void deactivateProduct(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id.toString()));
        product.setActive(false);
        productRepository.save(product);
        cacheInvalidationService.evictProductCaches();
    }

    @Transactional
    public ProductImageDto uploadProductImage(UUID productId, MultipartFile file, String altText, boolean isPrimary) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId.toString()));

        String filename = imageStorageService.storeImage(file);
        String imageUrl = "/api/v1/images/" + filename;

        List<ProductImage> existing = productImageRepository.findByProductIdOrderBySortOrderAsc(productId);
        if (isPrimary) {
            for (ProductImage img : existing) {
                if (img.isPrimary()) {
                    img.setPrimary(false);
                    productImageRepository.save(img);
                }
            }
        }

        ProductImage productImage = ProductImage.builder()
                .product(product)
                .imageUrl(imageUrl)
                .altText(altText != null && !altText.isBlank() ? altText : product.getName())
                .sortOrder(existing.size())
                .isPrimary(isPrimary || existing.isEmpty())
                .build();

        productImage = productImageRepository.save(productImage);
        cacheInvalidationService.evictProductCaches();

        return toImageDto(productImage);
    }

    @Transactional
    public void deleteProductImage(UUID productId, UUID imageId) {
        ProductImage image = productImageRepository.findByIdAndProductId(imageId, productId)
                .orElseThrow(() -> new ResourceNotFoundException("ProductImage", imageId.toString()));
        imageStorageService.deleteImageByUrl(image.getImageUrl());
        productImageRepository.delete(image);
        cacheInvalidationService.evictProductCaches();
    }

    public ProductDto toDto(Product product, Inventory inventory, FlashSaleItem liveSale) {
        return toDto(product, inventory, liveSale, product.getImages());
    }

    public ProductDto toDto(Product product, Inventory inventory, FlashSaleItem liveSale, List<ProductImage> images) {
        int totalStock = inventory != null ? inventory.getTotalStock() : 0;
        int reservedStock = inventory != null ? inventory.getReservedStock() : 0;
        int availableStock = inventory != null ? inventory.getAvailableStock() : 0;

        List<ProductImageDto> imageDtos = images != null
                ? new ArrayList<>(images.stream().map(this::toImageDto).toList())
                : new ArrayList<>();

        return ProductDto.builder()
                .id(product.getId())
                .name(product.getName())
                .description(product.getDescription())
                .sku(product.getSku())
                .price(product.getPrice())
                .compareAtPrice(product.getCompareAtPrice())
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .categorySlug(product.getCategory() != null ? product.getCategory().getSlug() : null)
                .active(product.isActive())
                .totalStock(totalStock)
                .reservedStock(reservedStock)
                .availableStock(availableStock)
                .activeFlashSalePrice(liveSale != null && liveSale.getRemainingStock() > 0 ? liveSale.getSalePrice() : null)
                .activeFlashSaleId(liveSale != null && liveSale.getRemainingStock() > 0 ? liveSale.getFlashSale().getId() : null)
                .images(imageDtos)
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    private ProductImageDto toImageDto(ProductImage img) {
        return ProductImageDto.builder()
                .id(img.getId())
                .imageUrl(img.getImageUrl())
                .altText(img.getAltText())
                .sortOrder(img.getSortOrder())
                .isPrimary(img.isPrimary())
                .build();
    }
}
