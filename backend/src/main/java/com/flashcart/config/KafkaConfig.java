package com.flashcart.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
@ConditionalOnProperty(name = "flashcart.kafka.enabled", havingValue = "true", matchIfMissing = true)
public class KafkaConfig {

    public static final String TOPIC_ORDER_CREATED = "flashcart.order.created";
    public static final String TOPIC_PAYMENT_SUCCEEDED = "flashcart.payment.succeeded";
    public static final String TOPIC_PAYMENT_FAILED = "flashcart.payment.failed";
    public static final String TOPIC_INVENTORY_RELEASED = "flashcart.inventory.released";
    public static final String TOPIC_NOTIFICATION_REQUESTED = "flashcart.notification.requested";

    @Bean
    public NewTopic orderCreatedTopic() {
        return TopicBuilder.name(TOPIC_ORDER_CREATED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic orderCreatedDltTopic() {
        return TopicBuilder.name(TOPIC_ORDER_CREATED + ".DLT").partitions(1).replicas(1).build();
    }

    @Bean
    public NewTopic paymentSucceededTopic() {
        return TopicBuilder.name(TOPIC_PAYMENT_SUCCEEDED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic paymentSucceededDltTopic() {
        return TopicBuilder.name(TOPIC_PAYMENT_SUCCEEDED + ".DLT").partitions(1).replicas(1).build();
    }

    @Bean
    public NewTopic paymentFailedTopic() {
        return TopicBuilder.name(TOPIC_PAYMENT_FAILED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic paymentFailedDltTopic() {
        return TopicBuilder.name(TOPIC_PAYMENT_FAILED + ".DLT").partitions(1).replicas(1).build();
    }

    @Bean
    public NewTopic inventoryReleasedTopic() {
        return TopicBuilder.name(TOPIC_INVENTORY_RELEASED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic notificationRequestedTopic() {
        return TopicBuilder.name(TOPIC_NOTIFICATION_REQUESTED).partitions(3).replicas(1).build();
    }

    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> kafkaTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate);
        // Retry twice with 1 second delay before routing to <topic>.DLT
        return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2L));
    }
}
