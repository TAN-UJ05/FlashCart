package com.flashcart.common.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class RateLimitService {

    private static final int MAX_TRACKED_BUCKETS = 10_000;

    private final Map<String, Bucket> authBuckets = createBoundedLruMap();
    private final Map<String, Bucket> flashSaleBuckets = createBoundedLruMap();

    @Value("${flashcart.rate-limit.auth-requests-per-minute:30}")
    private int authRequestsPerMinute;

    @Value("${flashcart.rate-limit.flash-sale-requests-per-minute:120}")
    private int flashSaleRequestsPerMinute;

    public boolean tryConsumeAuth(String key) {
        String normalizedKey = normalizeKey(key);
        Bucket bucket = getOrCreateBucket(authBuckets, normalizedKey, authRequestsPerMinute);
        return bucket.tryConsume(1);
    }

    public boolean tryConsumeFlashSale(String key) {
        String normalizedKey = normalizeKey(key);
        Bucket bucket = getOrCreateBucket(flashSaleBuckets, normalizedKey, flashSaleRequestsPerMinute);
        return bucket.tryConsume(1);
    }

    private Bucket getOrCreateBucket(Map<String, Bucket> map, String key, int capacityPerMinute) {
        synchronized (map) {
            Bucket bucket = map.get(key);
            if (bucket == null) {
                bucket = createBucket(capacityPerMinute);
                map.put(key, bucket);
            }
            return bucket;
        }
    }

    private String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return "unknown";
        }
        return key.length() > 128 ? key.substring(0, 128) : key;
    }

    private Bucket createBucket(int capacityPerMinute) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(capacityPerMinute)
                .refillGreedy(capacityPerMinute, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    private static Map<String, Bucket> createBoundedLruMap() {
        return Collections.synchronizedMap(new LinkedHashMap<>(1024, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Bucket> eldest) {
                return size() > MAX_TRACKED_BUCKETS;
            }
        });
    }
}
