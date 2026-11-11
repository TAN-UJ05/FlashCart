package com.flashcart.kafka.outbox;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {
    @Query(value = "SELECT * FROM outbox_events WHERE status = :status ORDER BY created_at ASC LIMIT 100 FOR UPDATE SKIP LOCKED",
           nativeQuery = true)
    List<OutboxEvent> findPendingBatchForPublish(@Param("status") String status);
}
