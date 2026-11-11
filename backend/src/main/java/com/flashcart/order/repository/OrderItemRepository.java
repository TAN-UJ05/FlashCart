package com.flashcart.order.repository;

import com.flashcart.common.enums.OrderStatus;
import com.flashcart.order.entity.OrderItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
    @Query("""
            SELECT oi.productId, oi.productName, oi.productSku,
                   SUM(oi.quantity), SUM(oi.totalPrice)
            FROM OrderItem oi
            JOIN oi.order o
            WHERE o.status IN :statuses
            GROUP BY oi.productId, oi.productName, oi.productSku
            ORDER BY SUM(oi.quantity) DESC
            """)
    List<Object[]> findTopSellingProducts(@Param("statuses") Collection<OrderStatus> statuses, Pageable pageable);
}
