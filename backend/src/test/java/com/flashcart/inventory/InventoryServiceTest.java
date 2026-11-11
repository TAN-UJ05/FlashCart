package com.flashcart.inventory;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.ReservationStatus;
import com.flashcart.common.exception.InsufficientInventoryException;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.config.FlashSaleStockCache;
import com.flashcart.flashsale.entity.FlashSale;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.inventory.dto.StockAdjustmentRequest;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.entity.InventoryReservation;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.inventory.service.InventoryService;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.order.entity.Order;
import com.flashcart.order.repository.OrderRepository;
import com.flashcart.product.entity.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock private InventoryRepository inventoryRepository;
    @Mock private InventoryReservationRepository reservationRepository;
    @Mock private FlashSaleItemRepository flashSaleItemRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private OutboxService outboxService;
    @Mock private CacheInvalidationService cacheInvalidationService;
    @Mock private FlashSaleStockCache flashSaleStockCache;

    @InjectMocks
    private InventoryService inventoryService;

    private Product product;
    private Inventory inventory;
    private User user;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(inventoryService, "reservationTtlMinutes", 15L);
        product = Product.builder().id(UUID.randomUUID()).name("Laptop").sku("LAP-1").build();
        inventory = Inventory.builder()
                .id(UUID.randomUUID())
                .product(product)
                .totalStock(10)
                .reservedStock(2)
                .build();
        user = User.builder().id(UUID.randomUUID()).email("u@flashcart.com").build();
    }

    @Test
    void reserveStock_idempotentKey_returnsExistingWithoutDoubleReserve() {
        InventoryReservation existing = InventoryReservation.builder()
                .id(UUID.randomUUID())
                .inventory(inventory)
                .user(user)
                .quantity(3)
                .idempotencyKey("idem-1")
                .build();

        when(reservationRepository.findByIdempotencyKey("idem-1")).thenReturn(Optional.of(existing));

        InventoryReservation res = inventoryService.reserveStock(
                product.getId(), user, UUID.randomUUID(), null, 3, "idem-1");

        assertThat(res).isSameAs(existing);
        assertThat(inventory.getReservedStock()).isEqualTo(2);
        verify(inventoryRepository, never()).findByProductIdForUpdate(any());
    }

    @Test
    void reserveStock_idempotentKeyBelongsToDifferentUser_throwsUnauthorized() {
        User otherUser = User.builder().id(UUID.randomUUID()).email("other@flashcart.com").build();
        InventoryReservation existing = InventoryReservation.builder()
                .id(UUID.randomUUID())
                .inventory(inventory)
                .user(otherUser)
                .quantity(1)
                .idempotencyKey("shared-key")
                .build();

        when(reservationRepository.findByIdempotencyKey("shared-key")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> inventoryService.reserveStock(
                product.getId(), user, UUID.randomUUID(), null, 1, "shared-key"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void reserveStock_insufficientStock_throwsException() {
        when(reservationRepository.findByIdempotencyKey("idem-2")).thenReturn(Optional.empty());
        when(inventoryRepository.findByProductIdForUpdate(product.getId())).thenReturn(Optional.of(inventory));

        assertThatThrownBy(() -> inventoryService.reserveStock(
                product.getId(), user, UUID.randomUUID(), null, 9, "idem-2"))
                .isInstanceOf(InsufficientInventoryException.class);
        verify(reservationRepository, never()).save(any());
    }

    @Test
    void confirmOrderReservations_expiredReservation_returnsFalse() {
        UUID orderId = UUID.randomUUID();
        InventoryReservation expiredRes = InventoryReservation.builder()
                .id(UUID.randomUUID())
                .inventory(inventory)
                .orderId(orderId)
                .quantity(2)
                .status(ReservationStatus.CREATED)
                .expiresAt(Instant.now().minus(1, ChronoUnit.MINUTES))
                .build();

        when(reservationRepository.findByOrderIdForUpdate(orderId)).thenReturn(List.of(expiredRes));

        boolean confirmed = inventoryService.confirmOrderReservations(orderId);

        assertThat(confirmed).isFalse();
        verify(inventoryRepository, never()).save(any());
    }

    @Test
    void releaseOrderReservations_withFlashSaleItem_locksInventoryBeforeFlashSaleItemAndSyncsRedis() {
        UUID orderId = UUID.randomUUID();
        UUID flashSaleId = UUID.randomUUID();
        UUID flashSaleItemId = UUID.randomUUID();

        InventoryReservation res = InventoryReservation.builder()
                .id(UUID.randomUUID())
                .inventory(inventory)
                .orderId(orderId)
                .flashSaleItemId(flashSaleItemId)
                .quantity(2)
                .status(ReservationStatus.CREATED)
                .build();

        FlashSale sale = FlashSale.builder().id(flashSaleId).build();
        FlashSaleItem saleItem = FlashSaleItem.builder()
                .id(flashSaleItemId)
                .flashSale(sale)
                .product(product)
                .saleStock(10)
                .soldCount(4)
                .build();

        when(reservationRepository.findByOrderIdForUpdate(orderId)).thenReturn(List.of(res));
        when(reservationRepository.transitionFromCreated(eq(res.getId()), eq(ReservationStatus.RELEASED), isNull(), any(), any()))
                .thenReturn(1);
        when(inventoryRepository.findByIdForUpdate(inventory.getId())).thenReturn(Optional.of(inventory));
        when(flashSaleItemRepository.findByIdForUpdate(flashSaleItemId)).thenReturn(Optional.of(saleItem));
        doAnswer(inv -> {
            ((Runnable) inv.getArgument(0)).run();
            return null;
        }).when(flashSaleStockCache).runAfterCommit(any());

        inventoryService.releaseOrderReservations(orderId, ReservationStatus.RELEASED);

        assertThat(inventory.getReservedStock()).isZero();
        assertThat(saleItem.getSoldCount()).isEqualTo(2);

        InOrder lockOrder = inOrder(inventoryRepository, flashSaleItemRepository);
        lockOrder.verify(inventoryRepository).findByIdForUpdate(inventory.getId());
        lockOrder.verify(flashSaleItemRepository).findByIdForUpdate(flashSaleItemId);

        verify(flashSaleStockCache).incrementIfPresent(flashSaleId, product.getId(), 2);
    }

    @Test
    void expireSingleReservation_alreadyClaimedByOtherInstance_doesNothing() {
        UUID resId = UUID.randomUUID();
        when(reservationRepository.findById(resId)).thenReturn(Optional.of(
                InventoryReservation.builder().id(resId).inventory(inventory).quantity(2).build()));
        when(reservationRepository.claimExpiredReservation(eq(resId), any(Instant.class))).thenReturn(0);

        boolean result = inventoryService.expireSingleReservation(resId);

        assertThat(result).isFalse();
        verify(inventoryRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void expireSingleReservation_claimed_releasesStockAndCancelsPendingOrder() {
        UUID resId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        InventoryReservation res = InventoryReservation.builder()
                .id(resId)
                .inventory(inventory)
                .orderId(orderId)
                .quantity(2)
                .status(ReservationStatus.EXPIRED)
                .build();
        Order order = Order.builder().id(orderId).status(OrderStatus.PENDING).build();

        when(reservationRepository.claimExpiredReservation(eq(resId), any(Instant.class))).thenReturn(1);
        when(reservationRepository.findById(resId)).thenReturn(Optional.of(res));
        when(inventoryRepository.findByIdForUpdate(inventory.getId())).thenReturn(Optional.of(inventory));
        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(order));

        boolean result = inventoryService.expireSingleReservation(resId);

        assertThat(result).isTrue();
        assertThat(inventory.getReservedStock()).isZero();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        verify(outboxService).recordEvent(eq("Inventory"), any(), eq("InventoryReleased"), anyMap());

        InOrder lockOrder = inOrder(orderRepository, reservationRepository, inventoryRepository);
        lockOrder.verify(orderRepository).findByIdForUpdate(orderId);
        lockOrder.verify(reservationRepository).claimExpiredReservation(eq(resId), any(Instant.class));
        lockOrder.verify(inventoryRepository).findByIdForUpdate(inventory.getId());
    }

    @Test
    void adjustStock_belowReservedStock_throwsException() {
        when(inventoryRepository.findByProductIdForUpdate(product.getId())).thenReturn(Optional.of(inventory));

        assertThatThrownBy(() -> inventoryService.adjustStock(
                product.getId(), StockAdjustmentRequest.builder().newTotalStock(1).build()))
                .isInstanceOf(InvalidOperationException.class);
    }
}
