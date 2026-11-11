package com.flashcart.inventory.entity;

import com.flashcart.product.entity.Product;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "inventory")
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", unique = true, nullable = false)
    private Product product;

    @Column(nullable = false)
    @Builder.Default
    private int totalStock = 0;

    @Column(nullable = false)
    @Builder.Default
    private int reservedStock = 0;

    /**
     * Optimistic locking version field
     */
    @Version
    private Long version;

    @LastModifiedDate
    private Instant updatedAt;

    /**
     * Returns available stock: totalStock - reservedStock.
     * This invariant is enforced by DB constraint reserved_lte_total.
     */
    public int getAvailableStock() {
        return totalStock - reservedStock;
    }

    /**
     * Atomically reserve the given quantity.
     * Throws if insufficient stock available.
     */
    public void reserve(int quantity) {
        if (getAvailableStock() < quantity) {
            throw new com.flashcart.common.exception.InsufficientInventoryException(
                    "Insufficient stock for product: " + product.getId() +
                    ". Available: " + getAvailableStock() + ", Requested: " + quantity);
        }
        this.reservedStock += quantity;
    }

    /**
     * Release reserved stock back.
     */
    public void release(int quantity) {
        this.reservedStock = Math.max(0, this.reservedStock - quantity);
    }

    /**
     * Confirm reservation — deduct from total stock.
     */
    public void confirm(int quantity) {
        this.totalStock = Math.max(0, this.totalStock - quantity);
        this.reservedStock = Math.max(0, this.reservedStock - quantity);
    }
}
