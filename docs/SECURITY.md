# FlashCart Security Architecture

This document details FlashCart's implemented authentication, authorization, rate limiting, input validation, and transport security controls, as well as remaining risks and hardening checklists.

---

## 1. Authentication Flow (JWT + HttpOnly Refresh Cookies)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as React SPA (Memory Token)
    participant Auth as AuthController / AuthService
    participant DB as PostgreSQL (users, refresh_tokens)

    User->>Browser: Submit login form (email + password)
    Browser->>Auth: POST /api/v1/auth/login (withCredentials: true)
    Auth->>DB: Load user & verify BCrypt hash
    Auth->>DB: Persist opaque RefreshToken (expires_at = +7d, used = false)
    Auth-->>Browser: 200 OK { accessToken (15m JWT) } + Set-Cookie: refreshToken=...; HttpOnly; SameSite=Strict; Path=/api/v1/auth
    Note over Browser: Access token stored in JS module memory (NOT localStorage)

    Browser->>Auth: API Request + Authorization: Bearer <accessToken>
    Auth-->>Browser: 200 OK (stateless verification via JwtAuthenticationFilter)

    Note over Browser,Auth: When access token expires (401) or page reloads:
    Browser->>Auth: POST /api/v1/auth/refresh (browser automatically sends HttpOnly cookie)
    Auth->>DB: Lookup refreshToken
    alt Token already used (used == true) — REUSE DETECTED!
        Auth->>DB: Revoke ALL active refresh tokens for userId!
        Auth-->>Browser: 401 Unauthorized (Session terminated)
    else Valid unused token
        Auth->>DB: Mark old token used = true + issue new refreshToken
        Auth-->>Browser: 200 OK { new accessToken } + Set-Cookie: new refreshToken
    end
```

### Why In-Memory Access Token + `HttpOnly` Refresh Cookie?
- Storing JWTs in `localStorage` or `sessionStorage` exposes them to any XSS script.
- Storing the short-lived access token (`15 minutes`, `flashcart.jwt.access-token-expiry-ms: 900000`) strictly in React memory combined with an `HttpOnly`, `SameSite=Strict` refresh cookie (`7 days`, `flashcart.jwt.refresh-token-expiry-ms: 604800000`) mitigates token exfiltration via XSS while protecting the refresh endpoint against cross-site request forgery (`SameSite=Strict`).

---

## 2. Password Hashing & Token Design

- **Password Hashing**: `BCryptPasswordEncoder` (Spring Security default cost factor `10`). Plaintext passwords are never logged, cached, or stored.
- **JWT Signing (`JwtTokenProvider`)**:
  - Uses JJWT `0.12.6` with HMAC-SHA256 (`Keys.hmacShaKeyFor(jwtSecret.getBytes(UTF_8))`).
  - Payload includes `sub` (user email), `roles` claim (`ROLE_CUSTOMER` / `ROLE_ADMIN`), `iat`, and `exp`.
  - Requires `FLASHCART_JWT_SECRET` of at least 32 characters (64+ recommended).
- **Refresh Token Rotation & Reuse Detection**:
  - Each `/api/v1/auth/refresh` call marks the presented `RefreshToken` row `used = true` and issues a fresh token.
  - If a stolen token or stale replay submits an already-used token (`used == true` or `revokedAt != null`), the backend treats it as token theft, revokes **all** refresh tokens belonging to that user, and forces re-authentication.
- **Password Reset**:
  - Single-use random token stored in `password_reset_tokens` with short expiration (`used = true` upon reset).

---

## 3. Spring Security Filter Chain & RBAC

Implemented in `com.flashcart.auth.security.SecurityConfig`:

1. **Session Policy**: `SessionCreationPolicy.STATELESS` (no HTTP sessions).
2. **CORS**: Configured via `CorsConfigurationSource` (`flashcart.cors.allowed-origins`, defaulting to `http://localhost:3000`, `allowCredentials = true`).
3. **JSON Error Handlers**: Custom `authenticationEntryPoint` returns `401 Unauthorized` (`UNAUTHORIZED`), and `accessDeniedHandler` returns `403 Forbidden` (`FORBIDDEN`) in standard `ApiResponse` JSON format.
4. **Route Access Rules**:
   - **Public Auth**: `/api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`
   - **Public GET Catalog**: `/api/v1/products/**`, `/api/v1/categories/**`, `/api/v1/flash-sales/**`, `/api/v1/images/**`, `/api/v1/health`
   - **Observability / Docs**: `/actuator/health/**`, `/actuator/info`, `/actuator/prometheus`, `/v3/api-docs/**`, `/swagger-ui/**`
   - **Admin Only (`hasRole("ADMIN")`)**: `/api/v1/admin/**` (plus `@EnableMethodSecurity` for method-level `@PreAuthorize("hasRole('ADMIN')")` enforcement on product/category/flash-sale write endpoints)
   - **Authenticated Users**: All remaining routes (`/api/v1/cart/**`, `/api/v1/orders/**`, `/api/v1/payments/**`, `/api/v1/users/**`, `/api/v1/auth/me`, flash-sale purchase endpoints).
