package com.flashcart.inventory.repository;

import com.flashcart.inventory.entity.Inventory;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<Inventory, UUID> {
    Optional<Inventory> findByProductId(UUID productId);

    List<Inventory> findByProductIdIn(Collection<UUID> productIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.product.id = :productId")
    Optional<Inventory> findByProductIdForUpdate(@Param("productId") UUID productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.id = :id")
    Optional<Inventory> findByIdForUpdate(@Param("id") UUID id);

    @Query("SELECT i FROM Inventory i JOIN FETCH i.product p WHERE (i.totalStock - i.reservedStock) <= :threshold ORDER BY (i.totalStock - i.reservedStock) ASC")
    List<Inventory> findLowStockInventories(@Param("threshold") int threshold);

    @Query(value = "SELECT i FROM Inventory i JOIN FETCH i.product p",
           countQuery = "SELECT COUNT(i) FROM Inventory i")
    Page<Inventory> findAllWithProduct(Pageable pageable);

    @Query("SELECT COUNT(i) FROM Inventory i WHERE (i.totalStock - i.reservedStock) <= :threshold")
    long countLowStock(@Param("threshold") int threshold);
}
