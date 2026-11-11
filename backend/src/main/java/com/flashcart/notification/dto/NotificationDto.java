package com.flashcart.notification.dto;

import com.flashcart.common.enums.NotificationStatus;
import com.flashcart.common.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDto {
    private UUID id;
    private NotificationType type;
    private String subject;
    private String body;
    private NotificationStatus status;
    private Instant sentAt;
    private int retryCount;
    private Instant createdAt;
}