5. **JWT Filter (`JwtAuthenticationFilter`)**: Extracts `Bearer <token>`, validates signature and expiry, loads `UserDetails`, checks `userDetails.isEnabled()`, and populates `SecurityContextHolder`.

---

## 4. IDOR Prevention (Insecure Direct Object Reference)

Using UUIDs helps prevent casual enumeration, **but UUIDs alone are not authorization**. Every user-scoped resource enforces ownership in the service layer against the authenticated `User` extracted from `SecurityContextHolder`:
- **Orders**: `GET /api/v1/orders/{id}`, `POST /api/v1/orders/{id}/cancel`, and customer refund eligibility (`PaymentService` blocks customer self-refunds once an order reaches `PROCESSING`/`SHIPPED`/`DELIVERED`) check `order.getUser().getId().equals(currentUser.getId())` (unless `ADMIN`).
- **Idempotency Key Scoping**: `IdempotencyKeyUtils` namespaces checkout and flash-sale idempotency keys by authenticated `userId` (`userId + ":" + scope + ":" + rawKey`) and services explicitly verify resource ownership on replay—preventing cross-user order exposure via predictable client keys.
- **Addresses**: `PUT/DELETE /api/v1/users/me/addresses/{id}` verify the address belongs to the authenticated user.
- **Payments**: `POST /api/v1/payments/...` and `GET /api/v1/payments/order/{orderId}` verify the target order belongs to the authenticated caller.
- **Cart**: Always resolved via `currentUser.getId()`, never from a client-supplied `userId` parameter.

---

## 5. Rate Limiting (`RateLimitService` + Bucket4j)

Implemented using **Bucket4j `8.10.1`** with token-bucket greedy refill per minute and bounded **10,000-entry LRU caches** (preventing unbounded heap growth under IP-spray attacks):
- **Authentication endpoints** (`/login`, `/register`, `/forgot-password`, `/reset-password`): `30` requests/minute per client key (`flashcart.rate-limit.auth-requests-per-minute: 30` in `application.yml`). `AuthController` uses `request.getRemoteAddr()` by default and ignores spoofable `X-Forwarded-For` headers unless `flashcart.rate-limit.trust-proxy=true` is explicitly enabled behind a trusted proxy.
- **Flash-sale purchase endpoints**: `120` requests/minute (`flashcart.rate-limit.flash-sale-requests-per-minute: 120`) keyed by authenticated user ID to dampen bot scraping and tight retry loops.
- Rejections return `429 Too Many Requests` (`RATE_LIMITED`) cleanly.

---

## 6. Injection, XSS, Validation & Secrets Protection

- **SQL Injection**: All Spring Data JPA queries and `@Query` definitions use parameterized bindings (`:param` / `?1`); zero string concatenation in SQL.
- **Server-Side Pricing Authority**: Cart subtotals, checkout totals, and flash-sale unit prices are always fetched from `products` / `flash_sale_items` on the server—client payloads never dictate prices.
- **Entity Isolation**: JPA entities are never returned from controllers or deserialized directly from request bodies; DTOs validate inputs with Jakarta Bean Validation (`@NotBlank`, `@Email`, `@Min`, `@Positive`, `@Size`).
- **Uploaded File Validation**: Product image uploads sanitize filenames, enforce allowed image MIME types/extensions, and respect Spring's multipart cap (`max-file-size: 5MB`, `max-request-size: 10MB`).
- **Secret Management**: `.env` files are gitignored; only `.env.example` with placeholders is committed. GitHub Actions CI runs `trufflesecurity/trufflehog` on every push/PR.
- **Correlation Tracking**: `CorrelationIdFilter` assigns an `X-Correlation-ID` header and SLF4J MDC key (`correlationId`) to every request for audit traceability.

---

## 7. Known Security Risks & Production Hardening Checklist

| Control | Dev Status | Required Production Hardening |
|---|---|---|
| Refresh cookie `Secure` flag | `false` (`FLASHCART_COOKIE_SECURE=false` for HTTP localhost) | Set `FLASHCART_COOKIE_SECURE=true` behind HTTPS/TLS |
| JWT secret | Dev fallback only in `application-dev.yml` / `application-test.yml` (omitted in base `application.yml`) | Require strong 256+ bit `FLASHCART_JWT_SECRET` in vault/env (startup fails fast if missing) |
| Bucket4j backing store | Bounded 10k-entry in-memory LRU per JVM (`trust-proxy=false` default) | Back Bucket4j with Redis `LettuceBasedProxyManager` for multi-replica clusters; set `trust-proxy=true` only behind a trusted reverse proxy |
| Actuator `/prometheus` & Swagger UI | Public locally for convenience | Restrict `/actuator/prometheus` and `/swagger-ui.html` to internal network / admin auth |
| Account lockout / CAPTCHA | Rate-limited per IP/email | Add progressive backoff or CAPTCHA on repeated failed logins if exposed to public internet |
