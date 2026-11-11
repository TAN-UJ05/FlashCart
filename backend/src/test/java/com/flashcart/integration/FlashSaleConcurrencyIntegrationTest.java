package com.flashcart.integration;

import com.flashcart.auth.entity.User;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.cart.dto.AddToCartRequest;
import com.flashcart.cart.service.CartService;
import com.flashcart.common.enums.UserRole;
import com.flashcart.flashsale.dto.FlashSaleDto;
import com.flashcart.flashsale.dto.FlashSaleItemRequest;
import com.flashcart.flashsale.dto.FlashSalePurchaseRequest;
import com.flashcart.flashsale.dto.FlashSaleRequest;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.flashsale.service.FlashSaleService;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.order.dto.CheckoutRequest;
import com.flashcart.order.dto.OrderDto;
import com.flashcart.order.service.OrderService;
import com.flashcart.product.dto.ProductDto;
import com.flashcart.product.dto.ProductRequest;
import com.flashcart.product.service.ProductService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class FlashSaleConcurrencyIntegrationTest extends AbstractIntegrationTest {

    @Autowired private FlashSaleService flashSaleService;
    @Autowired private ProductService productService;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private InventoryRepository inventoryRepository;
    @Autowired private FlashSaleItemRepository flashSaleItemRepository;
    @Autowired private StringRedisTemplate stringRedisTemplate;
    @Autowired private CartService cartService;
    @Autowired private OrderService orderService;

    @Test
    void concurrentFlashSalePurchase_100Stock_10000Attempts_zeroOverselling() throws Exception {
        final int INITIAL_STOCK = 100;
        final int TOTAL_ATTEMPTS = 10_000;
        final int THREAD_POOL_SIZE = 100;

        User admin = userRepository.save(User.builder()
                .email("fs-admin-" + UUID.randomUUID() + "@flashcart.com")
                .passwordHash(passwordEncoder.encode("Admin@123"))
                .firstName("FS")
                .lastName("Admin")
                .role(UserRole.ADMIN)
                .enabled(true)
                .build());

        List<User> buyers = new ArrayList<>();
        String encodedPass = passwordEncoder.encode("Buyer@123");
        for (int i = 0; i < 100; i++) {
            buyers.add(User.builder()
                    .email("fs-buyer-" + i + "-" + UUID.randomUUID() + "@flashcart.com")
                    .passwordHash(encodedPass)
                    .firstName("Buyer" + i)
                    .role(UserRole.CUSTOMER)
                    .enabled(true)
                    .build());
        }
        buyers = userRepository.saveAll(buyers);

        ProductDto product = productService.createProduct(ProductRequest.builder()
                .name("Limited Edition Console")
                .sku("FS-CONSOLE-" + UUID.randomUUID().toString().substring(0, 8))
                .price(new BigDecimal("499.99"))
                .initialStock(INITIAL_STOCK)
                .active(true)
                .build());

        FlashSaleDto flashSale = flashSaleService.createFlashSale(admin, FlashSaleRequest.builder()
                .name("Midnight Mega Flash Sale")
                .startTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                .endTime(Instant.now().plus(2, ChronoUnit.HOURS))
                .active(true)
                .items(List.of(FlashSaleItemRequest.builder()
                        .productId(product.getId())
                        .salePrice(new BigDecimal("299.99"))
                        .saleStock(INITIAL_STOCK)
                        .build()))
                .build());

        ExecutorService executor = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        CountDownLatch readyLatch = new CountDownLatch(THREAD_POOL_SIZE);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(TOTAL_ATTEMPTS);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        List<User> finalBuyers = buyers;
        for (int i = 0; i < TOTAL_ATTEMPTS; i++) {
            final int idx = i;
            executor.submit(() -> {
                if (idx < THREAD_POOL_SIZE) {
                    readyLatch.countDown();
                }
                try {
                    startLatch.await();
                    User buyer = finalBuyers.get(idx % finalBuyers.size());
                    FlashSalePurchaseRequest req = FlashSalePurchaseRequest.builder()
                            .productId(product.getId())
                            .quantity(1)
                            .idempotencyKey("conc-" + flashSale.getId() + "-" + idx)
                            .build();
                    flashSaleService.purchaseFlashSaleItem(buyer, flashSale.getId(), req, null);
                    successCount.incrementAndGet();
                } catch (Exception ex) {
                    failureCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await(10, TimeUnit.SECONDS);
        startLatch.countDown();
        boolean completed = doneLatch.await(120, TimeUnit.SECONDS);
        executor.shutdownNow();

        assertThat(completed).isTrue();
        assertThat(successCount.get()).isEqualTo(INITIAL_STOCK);
        assertThat(failureCount.get()).isEqualTo(TOTAL_ATTEMPTS - INITIAL_STOCK);

        Inventory finalInventory = inventoryRepository.findByProductId(product.getId()).orElseThrow();
        assertThat(finalInventory.getTotalStock()).isEqualTo(INITIAL_STOCK);
        assertThat(finalInventory.getReservedStock()).isEqualTo(INITIAL_STOCK);
        assertThat(finalInventory.getAvailableStock()).isZero();

        FlashSaleItem finalSaleItem = flashSaleItemRepository
                .findByFlashSaleIdAndProductId(flashSale.getId(), product.getId())
                .orElseThrow();
        assertThat(finalSaleItem.getSoldCount()).isEqualTo(INITIAL_STOCK);
        assertThat(finalSaleItem.getRemainingStock()).isZero();
    }

    @Test
    void concurrentFlashSalePurchase_directPostgresLockingWithoutRedis_zeroOverselling() throws Exception {
        final int INITIAL_STOCK = 25;
        final int CONCURRENT_ATTEMPTS = 250;

        User admin = userRepository.save(User.builder()
                .email("pg-admin-" + UUID.randomUUID() + "@flashcart.com")
                .passwordHash(passwordEncoder.encode("Admin@123"))
                .firstName("PG")
                .role(UserRole.ADMIN)
                .enabled(true)
                .build());

        User buyer = userRepository.save(User.builder()
                .email("pg-buyer-" + UUID.randomUUID() + "@flashcart.com")
                .passwordHash(passwordEncoder.encode("Buyer@123"))
                .firstName("PG")
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .build());

        ProductDto product = productService.createProduct(ProductRequest.builder()
                .name("Postgres Lock Test Item")
                .sku("PG-LOCK-" + UUID.randomUUID().toString().substring(0, 8))
                .price(new BigDecimal("199.00"))
                .initialStock(INITIAL_STOCK)
                .active(true)
                .build());

        FlashSaleDto flashSale = flashSaleService.createFlashSale(admin, FlashSaleRequest.builder()
                .name("Postgres Concurrency Test Sale")
                .startTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                .endTime(Instant.now().plus(1, ChronoUnit.HOURS))
                .active(true)
                .items(List.of(FlashSaleItemRequest.builder()
                        .productId(product.getId())
                        .salePrice(new BigDecimal("99.00"))
                        .saleStock(INITIAL_STOCK)
                        .build()))
                .build());

        // Delete Redis key so all 250 requests hit PostgreSQL SELECT FOR UPDATE directly
        stringRedisTemplate.delete("flashsale:stock:" + flashSale.getId() + ":" + product.getId());

        ExecutorService executor = Executors.newFixedThreadPool(50);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(CONCURRENT_ATTEMPTS);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < CONCURRENT_ATTEMPTS; i++) {
            final int idx = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    flashSaleService.purchaseFlashSaleItem(
                            buyer,
                            flashSale.getId(),
                            FlashSalePurchaseRequest.builder()
                                    .productId(product.getId())
                                    .quantity(1)
                                    .idempotencyKey("pg-conc-" + idx)
                                    .build(),
                            null);
                    successCount.incrementAndGet();
                } catch (Exception ignored) {
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertThat(doneLatch.await(60, TimeUnit.SECONDS)).isTrue();
        executor.shutdownNow();

        assertThat(successCount.get()).isEqualTo(INITIAL_STOCK);

        Inventory inv = inventoryRepository.findByProductId(product.getId()).orElseThrow();
        assertThat(inv.getReservedStock()).isEqualTo(INITIAL_STOCK);
        assertThat(inv.getAvailableStock()).isZero();
    }

    @Test
    void flashSaleRedisCounterSync_onCheckoutAndCancel_andIdempotencyIsolation() {
        User admin = userRepository.save(User.builder()
                .email("sync-admin-" + UUID.randomUUID() + "@flashcart.com")
                .passwordHash(passwordEncoder.encode("Admin@123"))
                .firstName("SyncAdmin")
                .role(UserRole.ADMIN)
                .enabled(true)
                .build());

        User userA = userRepository.save(User.builder()
                .email("sync-a-" + UUID.randomUUID() + "@flashcart.com")
                .passwordHash(passwordEncoder.encode("Buyer@123"))
                .firstName("UserA")
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .build());

        User userB = userRepository.save(User.builder()
                .email("sync-b-" + UUID.randomUUID() + "@flashcart.com")
                .passwordHash(passwordEncoder.encode("Buyer@123"))
                .firstName("UserB")
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .build());

        ProductDto product = productService.createProduct(ProductRequest.builder()
                .name("Redis Sync Mouse")
                .sku("RSYNC-" + UUID.randomUUID().toString().substring(0, 8))
                .price(new BigDecimal("100.00"))
                .initialStock(20)
                .active(true)
                .build());

        FlashSaleDto flashSale = flashSaleService.createFlashSale(admin, FlashSaleRequest.builder()
                .name("Sync Test Sale")
                .startTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                .endTime(Instant.now().plus(1, ChronoUnit.HOURS))
                .active(true)
                .items(List.of(FlashSaleItemRequest.builder()
                        .productId(product.getId())
                        .salePrice(new BigDecimal("60.00"))
                        .saleStock(10)
                        .build()))
                .build());

        String redisKey = "flashsale:stock:" + flashSale.getId() + ":" + product.getId();
        assertThat(stringRedisTemplate.opsForValue().get(redisKey)).isEqualTo("10");

        // Regular cart checkout consumes 2 units of flash sale item -> Redis syncs 10 -> 8
        cartService.addItem(userA.getId(), AddToCartRequest.builder()
                .productId(product.getId()).quantity(2).build());
        OrderDto cartOrder = orderService.checkout(userA, CheckoutRequest.builder()
                .shippingFullName("User A")
                .shippingAddressLine1("10 Main")
                .shippingCity("Bengaluru")
                .shippingState("KA")
                .shippingPostalCode("560001")
                .build(), null);
        assertThat(cartOrder.getTotalAmount()).isEqualByComparingTo("120.00");
        assertThat(stringRedisTemplate.opsForValue().get(redisKey)).isEqualTo("8");

        // Cancelling cartOrder restores Redis 8 -> 10 and DB sold_count 2 -> 0
        orderService.cancelOrder(userA, cartOrder.getId(), false);
        assertThat(stringRedisTemplate.opsForValue().get(redisKey)).isEqualTo("10");

        FlashSaleItem afterCancel = flashSaleItemRepository
                .findByFlashSaleIdAndProductId(flashSale.getId(), product.getId()).orElseThrow();
        assertThat(afterCancel.getSoldCount()).isZero();

        // Cross-user same Idempotency-Key creates separate orders without IDOR
        OrderDto fsOrderA = flashSaleService.purchaseFlashSaleItem(userA, flashSale.getId(),
                FlashSalePurchaseRequest.builder().productId(product.getId()).quantity(1).build(), "same-fs-key");
        OrderDto fsOrderB = flashSaleService.purchaseFlashSaleItem(userB, flashSale.getId(),
                FlashSalePurchaseRequest.builder().productId(product.getId()).quantity(1).build(), "same-fs-key");
        assertThat(fsOrderA.getId()).isNotEqualTo(fsOrderB.getId());
        assertThat(fsOrderA.getUserId()).isEqualTo(userA.getId());
        assertThat(fsOrderB.getUserId()).isEqualTo(userB.getId());
        assertThat(stringRedisTemplate.opsForValue().get(redisKey)).isEqualTo("8");
    }
}
