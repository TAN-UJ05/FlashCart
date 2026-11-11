# FlashCart — Task Checklist

Legend: NOT STARTED | IN PROGRESS | BLOCKED | COMPLETED | VERIFIED

## Phase 0: Environment & Initialization
- [VERIFIED] Environment inspection (Windows 11 x64, JDK 22 / `--release 21`, Maven 3.9.14, Node 24.13.0, npm 11.6.2, Docker 29.9.2, docker-compose v5.6.1, Git 2.50.1)
- [VERIFIED] Git repository initialized (`master`)
- [VERIFIED] `AGENTS.md` created
- [VERIFIED] `.project/` memory system created

## Phase 1: Architecture & Foundation
- [VERIFIED] Backend: Maven project structure (`pom.xml`, 14 modular packages)
- [VERIFIED] Backend: `FlashCartApplication.java` + explicit `@Transactional` & module layering
- [VERIFIED] Backend: `application.yml`, `application-dev.yml`, `application-test.yml`, `application-prod.yml`
- [VERIFIED] Frontend: Vite 8 + React 19 + TypeScript 5 project
- [VERIFIED] Frontend: Tailwind CSS v3 (`^3.4.17`) configuration
- [VERIFIED] Frontend: Base routing & layout shells (`MainLayout`, `AdminLayout`, protected routes)
- [VERIFIED] Docker Compose: PostgreSQL 16, Redis 7, Kafka 3.7, Zookeeper, Backend, Frontend Nginx, Prometheus, Grafana
- [VERIFIED] Backend: Health & Prometheus endpoints (`/actuator/health`, `/actuator/prometheus`)
- [VERIFIED] Backend: `GlobalExceptionHandler` + `ApiResponse` + `CorrelationIdFilter`
- [VERIFIED] Backend: CORS configuration (`SecurityConfig`)
- [VERIFIED] `.gitignore` & `.env.example`

## Phase 2: Database Design
- [VERIFIED] ER diagram & schema docs (`docs/DATABASE_DESIGN.md`)
- [VERIFIED] Flyway `V1__initial_schema.sql` (19 tables + `CHECK` / `UNIQUE` invariants)
- [VERIFIED] Flyway `V2__indexes.sql` (`pg_trgm` GIN search index + partial indexes)
- [VERIFIED] Flyway `V3__seed_data.sql` (users, categories, 30 products, inventory, live flash sale)
- [VERIFIED] JPA entities validated against schema (`ddl-auto: validate`)
- [VERIFIED] Spring Data repositories

## Phase 3: Authentication
- [VERIFIED] User registration API + welcome notification event
- [VERIFIED] Login API (15m JWT + `HttpOnly; SameSite=Strict` 7d refresh cookie)
- [VERIFIED] Logout API (refresh token revocation)
- [VERIFIED] Refresh token rotation API + reuse detection revoking user token family
- [VERIFIED] Forgot password & reset password APIs
- [VERIFIED] `JwtAuthenticationFilter` + Spring Security RBAC (`ROLE_CUSTOMER`, `ROLE_ADMIN`)
- [VERIFIED] Rate limiting on auth endpoints (`Bucket4j` `30 req/min` in dev/prod)
- [VERIFIED] Frontend: Login, Registration, Forgot Password, Reset Password pages & Protected routes
- [VERIFIED] Auth integration tests (`AuthIntegrationTest` — Testcontainers `2/2` PASS)

## Phase 4: Products & Categories
- [VERIFIED] Category CRUD (admin) & public category tree
- [VERIFIED] Product CRUD (admin) with cache eviction
- [VERIFIED] Product listing API (paginated, filtered, sorted, batched queries + Redis `@Cacheable` `#55`)
- [VERIFIED] Product search API (`pg_trgm` GIN index)
- [VERIFIED] Product details API + image upload/local serving
- [VERIFIED] Frontend: Home, Catalog, Product Detail, Category browsing, Search results, Admin Product/Category pages

## Phase 5: Inventory
- [VERIFIED] `Inventory` entity (`total_stock`, `reserved_stock`, DB `CHECK (reserved_stock <= total_stock)`)
- [VERIFIED] Atomic reserve (`SELECT FOR UPDATE`) & atomic release
- [VERIFIED] `InventoryReservation` lifecycle (`CREATED`, `CONFIRMED`, `RELEASED`, `EXPIRED`)
- [VERIFIED] Multi-instance safe reservation expiry scheduler (`UPDATE ... WHERE status = 'CREATED'`)
- [VERIFIED] `idempotency_key` (`UNIQUE NOT NULL`) on reservations + per-user scoping
- [VERIFIED] Frontend: Admin inventory adjustment page
- [VERIFIED] Inventory concurrency & unit tests (`InventoryServiceTest` `8/8`, `OrderPaymentIntegrationTest` `3/3`)

## Phase 6: Cart & Orders
- [VERIFIED] `Cart` & `CartItem` entities + CRUD APIs
- [VERIFIED] Server-side price recalculation at checkout
- [VERIFIED] Checkout API + `Order` lifecycle (`PENDING`, `CONFIRMED`, `CANCELLED`, etc.)
- [VERIFIED] Immutable `OrderItem` purchase-time snapshots (`BatchSize = 50`)
- [VERIFIED] Order history, detail, and customer cancellation APIs + IDOR enforcement
- [VERIFIED] Frontend: Shopping Cart, Checkout, Order History, Order Detail pages

## Phase 7: Payment Simulator
- [VERIFIED] `Payment` entity with `UNIQUE` `idempotency_key`
- [VERIFIED] Payment initiation & simulated callback API (`SUCCEEDED`, `FAILED`, `TIMEOUT`)
- [VERIFIED] Duplicate callback idempotency & late-payment auto-refund after expiry
- [VERIFIED] Refund simulation + Order/Reservation state transitions
- [VERIFIED] Frontend: Payment Result simulator page + Unit (`7/7`) & Testcontainers (`3/3`) tests

