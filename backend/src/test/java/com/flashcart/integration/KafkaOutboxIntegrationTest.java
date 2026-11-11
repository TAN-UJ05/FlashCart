package com.flashcart.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashcart.auth.dto.RegisterRequest;
import com.flashcart.auth.service.AuthService;
import com.flashcart.common.enums.OutboxStatus;
import com.flashcart.config.KafkaConfig;
import com.flashcart.kafka.consumer.KafkaEventConsumer;
import com.flashcart.kafka.event.DomainEvent;
import com.flashcart.kafka.outbox.OutboxEvent;
import com.flashcart.kafka.outbox.OutboxEventRepository;
import com.flashcart.kafka.outbox.OutboxPublisher;
import com.flashcart.kafka.outbox.ProcessedEventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class KafkaOutboxIntegrationTest extends AbstractIntegrationTest {

    @Autowired private AuthService authService;
    @Autowired private OutboxEventRepository outboxEventRepository;
    @Autowired private OutboxPublisher outboxPublisher;
    @Autowired private ProcessedEventRepository processedEventRepository;
    @Autowired private KafkaEventConsumer kafkaEventConsumer;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void outboxPublisherAndIdempotentConsumer_publishAndDeduplicate() throws Exception {
        String email = "kafka-" + UUID.randomUUID() + "@flashcart.com";
        authService.register(RegisterRequest.builder()
                .email(email).password("Pass@12345").firstName("Kafka").build());

        // OutboxPublisher writes pending NotificationRequested event to Kafka
        outboxPublisher.publishPendingEvents();

        List<OutboxEvent> published = outboxEventRepository.findAll().stream()
                .filter(e -> e.getStatus() == OutboxStatus.PUBLISHED)
                .toList();
        assertThat(published).isNotEmpty();

        // Direct idempotent consumer verification (replay same event twice)
        DomainEvent testEvent = DomainEvent.of("OrderCreated", "Order", UUID.randomUUID().toString(),
                Map.of("orderNumber", "FC-TEST-1"));
        String json = objectMapper.writeValueAsString(testEvent);

        kafkaEventConsumer.handleEvent(json);
        kafkaEventConsumer.handleEvent(json);

        assertThat(processedEventRepository.existsByEventId(testEvent.getEventId())).isTrue();
        assertThat(KafkaConfig.TOPIC_ORDER_CREATED).isEqualTo("flashcart.order.created");
    }
}
