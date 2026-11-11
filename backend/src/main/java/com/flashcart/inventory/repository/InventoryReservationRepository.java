package com.flashcart.inventory.repository;

import com.flashcart.common.enums.ReservationStatus;
import com.flashcart.inventory.entity.InventoryReservation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryReservationRepository extends JpaRepository<InventoryReservation, UUID> {
    Optional<InventoryReservation> findByIdempotencyKey(String idempotencyKey);

    Optional<InventoryReservation> findFirstByIdempotencyKeyStartingWith(String prefix);

    List<InventoryReservation> findByOrderId(UUID orderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM InventoryReservation r WHERE r.orderId = :orderId ORDER BY r.inventory.id ASC, r.id ASC")
    List<InventoryReservation> findByOrderIdForUpdate(@Param("orderId") UUID orderId);

    @Query("SELECT r.id FROM InventoryReservation r WHERE r.status = com.flashcart.common.enums.ReservationStatus.CREATED AND r.expiresAt < :now")
    List<UUID> findExpiredCreatedReservationIds(@Param("now") Instant now);

    @Modifying
    @Query("""
            UPDATE InventoryReservation r
            SET r.status = com.flashcart.common.enums.ReservationStatus.EXPIRED,
                r.releasedAt = :now,
                r.updatedAt = :now
            WHERE r.id = :id AND r.status = com.flashcart.common.enums.ReservationStatus.CREATED
            """)
    int claimExpiredReservation(@Param("id") UUID id, @Param("now") Instant now);

    @Modifying
    @Query("""
            UPDATE InventoryReservation r
            SET r.status = :newStatus,
                r.confirmedAt = :confirmedAt,
                r.releasedAt = :releasedAt,
                r.updatedAt = :now
            WHERE r.id = :id AND r.status = com.flashcart.common.enums.ReservationStatus.CREATED
            """)
    int transitionFromCreated(@Param("id") UUID id,
                              @Param("newStatus") ReservationStatus newStatus,
                              @Param("confirmedAt") Instant confirmedAt,
                              @Param("releasedAt") Instant releasedAt,
                              @Param("now") Instant now);
}
