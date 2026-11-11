package com.flashcart.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DomainEvent {
    private String eventId;
    private String eventType;
    private String aggregateType;
    private String aggregateId;
    private Instant occurredAt;
    private Map<String, Object> data;

    public static DomainEvent of(String eventType, String aggregateType, String aggregateId, Map<String, Object> data) {
        return DomainEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .eventType(eventType)
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .occurredAt(Instant.now())
                .data(data)
                .build();
    }
}
