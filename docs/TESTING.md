# FlashCart Testing Strategy & Execution Guide

FlashCart enforces correctness—especially zero overselling, idempotency, and end-to-end user journeys—through a five-layer testing pyramid.

---

## 1. Testing Pyramid Overview

```
             /\
            /  \       E2E Browser Flows (Playwright: tests/e2e/)
           /----\
          /      \     Load & Rush Tests (k6: tests/load/)
         /--------\
        /          \   Integration & Concurrency (JUnit 5 + Testcontainers: PG, Redis, Kafka)
       /------------\
      /              \ Unit Tests (Backend: JUnit 5 + Mockito | Frontend: Vitest + RTL)
     /----------------\
```

---

## 2. Backend Unit Tests (JUnit 5 + Mockito)

**Scope**: Pure business-logic verification without external infrastructure:
- `AuthServiceTest` (registration, duplicate email, refresh token rotation, reuse detection revoking all user tokens)
- `InventoryServiceTest` (available stock math, insufficient inventory exception, reservation confirm/release/expiry claim)
- `CartServiceTest` (server-side price recalculation, quantity updates)
- `OrderServiceTest` (state machine transitions, immutable `OrderItem` snapshot creation, IDOR ownership checks)
- `PaymentServiceTest` (idempotency key deduplication, late payment after expiry auto-refund behavior)
- `ProductServiceTest` (batched page loading eliminating N+1 queries, Redis `PageResponse<ProductDto>` JSON round-trip serialization)
- `RateLimitAndDtoTest` (Bucket4j auth/flash-sale rate limiting, DTO validation annotations)

**How to Run**:
```powershell
mvn test -f backend/pom.xml -Dtest="*ServiceTest"
```

---

## 3. Backend Integration Tests (Testcontainers)

**Policy**: Never mock away PostgreSQL in integration or concurrency tests. Integration tests extend `AbstractIntegrationTest`, spinning up real **Testcontainers** (`postgres:16-alpine`, `redis:7-alpine`, `confluentinc/cp-kafka:7.6.0`) with Flyway migrations (`V1`, `V2`, `V3`) and real SQL constraints:
- `AuthIntegrationTest`: Full register/login/refresh/reuse-detection/logout/reset flow
- `OrderPaymentIntegrationTest`: End-to-end checkout, payment confirmation, failure release, and late-payment auto-refund
- `KafkaOutboxIntegrationTest`: Transactional outbox relay + idempotent `processed_events` consumption
- `FlashSaleConcurrencyIntegrationTest`: 10,000-attempt concurrency rush & direct PostgreSQL locking verification

**Test Profile (`backend/src/test/resources/application-test.yml`)**:
- `spring.kafka.listener.auto-startup: false` by default (`AbstractIntegrationTest` overrides to `true` for integration suite)
- `flashcart.cache.enabled: false` in unit/mock tests (enabled in `AbstractIntegrationTest`)
- Relaxed rate limits (`auth-requests-per-minute: 10000`, `flash-sale-requests-per-minute: 100000` in `AbstractIntegrationTest`) so high-concurrency tests are not blocked by Bucket4j.

**How to Run All Backend Tests** *(requires Docker running)*:
```powershell
mvn test -f backend/pom.xml -Dspring.profiles.active=test
```

---

## 4. High-Concurrency Oversell Test (Critical Invariant)

**Test Class**: `com.flashcart.integration.FlashSaleConcurrencyIntegrationTest`

**What It Verifies**:
1. `concurrentFlashSalePurchase_100Stock_10000Attempts_zeroOverselling`: Launches **10,000 concurrent purchase attempts** across a 100-thread `ExecutorService` synchronized via `CountDownLatch` against **100 units** of flash-sale stock:
   - `successCount == 100`
   - `failureCount == 9,900`
   - PostgreSQL `inventory.reserved_stock == 100`, `availableStock == 0`
   - PostgreSQL `flash_sale_items.sold_count == 100`, `remainingStock == 0`
