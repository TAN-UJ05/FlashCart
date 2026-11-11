package com.flashcart.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class CacheInvalidationService {

    private final CacheManager cacheManager;

    public void evictProductCaches() {
        evictAll(RedisConfig.CACHE_PRODUCTS);
        evictAll(RedisConfig.CACHE_PRODUCT_DETAIL);
    }

    public void evictCategoryCaches() {
        evictAll(RedisConfig.CACHE_CATEGORIES);
        evictProductCaches();
    }

    public void evictFlashSaleCaches() {
        evictAll(RedisConfig.CACHE_FLASH_SALES);
        evictProductCaches();
    }

    public void evictAll(String cacheName) {
        try {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.clear();
            }
        } catch (Exception ex) {
            log.warn("Failed to evict cache {}: {}", cacheName, ex.getMessage());
        }
    }
}
