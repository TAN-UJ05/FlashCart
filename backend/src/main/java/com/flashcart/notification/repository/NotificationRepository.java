package com.flashcart.notification.repository;

import com.flashcart.common.enums.NotificationStatus;
import com.flashcart.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Notification> findByStatusOrderByCreatedAtAsc(NotificationStatus status);
}