## Phase 8: Flash-Sale Engine
- [VERIFIED] `FlashSale` & `FlashSaleItem` entities + Admin CRUD
- [VERIFIED] Concurrent-safe purchase API (atomic SQL `incrementSoldCountIfAvailable` + `SELECT FOR UPDATE` + `idempotency_key`)
- [VERIFIED] Non-authoritative Redis Lua admission pre-filter (`FlashSaleStockCache`) + rollback compensation + direct-PG fallback test
- [VERIFIED] Frontend: Live Flash Sales page (countdown) & Admin Flash Sales manager
- [VERIFIED] Concurrency test: `10,000` concurrent attempts vs `100` stock (`FlashSaleConcurrencyIntegrationTest` `3/3` PASS + k6 `flash-sale-concurrency.js` verified `100/100` in PG, `0` oversells)

## Phase 9: Redis
- [VERIFIED] Caches (`products`, `productDetail`, `categories`, `flashSales`) with TTLs & mutation eviction (`PageResponse` polymorphic JSON verified)
- [VERIFIED] Graceful `CacheErrorHandler` degradation & Redis-bypassed concurrency test

## Phase 10: Kafka
- [VERIFIED] Kafka topic setup (`order.events` / `flashcart.*` topics + `.DLT` dead-letter topics)
- [VERIFIED] Transactional Outbox (`outbox_events` + `@Transactional(MANDATORY)` `OutboxService` + `FOR UPDATE SKIP LOCKED` `OutboxPublisher`)
- [VERIFIED] Idempotent consumer (`KafkaEventConsumer` + `processed_events` deduplication + `DefaultErrorHandler` retries/DLT)
- [VERIFIED] `KAFKA_ENABLED` toggle for zero-Kafka production demos & Testcontainers verification (`KafkaOutboxIntegrationTest` `1/1` PASS)

## Phase 11: Notifications & Analytics
- [VERIFIED] Notification tracking (`notifications` table) + mock email delivery (`REGISTRATION`, `PASSWORD_RESET`, `ORDER_CONFIRMATION`, `PAYMENT_FAILED`) observed in runtime & Testcontainers logs
- [VERIFIED] Admin analytics API backed by live PostgreSQL aggregations
- [VERIFIED] Frontend: Admin Dashboard & Recharts Analytics page

## Phase 12: Complete Frontend
- [VERIFIED] All customer pages (`Home`, `Products`, `ProductDetail`, `FlashSales`, `Cart`, `Checkout`, `PaymentResult`, `Orders`, `OrderDetail`, `Profile`, `Login`, `Register`, `ForgotPassword`, `ResetPassword`)
- [VERIFIED] All admin pages (`Dashboard`, `Products`, `Categories`, `Inventory`, `FlashSales`, `Orders`, `Customers`, `Analytics`)
- [VERIFIED] Vitest (`11/11`) + TypeScript build + ESLint (`0` errors) + Playwright E2E (`2/2` PASS)

## Phase 13: Testing
- [VERIFIED] Backend unit tests: `34/34` PASS
- [VERIFIED] Backend Testcontainers integration tests: `9/9` PASS (total `43/43` PASS in `02:49 min` post-`#55`)
- [VERIFIED] Frontend Vitest unit tests: `11/11` PASS
- [VERIFIED] Playwright E2E tests (`chromium`): `2/2` PASS (`19.6 s`) post-`#55`
- [VERIFIED] All executed outputs recorded in `.project/TEST_RESULTS.md`

## Phase 14: Performance & Observability
- [VERIFIED] `k6` scripts (`product-browsing.js`, `checkout-flow.js`, `flash-sale-concurrency.js`) executed against live Docker Compose stack post-`#55`
- [VERIFIED] Prometheus targets `up` + Grafana `FlashCart Backend Overview` dashboard provisioned & verified
- [VERIFIED] N+1 catalog query bottleneck identified & resolved (`#55`), lifting `500`-VU bridge throughput to `294.46 req/s` (`p95 = 57.12 ms`, `0.00%` error)
- [VERIFIED] Benchmark results documented in `docs/PERFORMANCE.md` & `.project/TEST_RESULTS.md`

## Phase 15: Docker & CI/CD
- [VERIFIED] `backend/Dockerfile` & `frontend/Dockerfile` + `.dockerignore` files
- [VERIFIED] `docker-compose.yml` 8-service stack verified cleanly from fresh volume reset (`docker-compose down -v; docker-compose up -d --no-build`)
- [VERIFIED] `.github/workflows/ci.yml` configured (Java 21 Maven + Testcontainers, Node 22 frontend lint/build/test, TruffleHog secret check)

## Phase 16: Cloud Deployment
- [COMPLETED] 2026 Cloud provider & free-tier vs paid cost comparison (`docs/DEPLOYMENT.md`)
- [COMPLETED] `application-prod.yml` hardening (`prod` secrets, TLS Redis, cookie security, `KAFKA_ENABLED` toggle)
- [NOT STARTED] User approval & cloud account authorization
- [NOT STARTED] Live public cloud deployment & public URL verification

## Phase 17: Documentation & Handover
- [VERIFIED] `README.md` complete with verified results
- [VERIFIED] All 14 engineering guides in `docs/` complete & synchronized (`README.md` + 14 in `docs/` = 15 total)
- [VERIFIED] `.project/` state files updated with true verified facts
- [VERIFIED] Final QA/secret/git hygiene audit & local milestone Git commits on `master`
