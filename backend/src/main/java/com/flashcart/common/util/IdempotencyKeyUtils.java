package com.flashcart.common.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

public final class IdempotencyKeyUtils {

    private static final int MAX_BASE_KEY_LENGTH = 210;

    private IdempotencyKeyUtils() {}

    public static String resolveRawKey(String headerKey, String bodyKey) {
        if (headerKey != null && !headerKey.isBlank()) {
            return headerKey.trim();
        }
        if (bodyKey != null && !bodyKey.isBlank()) {
            return bodyKey.trim();
        }
        return null;
    }

    public static String scopeForUser(UUID userId, String namespace, String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            return null;
        }
        String trimmed = rawKey.trim();
        String prefix = userId + ":" + namespace + ":";
        String candidate = prefix + trimmed;
        if (candidate.length() <= MAX_BASE_KEY_LENGTH) {
            return candidate;
        }
        return prefix + sha256Hex(trimmed);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }
}