2. `concurrentFlashSalePurchase_directPostgresLockingWithoutRedis_zeroOverselling`: Deletes the Redis pre-warmed key (`flashsale:stock:*`) and sends 250 concurrent attempts against 25 stock, proving PostgreSQL `SELECT FOR UPDATE` alone prevents overselling without Redis.

**How to Run**:
```powershell
mvn test -f backend/pom.xml -Dtest=FlashSaleConcurrencyIntegrationTest -Dspring.profiles.active=test
```

---

## 5. Frontend Tests (Vitest + React Testing Library)

**Scope**: Component rendering, form validation (React Hook Form + Zod), auth context handling, cart interactions, and UI states (`frontend/src/test/`).

**How to Run**:
```powershell
cd frontend ; npm test -- --run
```

---

## 6. End-to-End Tests (Playwright)

**Location**: `tests/e2e/` (`playwright.config.ts` and `tests/e2e/tests/customer-journey.spec.ts`).

**Flows Tested**:
1. **Customer Purchase Journey**: Browse products → search (`laptop`) → register new user → add product to cart → verify cart badge → checkout shipping form → place order → payment simulator (`simulate-success-button`) → verify order appears in `/orders`.
2. **Admin Catalog Management**: Login as `admin@flashcart.com` → navigate to `/admin/products` → create new product → verify product appears in list.

**How to Run**:
```powershell
# Start full stack first (or let Playwright webServer start docker-compose)
docker-compose up --build -d

cd tests/e2e ; npm install ; npx playwright install chromium ; npx playwright test
```

---

## 7. Load & Stress Tests (Grafana k6)

**Location**: `tests/load/`
- `product-browsing.js`: Catalog read & search throughput (`500` VUs, asserts `p(95) < 500ms`, `< 1%` errors)
- `checkout-flow.js`: Authenticated cart & order reads (`200` VUs)
- `flash-sale-concurrency.js`: 10,000-attempt flash-sale spike against 100-stock item

**How to Run**:
```powershell
k6 run tests/load/product-browsing.js
k6 run tests/load/checkout-flow.js
k6 run -e SUMMARY_PATH=tests/load/results/flash-sale-results.json tests/load/flash-sale-concurrency.js

# Without a global k6 binary via Docker Desktop bridge (recommended zero-NAT invocation):
docker run --rm --network flashcart_default -v "${PWD}/tests/load:/scripts" grafana/k6 run -e BASE_URL=http://backend:8080 /scripts/flash-sale-concurrency.js

# Or targeting localhost via host-gateway:
docker run --rm --add-host=host.docker.internal:host-gateway -v "${PWD}/tests/load:/scripts" grafana/k6 run -e BASE_URL=http://host.docker.internal:8080 /scripts/flash-sale-concurrency.js
```

---

## 8. Continuous Integration (GitHub Actions)

Defined in `.github/workflows/ci.yml`:
1. **`backend-build`**: Sets up Java 21, runs `mvn compile -f backend/pom.xml` and `mvn test -f backend/pom.xml -Dspring.profiles.active=test` (using Testcontainers on the Ubuntu runner), and uploads Surefire XML reports.
2. **`frontend-build`**: Uses Node 22 (`^20.19.0 || >=22.12.0` for Vite 8), installs npm packages (`npm ci`), lints (`npm run lint`), builds production bundle (`npm run build`), runs Vitest (`npm test -- --run`), and uploads `frontend/dist/`.
3. **`security-check`**: Runs `trufflesecurity/trufflehog` verified secret scanning across full repository history (`fetch-depth: 0`).

---

## 9. Coverage & Verification Goals

- **Mandatory Zero-Oversell Gate**: `0` oversells under concurrent load.
- **Line/Branch Focus**: Priority on `inventory`, `flashsale`, `payment`, `order`, `auth` services and security filters (`>= 80%` target on core domain services).
- **Truthfulness Rule**: Every executed test result is recorded in `.project/TEST_RESULTS.md` only after actual execution and observed output. See `.project/TEST_RESULTS.md` for current verified status.
