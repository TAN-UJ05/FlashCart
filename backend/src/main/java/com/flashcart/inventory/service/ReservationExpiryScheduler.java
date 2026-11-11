package com.flashcart.inventory.service;

import com.flashcart.inventory.repository.InventoryReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReservationExpiryScheduler {

    private final InventoryReservationRepository reservationRepository;
    private final InventoryService inventoryService;

    @Scheduled(fixedDelay = 30000)
    public void releaseExpiredReservations() {
        List<UUID> expiredIds = reservationRepository.findExpiredCreatedReservationIds(Instant.now());
        if (expiredIds.isEmpty()) {
            return;
        }

        int releasedCount = 0;
        for (UUID reservationId : expiredIds) {
            try {
                if (inventoryService.expireSingleReservation(reservationId)) {
                    releasedCount++;
                }
            } catch (Exception ex) {
                log.error("Error expiring reservation {}: {}", reservationId, ex.getMessage(), ex);
            }
        }

        if (releasedCount > 0) {
            log.info("Released {} expired inventory reservations", releasedCount);
        }
    }
}
