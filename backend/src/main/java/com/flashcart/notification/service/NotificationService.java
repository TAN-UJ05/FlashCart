package com.flashcart.notification.service;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.NotificationStatus;
import com.flashcart.common.enums.NotificationType;
import com.flashcart.common.response.PageResponse;
import com.flashcart.kafka.outbox.OutboxService;
import com.flashcart.notification.dto.NotificationDto;
import com.flashcart.notification.entity.Notification;
import com.flashcart.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final OutboxService outboxService;

    @Transactional
    public NotificationDto queueNotification(User user, NotificationType type, String subject, String body) {
        Notification notification = Notification.builder()
                .user(user)
                .type(type)
                .subject(subject)
                .body(body)
                .status(NotificationStatus.PENDING)
                .build();
        notification = notificationRepository.save(notification);

        notification.setStatus(NotificationStatus.QUEUED);
        notification = notificationRepository.save(notification);

        outboxService.recordEvent(
                "Notification",
                notification.getId().toString(),
                "NotificationRequested",
                Map.of(
                        "notificationId", notification.getId().toString(),
                        "userId", user.getId().toString(),
                        "email", user.getEmail(),
                        "type", type.name(),
                        "subject", subject
                )
        );

        return toDto(notification);
    }

    @Transactional
    public void deliverNotification(UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId).orElse(null);
        if (notification == null || notification.getStatus() == NotificationStatus.DELIVERED) {
            return;
        }

        try {
            // Mock email provider delivery
            log.info("[MOCK EMAIL] To: {} | Type: {} | Subject: {} | Body: {}",
                    notification.getUser().getEmail(),
                    notification.getType(),
                    notification.getSubject(),
                    notification.getBody());

            notification.setStatus(NotificationStatus.DELIVERED);
            notification.setSentAt(Instant.now());
            notificationRepository.save(notification);
        } catch (Exception ex) {
            notification.setRetryCount(notification.getRetryCount() + 1);
            notification.setStatus(NotificationStatus.FAILED);
            notificationRepository.save(notification);
            log.error("Failed to deliver notification {}: {}", notificationId, ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationDto> getUserNotifications(UUID userId, Pageable pageable) {
        Page<NotificationDto> page = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toDto);
        return PageResponse.from(page);
    }

    public NotificationDto toDto(Notification notification) {
        return NotificationDto.builder()
                .id(notification.getId())
                .type(notification.getType())
                .subject(notification.getSubject())
                .body(notification.getBody())
                .status(notification.getStatus())
                .sentAt(notification.getSentAt())
                .retryCount(notification.getRetryCount())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
