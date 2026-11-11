package com.flashcart.kafka.outbox;

import com.flashcart.common.enums.OutboxStatus;
import com.flashcart.config.KafkaConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
@ConditionalOnProperty(name = "flashcart.kafka.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class OutboxPublisher {

    private static final int MAX_RETRIES = 5;

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Scheduled(fixedDelay = 2000)
    @Transactional
    public void publishPendingEvents() {
        List<OutboxEvent> pending = outboxEventRepository.findPendingBatchForPublish(OutboxStatus.PENDING.name());
        if (pending.isEmpty()) {
            return;
        }

        for (OutboxEvent event : pending) {
            String topic = resolveTopic(event.getEventType());
            try {
                kafkaTemplate.send(topic, event.getAggregateId(), event.getPayload())
                        .get(5, TimeUnit.SECONDS);
                event.setStatus(OutboxStatus.PUBLISHED);
                event.setPublishedAt(Instant.now());
                outboxEventRepository.save(event);
            } catch (Exception ex) {
                int retries = event.getRetryCount() + 1;
                event.setRetryCount(retries);
                if (retries >= MAX_RETRIES) {
                    event.setStatus(OutboxStatus.FAILED);
                    log.error("Outbox event {} permanently failed after {} retries: {}", event.getId(), retries, ex.getMessage());
                } else {
                    log.warn("Failed to publish outbox event {} to topic {} (attempt {}): {}",
                            event.getId(), topic, retries, ex.getMessage());
                }
                outboxEventRepository.save(event);
            }
        }
    }

    public String resolveTopic(String eventType) {
        return switch (eventType) {
            case "OrderCreated" -> KafkaConfig.TOPIC_ORDER_CREATED;
            case "PaymentSucceeded" -> KafkaConfig.TOPIC_PAYMENT_SUCCEEDED;
            case "PaymentFailed" -> KafkaConfig.TOPIC_PAYMENT_FAILED;
            case "InventoryReleased" -> KafkaConfig.TOPIC_INVENTORY_RELEASED;
            case "NotificationRequested" -> KafkaConfig.TOPIC_NOTIFICATION_REQUESTED;
            default -> KafkaConfig.TOPIC_ORDER_CREATED;
        };
    }
}
