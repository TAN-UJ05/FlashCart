package com.flashcart.product;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.flashcart.category.entity.Category;
import com.flashcart.category.repository.CategoryRepository;
import com.flashcart.common.response.PageResponse;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.flashsale.entity.FlashSale;
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
import com.flashcart.product.service.ImageStorageService;
import com.flashcart.product.service.ProductService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock private ProductRepository productRepository;
    @Mock private ProductImageRepository productImageRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private FlashSaleItemRepository flashSaleItemRepository;
    @Mock private ImageStorageService imageStorageService;
    @Mock private CacheInvalidationService cacheInvalidationService;

    @InjectMocks
    private ProductService productService;

    @Test
    @SuppressWarnings("unchecked")
    void getProducts_batchesCategoryImagesInventoryAndFlashSalesWithoutNPlusOne() {
        Pageable pageable = PageRequest.of(0, 12, Sort.by(Sort.Direction.DESC, "createdAt"));

        Category electronics = Category.builder().id(1L).name("Electronics").slug("electronics").build();

        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        Product p1 = Product.builder()
                .id(id1)
                .name("FlashCart Laptop")
                .sku("ELEC-001")
                .price(new BigDecimal("1299.00"))
                .category(electronics)
                .active(true)
                .build();
        Product p2 = Product.builder()
                .id(id2)
                .name("Wireless Headphones")
                .sku("ELEC-002")
                .price(new BigDecimal("199.00"))
                .category(electronics)
                .active(true)
                .build();

        ProductImage img1 = ProductImage.builder()
                .id(UUID.randomUUID())
                .product(p1)
                .imageUrl("/api/v1/images/p1-main.svg")
                .altText("Laptop")
                .sortOrder(0)
                .isPrimary(true)
                .build();
        ProductImage img2 = ProductImage.builder()
                .id(UUID.randomUUID())
                .product(p1)
                .imageUrl("/api/v1/images/p1-side.svg")
                .altText("Laptop side")
                .sortOrder(1)
                .isPrimary(false)
                .build();
        ProductImage img3 = ProductImage.builder()
                .id(UUID.randomUUID())
                .product(p2)
                .imageUrl("/api/v1/images/p2.svg")
                .altText("Headphones")
                .sortOrder(0)
                .isPrimary(true)
                .build();

        Inventory inv1 = Inventory.builder().id(UUID.randomUUID()).product(p1).totalStock(150).reservedStock(10).build();
        Inventory inv2 = Inventory.builder().id(UUID.randomUUID()).product(p2).totalStock(50).reservedStock(5).build();

        FlashSale sale = FlashSale.builder()
                .id(UUID.randomUUID())
                .name("Mega Sale")
                .startTime(Instant.now().minus(1, ChronoUnit.HOURS))
                .endTime(Instant.now().plus(2, ChronoUnit.HOURS))
                .active(true)
                .build();
        FlashSaleItem saleItem = FlashSaleItem.builder()
                .id(UUID.randomUUID())
                .flashSale(sale)
                .product(p1)
                .salePrice(new BigDecimal("999.00"))
                .saleStock(100)
                .soldCount(5)
                .build();

        List<UUID> expectedIds = List.of(id1, id2);
        Page<Product> page = new PageImpl<>(List.of(p1, p2), pageable, 2);

        when(productRepository.findAll(any(Specification.class), eq(pageable))).thenReturn(page);
        when(productRepository.findByIdInWithCategory(expectedIds)).thenReturn(List.of(p1, p2));
        when(productImageRepository.findByProductIdInOrderBySortOrderAsc(expectedIds))
                .thenReturn(List.of(img1, img2, img3));
        when(inventoryRepository.findByProductIdIn(expectedIds)).thenReturn(List.of(inv1, inv2));
        when(flashSaleItemRepository.findLiveByProductIds(eq(expectedIds), any(Instant.class)))
                .thenReturn(List.of(saleItem));

        PageResponse<ProductDto> result = productService.getProducts(null, null, null, null, true, pageable);

        assertThat(result.getContent()).isInstanceOf(ArrayList.class);
        assertThat(result.getContent()).hasSize(2);

        ProductDto dto1 = result.getContent().get(0);
        assertThat(dto1.getId()).isEqualTo(id1);
        assertThat(dto1.getCategoryName()).isEqualTo("Electronics");
        assertThat(dto1.getAvailableStock()).isEqualTo(140);
        assertThat(dto1.getActiveFlashSalePrice()).isEqualByComparingTo("999.00");
        assertThat(dto1.getActiveFlashSaleId()).isEqualTo(sale.getId());
        assertThat(dto1.getImages()).isInstanceOf(ArrayList.class).hasSize(2);
        assertThat(dto1.getImages().get(0).isPrimary()).isTrue();

        ProductDto dto2 = result.getContent().get(1);
        assertThat(dto2.getId()).isEqualTo(id2);
        assertThat(dto2.getAvailableStock()).isEqualTo(45);
        assertThat(dto2.getActiveFlashSalePrice()).isNull();
        assertThat(dto2.getImages()).hasSize(1);

        verify(productRepository, times(1)).findByIdInWithCategory(expectedIds);
        verify(productImageRepository, times(1)).findByProductIdInOrderBySortOrderAsc(expectedIds);
        verify(inventoryRepository, times(1)).findByProductIdIn(expectedIds);
        verify(flashSaleItemRepository, times(1)).findLiveByProductIds(eq(expectedIds), any(Instant.class));

        verify(flashSaleItemRepository, never()).findLiveByProductId(any(), any());
        verify(productImageRepository, never()).findByProductIdOrderBySortOrderAsc(any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void getProducts_emptyPage_skipsBatchQueries() {
        Pageable pageable = PageRequest.of(0, 12);
        when(productRepository.findAll(any(Specification.class), eq(pageable))).thenReturn(Page.empty(pageable));

        PageResponse<ProductDto> result = productService.getProducts(null, "missing", null, null, true, pageable);

        assertThat(result.getContent()).isInstanceOf(ArrayList.class).isEmpty();
        verify(productRepository, never()).findByIdInWithCategory(any());
        verifyNoInteractions(productImageRepository, inventoryRepository, flashSaleItemRepository);
    }

    @Test
    @SuppressWarnings("unchecked")
    void pageResponse_redisSerializerRoundTrip_preservesMutableContentAndFields() {
        ObjectMapper redisMapper = new ObjectMapper();
        redisMapper.registerModule(new JavaTimeModule());
        redisMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        redisMapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY);
        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer(redisMapper);

        ProductDto dto = ProductDto.builder()
                .id(UUID.randomUUID())
                .name("Cached Laptop")
                .sku("CACHE-001")
                .price(new BigDecimal("1299.00"))
                .active(true)
                .totalStock(100)
                .reservedStock(2)
                .availableStock(98)
                .images(new ArrayList<>(List.of(ProductImageDto.builder()
                        .id(UUID.randomUUID())
                        .imageUrl("/api/v1/images/seed-electronics.svg")
                        .sortOrder(0)
                        .isPrimary(true)
                        .build())))
                .createdAt(Instant.now())
                .build();

        Page<ProductDto> unmodifiableSpringPage = new PageImpl<>(List.of(dto), PageRequest.of(0, 12), 1);
        PageResponse<ProductDto> pageResponse = PageResponse.from(unmodifiableSpringPage);

        byte[] serialized = serializer.serialize(pageResponse);
        PageResponse<ProductDto> deserialized = serializer.deserialize(serialized, PageResponse.class);

        assertThat(deserialized).isNotNull();
        assertThat(deserialized.getContent()).hasSize(1);
        ProductDto roundTripped = deserialized.getContent().get(0);
        assertThat(roundTripped.getSku()).isEqualTo("CACHE-001");
        assertThat(roundTripped.getAvailableStock()).isEqualTo(98);
        assertThat(roundTripped.getImages()).hasSize(1);
        assertThat(roundTripped.getImages().get(0).isPrimary()).isTrue();
    }

    @Test
    void updateProduct_updatesOrCreatesPrimaryImageUrl() {
        UUID productId = UUID.randomUUID();
        Product existingProduct = Product.builder()
                .id(productId)
                .name("Desk Lamp")
                .sku("LAMP-001")
                .price(new BigDecimal("1499.00"))
                .active(true)
                .images(new ArrayList<>())
                .build();
        ProductImage existingImage = ProductImage.builder()
                .id(UUID.randomUUID())
                .product(existingProduct)
                .imageUrl("/api/v1/images/old.png")
                .altText("Desk Lamp")
                .sortOrder(0)
                .isPrimary(true)
                .build();

        when(productRepository.findByIdWithDetails(productId)).thenReturn(Optional.of(existingProduct));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(productImageRepository.findByProductIdOrderBySortOrderAsc(productId))
                .thenReturn(new ArrayList<>(List.of(existingImage)));
        when(productImageRepository.save(any(ProductImage.class))).thenAnswer(inv -> inv.getArgument(0));
        when(inventoryRepository.findByProductId(productId)).thenReturn(Optional.empty());
        when(flashSaleItemRepository.findLiveByProductId(eq(productId), any(Instant.class)))
                .thenReturn(Optional.empty());

        ProductRequest request = ProductRequest.builder()
                .name("Desk Lamp Pro")
                .sku("LAMP-001")
                .price(new BigDecimal("1799.00"))
                .active(true)
                .imageUrl("https://cdn.example.com/lamp-pro.png")
                .build();

        ProductDto updated = productService.updateProduct(productId, request);

        assertThat(updated.getName()).isEqualTo("Desk Lamp Pro");
        assertThat(updated.getImages()).hasSize(1);
        assertThat(updated.getImages().get(0).getImageUrl()).isEqualTo("https://cdn.example.com/lamp-pro.png");
        verify(cacheInvalidationService, times(1)).evictProductCaches();
    }
}
