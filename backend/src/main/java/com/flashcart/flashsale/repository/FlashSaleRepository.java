package com.flashcart.flashsale.repository;

import com.flashcart.flashsale.entity.FlashSale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlashSaleRepository extends JpaRepository<FlashSale, UUID> {
    @Query("""
            SELECT DISTINCT fs FROM FlashSale fs
            LEFT JOIN FETCH fs.items i
            LEFT JOIN FETCH i.product p
            WHERE fs.active = true AND fs.startTime <= :now AND fs.endTime >= :now
            ORDER BY fs.endTime ASC
            """)
    List<FlashSale> findLiveFlashSales(@Param("now") Instant now);

    @Query("""
            SELECT DISTINCT fs FROM FlashSale fs
            LEFT JOIN FETCH fs.items i
            LEFT JOIN FETCH i.product p
            WHERE fs.active = true AND fs.endTime >= :now
            ORDER BY fs.startTime ASC
            """)
    List<FlashSale> findActiveAndUpcomingFlashSales(@Param("now") Instant now);

    @Query("""
            SELECT DISTINCT fs FROM FlashSale fs
            LEFT JOIN FETCH fs.items i
            LEFT JOIN FETCH i.product p
            ORDER BY fs.createdAt DESC
            """)
    List<FlashSale> findAllWithItems();

    @Query("""
            SELECT fs FROM FlashSale fs
            LEFT JOIN FETCH fs.items i
            LEFT JOIN FETCH i.product p
            WHERE fs.id = :id
            """)
    Optional<FlashSale> findByIdWithItems(@Param("id") UUID id);
}
