package com.flashcart.inventory.service;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.ReservationStatus;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.common.response.PageResponse;
import com.flashcart.config.CacheInvalidationService;
import com.flashcart.config.FlashSaleStockCache;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.inventory.dto.InventoryDto;
import com.flashcart.inventory.dto.StockAdjustmentRequest;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.entity.InventoryReservation;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.inventory.repository.InventoryReservationRepository;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.order.entity.Order;
import com.flashcart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final InventoryReservationRepository reservationRepository;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final OrderRepository orderRepository;
    private final OutboxService outboxService;
    private final CacheInvalidationService cacheInvalidationService;
    private final FlashSaleStockCache flashSaleStockCache;

    @Value("${flashcart.reservation.ttl-minutes:15}")
    private long reservationTtlMinutes;

    @Transactional(readOnly = true)
    public PageResponse<InventoryDto> listInventory(Pageable pageable) {
        Page<InventoryDto> page = inventoryRepository.findAllWithProduct(pageable).map(this::toDto);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public List<InventoryDto> getLowStockItems(int threshold) {
        return inventoryRepository.findLowStockInventories(threshold)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryDto getByProductId(UUID productId) {
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory for product", productId.toString()));
        return toDto(inventory);
    }

    @Transactional
    public Inventory lockInventoryByProductId(UUID productId) {
        return inventoryRepository.findByProductIdForUpdate(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory for product", productId.toString()));
    }

    @Transactional
    public Inventory lockInventoryById(UUID inventoryId) {
        return inventoryRepository.findByIdForUpdate(inventoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory", inventoryId.toString()));
    }

    @Transactional
    public InventoryDto adjustStock(UUID productId, StockAdjustmentRequest request) {
        Inventory inventory = inventoryRepository.findByProductIdForUpdate(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory for product", productId.toString()));

        int newTotal;
        if (request.getNewTotalStock() != null) {
            newTotal = request.getNewTotalStock();
        } else if (request.getAdjustment() != null) {
            newTotal = inventory.getTotalStock() + request.getAdjustment();
        } else {
            throw new InvalidOperationException("Either adjustment or newTotalStock must be provided");
        }

        if (newTotal < 0) {
            throw new InvalidOperationException("Total stock cannot be negative");
        }
        if (newTotal < inventory.getReservedStock()) {
            throw new InvalidOperationException(
                    "New total stock (" + newTotal + ") cannot be less than reserved stock (" + inventory.getReservedStock() + ")");
        }

        inventory.setTotalStock(newTotal);
        Inventory saved = inventoryRepository.save(inventory);
        cacheInvalidationService.evictProductCaches();
        return toDto(saved);
    }

    @Transactional
    public InventoryReservation reserveStock(
            UUID productId,
            User user,
            UUID orderId,
            UUID flashSaleItemId,
            int quantity,
            String idempotencyKey) {

        Optional<InventoryReservation> existing = reservationRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            assertReservationOwnership(existing.get(), user);
            return existing.get();
        }

        Inventory inventory = lockInventoryByProductId(productId);
        return createLockedReservation(inventory, user, orderId, flashSaleItemId, quantity, idempotencyKey);
    }

    /**
     * Reserve against an already-locked Inventory row so callers that also mutate FlashSaleItem
     * maintain the strict global lock order: Inventory -> FlashSaleItem.
     */
    @Transactional
    public InventoryReservation reserveLockedInventory(
            Inventory lockedInventory,
            User user,
            UUID orderId,
            UUID flashSaleItemId,
            int quantity,
            String idempotencyKey) {

        Optional<InventoryReservation> existing = reservationRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            assertReservationOwnership(existing.get(), user);
            return existing.get();
        }

        return createLockedReservation(lockedInventory, user, orderId, flashSaleItemId, quantity, idempotencyKey);
    }

    private InventoryReservation createLockedReservation(
            Inventory inventory,
            User user,
            UUID orderId,
            UUID flashSaleItemId,
            int quantity,
            String idempotencyKey) {

        inventory.reserve(quantity);
        inventoryRepository.save(inventory);

        InventoryReservation reservation = InventoryReservation.builder()
                .inventory(inventory)
                .user(user)
                .orderId(orderId)
                .flashSaleItemId(flashSaleItemId)
                .idempotencyKey(idempotencyKey)
                .quantity(quantity)
                .status(ReservationStatus.CREATED)
                .expiresAt(Instant.now().plus(reservationTtlMinutes, ChronoUnit.MINUTES))
                .build();

        InventoryReservation saved = reservationRepository.save(reservation);
        cacheInvalidationService.evictProductCaches();
        return saved;
    }

    /**
     * Atomically confirms all CREATED reservations for an order.
     * Returns false if any reservation has already expired or been released.
     */
    @Transactional
    public boolean confirmOrderReservations(UUID orderId) {
        List<InventoryReservation> reservations = sortByInventoryId(reservationRepository.findByOrderIdForUpdate(orderId));
        if (reservations.isEmpty()) {
            return false;
        }

        Instant now = Instant.now();
        for (InventoryReservation res : reservations) {
            if (res.getStatus() == ReservationStatus.CONFIRMED) {
                continue;
            }
            if (res.getStatus() != ReservationStatus.CREATED || res.getExpiresAt().isBefore(now)) {
                return false;
            }
        }

        for (InventoryReservation res : reservations) {
            if (res.getStatus() == ReservationStatus.CREATED) {
                int claimed = reservationRepository.transitionFromCreated(
                        res.getId(), ReservationStatus.CONFIRMED, now, null, now);
                if (claimed != 1) {
                    return false;
                }
                Inventory inventory = inventoryRepository.findByIdForUpdate(res.getInventory().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Inventory", res.getInventory().getId().toString()));
                inventory.confirm(res.getQuantity());
                inventoryRepository.save(inventory);
            }
        }

        cacheInvalidationService.evictProductCaches();
        return true;
    }

    /**
     * Releases all CREATED reservations for an order (e.g. cancellation or late payment cleanup).
     * Follows strict lock order: Inventory (ascending id) -> FlashSaleItem (ascending id).
     */
    @Transactional
    public void releaseOrderReservations(UUID orderId, ReservationStatus targetStatus) {
        List<InventoryReservation> reservations = sortByInventoryId(reservationRepository.findByOrderIdForUpdate(orderId));
        Instant now = Instant.now();
        List<FlashSaleRelease> flashSaleReleases = new ArrayList<>();

        for (InventoryReservation res : reservations) {
            if (res.getStatus() == ReservationStatus.CREATED) {
                int claimed = reservationRepository.transitionFromCreated(
                        res.getId(), targetStatus, null, now, now);
                if (claimed == 1) {
                    releaseInventoryOnly(res, "ORDER_" + targetStatus.name());
                    if (res.getFlashSaleItemId() != null) {
                        flashSaleReleases.add(new FlashSaleRelease(res.getFlashSaleItemId(), res.getQuantity()));
                    }
                }
            }
        }

        releaseFlashSaleItemsAndSyncRedis(flashSaleReleases);
        cacheInvalidationService.evictFlashSaleCaches();
    }

    /**
     * Restores total stock when a CONFIRMED order is refunded.
     * Follows strict lock order: Inventory (ascending id) -> FlashSaleItem (ascending id).
     */
    @Transactional
    public void restoreConfirmedOrderStock(UUID orderId) {
        List<InventoryReservation> reservations = sortByInventoryId(reservationRepository.findByOrderIdForUpdate(orderId));
        Instant now = Instant.now();
        List<FlashSaleRelease> flashSaleReleases = new ArrayList<>();

        for (InventoryReservation res : reservations) {
            if (res.getStatus() == ReservationStatus.CONFIRMED) {
                Inventory inventory = inventoryRepository.findByIdForUpdate(res.getInventory().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Inventory", res.getInventory().getId().toString()));
                inventory.setTotalStock(inventory.getTotalStock() + res.getQuantity());
                inventoryRepository.save(inventory);

                res.setStatus(ReservationStatus.RELEASED);
                res.setReleasedAt(now);
                reservationRepository.save(res);

                if (res.getFlashSaleItemId() != null) {
                    flashSaleReleases.add(new FlashSaleRelease(res.getFlashSaleItemId(), res.getQuantity()));
                }

                outboxService.recordEvent(
                        "Inventory",
                        inventory.getId().toString(),
                        "InventoryReleased",
                        Map.of(
                                "reservationId", res.getId().toString(),
                                "orderId", orderId.toString(),
                                "productId", inventory.getProduct().getId().toString(),
                                "quantity", res.getQuantity(),
                                "reason", "ORDER_REFUNDED"
                        )
                );
            }
        }

        releaseFlashSaleItemsAndSyncRedis(flashSaleReleases);
        cacheInvalidationService.evictFlashSaleCaches();
    }

    /**
     * Multi-instance safe expiry processor for a single reservation ID.
     * Follows global lock hierarchy: Order -> InventoryReservation -> Inventory -> FlashSaleItem.
     */
    @Transactional
    public boolean expireSingleReservation(UUID reservationId) {
        InventoryReservation res = reservationRepository.findById(reservationId).orElse(null);
        if (res == null) {
            return false;
        }

        Order lockedOrder = null;
        if (res.getOrderId() != null) {
            lockedOrder = orderRepository.findByIdForUpdate(res.getOrderId()).orElse(null);
        }

        Instant now = Instant.now();
        int claimed = reservationRepository.claimExpiredReservation(reservationId, now);
        if (claimed != 1) {
            return false; // Already claimed by another instance or confirmed/released
        }

        releaseInventoryOnly(res, "RESERVATION_EXPIRED");
        if (res.getFlashSaleItemId() != null) {
            releaseFlashSaleItemsAndSyncRedis(List.of(new FlashSaleRelease(res.getFlashSaleItemId(), res.getQuantity())));
        }

        if (lockedOrder != null) {
            if (lockedOrder.getStatus() == OrderStatus.PENDING
                    || lockedOrder.getStatus() == OrderStatus.PAYMENT_PENDING
                    || lockedOrder.getStatus() == OrderStatus.PAYMENT_FAILED) {
                lockedOrder.setStatus(OrderStatus.CANCELLED);
                orderRepository.save(lockedOrder);
            }
        }

        cacheInvalidationService.evictFlashSaleCaches();
        return true;
    }

    private void releaseInventoryOnly(InventoryReservation res, String reason) {
        Inventory inventory = inventoryRepository.findByIdForUpdate(res.getInventory().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Inventory", res.getInventory().getId().toString()));
        inventory.release(res.getQuantity());
        inventoryRepository.save(inventory);

        outboxService.recordEvent(
                "Inventory",
                inventory.getId().toString(),
                "InventoryReleased",
                Map.of(
                        "reservationId", res.getId().toString(),
                        "orderId", res.getOrderId() != null ? res.getOrderId().toString() : "",
                        "productId", inventory.getProduct().getId().toString(),
                        "quantity", res.getQuantity(),
                        "reason", reason
                )
        );
    }

    private void releaseFlashSaleItemsAndSyncRedis(List<FlashSaleRelease> releases) {
        if (releases.isEmpty()) {
            return;
        }
        List<FlashSaleRelease> sorted = releases.stream()
                .sorted(Comparator.comparing(FlashSaleRelease::flashSaleItemId))
                .toList();

        List<RedisCounterDelta> redisIncrements = new ArrayList<>();
        for (FlashSaleRelease release : sorted) {
            Optional<FlashSaleItem> itemOpt = flashSaleItemRepository.findByIdForUpdate(release.flashSaleItemId());
            if (itemOpt.isPresent()) {
                FlashSaleItem item = itemOpt.get();
                item.setSoldCount(Math.max(0, item.getSoldCount() - release.quantity()));
                flashSaleItemRepository.save(item);
                redisIncrements.add(new RedisCounterDelta(
                        item.getFlashSale().getId(),
                        item.getProduct().getId(),
                        release.quantity()
                ));
            }
        }

        if (!redisIncrements.isEmpty() && flashSaleStockCache != null) {
            flashSaleStockCache.runAfterCommit(() -> {
                for (RedisCounterDelta delta : redisIncrements) {
                    flashSaleStockCache.incrementIfPresent(delta.flashSaleId(), delta.productId(), delta.quantity());
                }
            });
        }
    }

    private List<InventoryReservation> sortByInventoryId(List<InventoryReservation> reservations) {
        return reservations.stream()
                .sorted(Comparator
                        .comparing((InventoryReservation r) -> r.getInventory().getId())
                        .thenComparing(InventoryReservation::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private void assertReservationOwnership(InventoryReservation reservation, User user) {
        if (reservation.getUser() != null && user != null
                && !reservation.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have permission to use this idempotency key");
        }
    }

    public InventoryDto toDto(Inventory inv) {
        return InventoryDto.builder()
                .id(inv.getId())
                .productId(inv.getProduct().getId())
                .productName(inv.getProduct().getName())
                .productSku(inv.getProduct().getSku())
                .totalStock(inv.getTotalStock())
                .reservedStock(inv.getReservedStock())
                .availableStock(inv.getAvailableStock())
                .updatedAt(inv.getUpdatedAt())
                .build();
    }

    private record FlashSaleRelease(UUID flashSaleItemId, int quantity) {}

    private record RedisCounterDelta(UUID flashSaleId, UUID productId, int quantity) {}
}
