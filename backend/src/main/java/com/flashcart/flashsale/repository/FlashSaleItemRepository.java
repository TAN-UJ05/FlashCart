package com.flashcart.flashsale.repository;

import com.flashcart.flashsale.entity.FlashSaleItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlashSaleItemRepository extends JpaRepository<FlashSaleItem, UUID> {
    Optional<FlashSaleItem> findByFlashSaleIdAndProductId(UUID flashSaleId, UUID productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT fsi FROM FlashSaleItem fsi JOIN FETCH fsi.flashSale fs JOIN FETCH fsi.product p WHERE fsi.id = :id")
    Optional<FlashSaleItem> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT fsi FROM FlashSaleItem fsi JOIN FETCH fsi.flashSale fs JOIN FETCH fsi.product p WHERE fsi.flashSale.id = :flashSaleId AND fsi.product.id = :productId")
    Optional<FlashSaleItem> findByFlashSaleIdAndProductIdForUpdate(@Param("flashSaleId") UUID flashSaleId, @Param("productId") UUID productId);

    @Query("""
            SELECT fsi FROM FlashSaleItem fsi
            JOIN FETCH fsi.flashSale fs
            WHERE fsi.product.id = :productId
              AND fs.active = true
              AND fs.startTime <= :now
              AND fs.endTime >= :now
            """)
    Optional<FlashSaleItem> findLiveByProductId(@Param("productId") UUID productId, @Param("now") Instant now);

    @Query("""
            SELECT fsi FROM FlashSaleItem fsi
            JOIN FETCH fsi.flashSale fs
            WHERE fsi.product.id IN :productIds
              AND fs.active = true
              AND fs.startTime <= :now
              AND fs.endTime >= :now
            """)
    List<FlashSaleItem> findLiveByProductIds(@Param("productIds") Collection<UUID> productIds, @Param("now") Instant now);

    @Modifying
    @Query("UPDATE FlashSaleItem fsi SET fsi.soldCount = fsi.soldCount + :qty WHERE fsi.id = :id AND (fsi.soldCount + :qty) <= fsi.saleStock")
    int incrementSoldCountIfAvailable(@Param("id") UUID id, @Param("qty") int qty);

    @Modifying
    @Query(value = "UPDATE flash_sale_items SET sold_count = GREATEST(0, sold_count - :qty), updated_at = NOW() WHERE id = :id", nativeQuery = true)
    int decrementSoldCount(@Param("id") UUID id, @Param("qty") int qty);
}
