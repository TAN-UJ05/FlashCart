package com.flashcart.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FlashSaleStockCache {

    private static final String KEY_PREFIX = "flashsale:stock:";
    private static final long KEY_NOT_FOUND = -999L;
    private static final long INSUFFICIENT_STOCK = -1L;

    private static final DefaultRedisScript<Long> DECREMENT_IF_AVAILABLE_SCRIPT = createScript(
            """
            local current = redis.call('GET', KEYS[1])
            if not current then
                return -999
            end
            local stock = tonumber(current)
            local qty = tonumber(ARGV[1])
            if not stock or not qty or qty <= 0 then
                return -999
            end
            if stock < qty then
                return -1
            end
            return redis.call('DECRBY', KEYS[1], qty)
            """
    );

    private static final DefaultRedisScript<Long> INCREMENT_IF_PRESENT_SCRIPT = createScript(
            """
            local current = redis.call('GET', KEYS[1])
            if not current then
                return -999
            end
            local qty = tonumber(ARGV[1])
            if not qty or qty <= 0 then
                return tonumber(current) or 0
            end
            return redis.call('INCRBY', KEYS[1], qty)
            """
    );

    private static final DefaultRedisScript<Long> CLAMP_DECREMENT_IF_PRESENT_SCRIPT = createScript(
            """
            local current = redis.call('GET', KEYS[1])
            if not current then
                return -999
            end
            local stock = tonumber(current)
            local qty = tonumber(ARGV[1])
            if not stock or not qty or qty <= 0 then
                return -999
            end
            local decr = math.min(stock, qty)
            if decr <= 0 then
                return 0
            end
            return redis.call('DECRBY', KEYS[1], decr)
            """
    );

    private final StringRedisTemplate stringRedisTemplate;

    public enum AdmissionResult {
        RESERVED,
        SOLD_OUT,
        BYPASSED
    }

    public AdmissionResult tryDecrementIfAvailable(UUID flashSaleId, UUID productId, int quantity) {
        if (stringRedisTemplate == null || quantity <= 0) {
            return AdmissionResult.BYPASSED;
        }
        try {
            Long result = stringRedisTemplate.execute(
                    DECREMENT_IF_AVAILABLE_SCRIPT,
                    List.of(buildKey(flashSaleId, productId)),
                    String.valueOf(quantity)
            );
            if (result == null || result == KEY_NOT_FOUND) {
                return AdmissionResult.BYPASSED;
            }
            if (result == INSUFFICIENT_STOCK || result < 0) {
                return AdmissionResult.SOLD_OUT;
            }
            return AdmissionResult.RESERVED;
        } catch (Exception ex) {
            log.warn("Redis flash sale admission bypassed [flashSaleId={}, productId={}]: {}",
                    flashSaleId, productId, ex.getMessage());
            return AdmissionResult.BYPASSED;
        }
    }

    public void incrementIfPresent(UUID flashSaleId, UUID productId, int quantity) {
        if (stringRedisTemplate == null || quantity <= 0) {
            return;
        }
        try {
            stringRedisTemplate.execute(
                    INCREMENT_IF_PRESENT_SCRIPT,
                    List.of(buildKey(flashSaleId, productId)),
                    String.valueOf(quantity)
            );
        } catch (Exception ex) {
            log.warn("Failed to restore Redis flash sale counter [flashSaleId={}, productId={}]: {}",
                    flashSaleId, productId, ex.getMessage());
        }
    }

    public void decrementIfPresent(UUID flashSaleId, UUID productId, int quantity) {
        if (stringRedisTemplate == null || quantity <= 0) {
            return;
        }
        try {
            stringRedisTemplate.execute(
                    CLAMP_DECREMENT_IF_PRESENT_SCRIPT,
                    List.of(buildKey(flashSaleId, productId)),
                    String.valueOf(quantity)
            );
        } catch (Exception ex) {
            log.warn("Failed to sync decrement to Redis flash sale counter [flashSaleId={}, productId={}]: {}",
                    flashSaleId, productId, ex.getMessage());
        }
    }

    public void warm(UUID flashSaleId, UUID productId, int remainingStock, Instant endTime) {
        if (stringRedisTemplate == null || endTime == null || !endTime.isAfter(Instant.now())) {
            return;
        }
        try {
            Duration ttl = Duration.between(Instant.now(), endTime).plusMinutes(5);
            stringRedisTemplate.opsForValue().set(
                    buildKey(flashSaleId, productId),
                    String.valueOf(Math.max(0, remainingStock)),
                    ttl
            );
        } catch (Exception ex) {
            log.warn("Failed to warm Redis flash sale counter [flashSaleId={}, productId={}]: {}",
                    flashSaleId, productId, ex.getMessage());
        }
    }

    public void evict(UUID flashSaleId, UUID productId) {
        if (stringRedisTemplate == null) {
            return;
        }
        try {
            stringRedisTemplate.delete(buildKey(flashSaleId, productId));
        } catch (Exception ex) {
            log.warn("Failed to evict Redis flash sale counter [flashSaleId={}, productId={}]: {}",
                    flashSaleId, productId, ex.getMessage());
        }
    }

    public void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    public static String buildKey(UUID flashSaleId, UUID productId) {
        return KEY_PREFIX + flashSaleId + ":" + productId;
    }

    private static DefaultRedisScript<Long> createScript(String lua) {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptText(lua);
        script.setResultType(Long.class);
        return script;
    }
}
