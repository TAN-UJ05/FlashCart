package com.flashcart.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashcart.common.ratelimit.RateLimitService;
import com.flashcart.product.dto.ProductImageDto;
import com.flashcart.user.dto.AddressDto;
import com.flashcart.user.dto.AddressRequest;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitAndDtoTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void rateLimitService_enforcesPerKeyLimitAndBoundsMemory() {
        RateLimitService service = new RateLimitService();
        ReflectionTestUtils.setField(service, "authRequestsPerMinute", 3);
        ReflectionTestUtils.setField(service, "flashSaleRequestsPerMinute", 5);

        assertThat(service.tryConsumeAuth("10.0.0.1")).isTrue();
        assertThat(service.tryConsumeAuth("10.0.0.1")).isTrue();
        assertThat(service.tryConsumeAuth("10.0.0.1")).isTrue();
        assertThat(service.tryConsumeAuth("10.0.0.1")).isFalse();

        // Separate key still allowed
        assertThat(service.tryConsumeAuth("10.0.0.2")).isTrue();

        // Flood unique keys beyond MAX_TRACKED_BUCKETS (10,000) and confirm bounded cap holds
        for (int i = 0; i < 10_500; i++) {
            service.tryConsumeFlashSale("ip-" + i);
        }
        java.util.Map<?, ?> map = (java.util.Map<?, ?>) ReflectionTestUtils.getField(service, "flashSaleBuckets");
        assertThat(map).isNotNull();
        assertThat(map.size()).isLessThanOrEqualTo(10_000);
    }

    @Test
    void booleanDtoProperties_serializeAndDeserializeAsIsDefaultAndIsPrimaryOnly() throws Exception {
        AddressDto addressDto = AddressDto.builder()
                .id(UUID.randomUUID())
                .fullName("Jane")
                .addressLine1("123 Main")
                .city("Bengaluru")
                .state("KA")
                .postalCode("560001")
                .isDefault(true)
                .build();

        String addressJson = objectMapper.writeValueAsString(addressDto);
        assertThat(addressJson).contains("\"isDefault\":true");
        assertThat(addressJson).doesNotContain("\"default\"");

        String reqJson = "{\"fullName\":\"Jane\",\"addressLine1\":\"123 Main\",\"city\":\"Bengaluru\",\"state\":\"KA\",\"postalCode\":\"560001\",\"isDefault\":true}";
        AddressRequest req = objectMapper.readValue(reqJson, AddressRequest.class);
        assertThat(req.isDefault()).isTrue();

        ProductImageDto imgDto = ProductImageDto.builder()
                .id(UUID.randomUUID())
                .imageUrl("/api/v1/images/seed-electronics.svg")
                .isPrimary(true)
                .build();

        String imgJson = objectMapper.writeValueAsString(imgDto);
        assertThat(imgJson).contains("\"isPrimary\":true");
        assertThat(imgJson).doesNotContain("\"primary\"");
    }
}
