package com.flashcart.kafka.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashcart.config.KafkaConfig;
import com.flashcart.kafka.event.DomainEvent;
import com.flashcart.kafka.outbox.ProcessedEvent;
import com.flashcart.kafka.outbox.ProcessedEventRepository;
import com.flashcart.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "flashcart.kafka.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class KafkaEventConsumer {

    private final ProcessedEventRepository processedEventRepository;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = {
            KafkaConfig.TOPIC_ORDER_CREATED,
            KafkaConfig.TOPIC_PAYMENT_SUCCEEDED,
            KafkaConfig.TOPIC_PAYMENT_FAILED,
            KafkaConfig.TOPIC_INVENTORY_RELEASED,
            KafkaConfig.TOPIC_NOTIFICATION_REQUESTED
    }, groupId = "flashcart-group")
    @Transactional
    public void handleEvent(String payload) throws Exception {
        DomainEvent event = objectMapper.readValue(payload, DomainEvent.class);

        if (event.getEventId() == null) {
            log.warn("Received event without eventId, skipping");
            return;
        }

        // Idempotent consumer check via processed_events table
        if (processedEventRepository.existsByEventId(event.getEventId())) {
            log.debug("Duplicate event {} already processed, skipping", event.getEventId());
            return;
        }

        log.info("Processing Kafka event [eventId={}, type={}, aggregateType={}, aggregateId={}]",
                event.getEventId(), event.getEventType(), event.getAggregateType(), event.getAggregateId());

        if ("NotificationRequested".equals(event.getEventType()) && event.getData() != null) {
            Object notificationIdObj = event.getData().get("notificationId");
            if (notificationIdObj != null) {
                notificationService.deliverNotification(UUID.fromString(notificationIdObj.toString()));
            }
        }

        processedEventRepository.save(ProcessedEvent.builder()
                .eventId(event.getEventId())
                .processedAt(Instant.now())
                .build());
    }
}
