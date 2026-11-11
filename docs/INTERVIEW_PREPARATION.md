# FlashCart Interview Preparation Guide

A deep, implementation-grounded engineering reference covering FlashCart's architecture, concurrency control, PostgreSQL design, Spring Boot internals, Kafka transactional outbox, Redis caching, security, and scalability.

---

## Project Pitches

### 30-Second Pitch
> "I built **FlashCart**, a full-stack e-commerce platform engineered around high-concurrency inventory reservation and flash sales using Java 21, Spring Boot 3.4, PostgreSQL 16, Redis, Apache Kafka, and React + TypeScript. Its centerpiece is zero-overselling inventory management backed by PostgreSQL pessimistic row locking (`SELECT FOR UPDATE`), database `CHECK` constraints, idempotency keys, and an outbox-backed event pipeline."

### 1-Minute Pitch
> "FlashCart is a modular-monolith e-commerce platform built to handle the classic flash-sale problem—100 units of limited stock hit by 10,000 concurrent buyers—without overselling or double-charging. Rather than trusting application-level locks or non-authoritative caches, inventory reservations and flash-sale decrements happen inside ACID PostgreSQL transactions using `SELECT ... FOR UPDATE`, atomic conditional updates, `UNIQUE` idempotency keys, and `CHECK (reserved_stock <= total_stock)` constraints. Unpaid reservations expire automatically via a multi-instance-safe scheduler using atomic `UPDATE ... WHERE status = 'CREATED'` claims, and payment callbacks are strictly idempotent with automatic refunds for late callbacks arriving after expiry. Domain events flow reliably through a Transactional Outbox to Kafka with idempotent consumers (`processed_events`) and dead-letter topics."

### 3-Minute Architecture Walkthrough
> "FlashCart is organized into 14 cohesive Spring Boot modules (`auth`, `user`, `category`, `product`, `inventory`, `cart`, `order`, `payment`, `flashsale`, `notification`, `admin`, `analytics`, `kafka`, `common`) backed by a single PostgreSQL 16 database managed with Flyway.
>
> **1. Request & Security Layer**: Every request receives a 12-char `X-Correlation-ID` in `CorrelationIdFilter` for log tracing, passes Bucket4j rate limiting on `/auth` and `/flash-sales`, and is authenticated statelessly via short-lived JWT access tokens (15m, in React memory) paired with rotated `HttpOnly` `SameSite=Strict` refresh cookies (7d) with reuse detection.
>
> **2. Catalog & Read Optimization**: Product browsing and categories use Redis look-aside caching (`RedisCacheManager` with 5m/15m/30s TTLs) and a `CacheErrorHandler` that gracefully falls back to PostgreSQL if Redis goes down. Search uses PostgreSQL's `pg_trgm` GIN index (`idx_products_name_trgm`) for fast substring matching.
>
> **3. Concurrency & Checkout**: Checkout locks inventory rows in PostgreSQL (`SELECT FOR UPDATE`), verifies available stock, creates a 15-minute `CREATED` reservation keyed by an `idempotency_key`, snapshots product prices into `order_items` so future price edits never alter history, and inserts an `outbox_events` row in the same transaction (`Propagation.MANDATORY`).
>
> **4. Payments & Async Events**: A payment simulator handles `SUCCEEDED`, `FAILED`, `TIMEOUT`, and `REFUNDED` transitions idempotently (`payments.idempotency_key`). If a late success callback arrives after the 15-minute reservation expired, FlashCart refuses to steal stock and automatically refunds + cancels the order. Meanwhile, `OutboxPublisher` polls pending events every 2 seconds to Kafka (`acks=all`, `enable.idempotence=true`), and `KafkaEventConsumer` deduplicates via `processed_events` with 2 retries before routing failures to `.DLT` topics."

---

## Architecture Questions

### 1. Why did you choose a modular monolith over microservices?
- **Concise Answer**: A modular monolith gives us strong package boundaries while keeping order creation, inventory locking, and outbox event insertion inside a single PostgreSQL ACID transaction—eliminating distributed sagas, network hops, and operational sprawl on a solo/small-team codebase.
- **Deeper Explanation**: In FlashCart, checkout touches `orders`, `order_items`, `inventory`, `inventory_reservations`, and `outbox_events`. Running those across separate microservices would require 2PC or compensating saga transactions with eventual consistency windows where UX and failure recovery become far harder. Keeping modules cleanly isolated under `com.flashcart.*` (`Controller → Service → Repository → Entity/DTO`) avoids circular dependencies while giving us microsecond in-process calls.
- **Follow-Up Questions**:
  - *How do you enforce module boundaries in Java without Maven multi-module?* (Strict package conventions, ArchUnit rules, no cross-module repository injection—communicate through services or outbox events.)
  - *When would you actually split into microservices?* (When independent teams step on releases or a specific domain like notifications or flash-sale ingestion needs dedicated scaling/isolation.)

### 2. How would you extract the inventory module into a separate service?
- **Concise Answer**: Give `inventory` its own PostgreSQL schema/database, expose an internal gRPC or REST reservation API (`reserve`, `confirm`, `release`) with idempotency keys, and keep the reservation expiry scheduler inside the new inventory service.
- **Deeper Explanation**: Because `OrderService` already depends on `InventoryService` via clean method contracts and `idempotency_key`, we would replace in-process `InventoryService` calls with a synchronous client call (wrapped in circuit breakers/timeouts) from `order` to `inventory`, and replace local `outbox_events` reads with Kafka events (`flashcart.payment.succeeded` → confirm reservation, `flashcart.order.cancelled` → release reservation).
- **Follow-Up Questions**:
  - *What happens if `inventory` reserves stock, then `order` crashes before saving the order?* (The 15-minute `expires_at` TTL on `inventory_reservations` automatically releases orphaned reservations.)

### 3. What are the trade-offs of your current architecture?
- **Concise Answer**: We gain ACID simplicity, unified Flyway migrations, and fast local setup via `docker-compose`, at the cost of a single scaling unit (whole JVM + single PostgreSQL primary) and needing discipline to keep modules decoupled.
- **Deeper Explanation**: Heavy analytics queries (`admin/analytics/*`) share the same JVM and PostgreSQL connection pool (`hikari.maximum-pool-size: 30`) as flash-sale reservations. In production, read-heavy analytics would be routed to a PostgreSQL read replica or an analytical store fed by Kafka events.
- **Follow-Up Questions**:
  - *How does `spring.jpa.open-in-view: false` relate to modular hygiene?* (Disabling OSIV forces services to fetch everything needed inside the transaction boundary and map to DTOs before returning to controllers, preventing hidden lazy-load queries during JSON serialization.)

### 4. How does your module communication work?
- **Concise Answer**: Synchronous in-process service-to-service calls for immediate invariants (checkout → inventory reserve) and asynchronous Kafka domain events (via `outbox_events`) for decoupled side effects like notifications.
- **Deeper Explanation**: Synchronous reads/writes stay strictly within `@Transactional` service boundaries, while cross-cutting side effects (`OrderCreated`, `PaymentSucceeded`, `PaymentFailed`, `InventoryReleased`, `NotificationRequested`) use `OutboxService.recordEvent(...)` so failures in Kafka or email rendering never roll back a valid customer checkout.
- **Follow-Up Questions**:
  - *Why not use Spring `ApplicationEventPublisher` alone?* (In-memory Spring events are lost if the JVM restarts between DB commit and listener completion; `outbox_events` persists reliably in PostgreSQL.)

---

## Concurrency & Inventory Questions (Critical)

### 5. How does your system prevent overselling in a flash sale?
- **Concise Answer**: FlashCart enforces stock limits at the PostgreSQL layer using an atomic conditional `UPDATE` on `flash_sale_items`, pessimistic `SELECT ... FOR UPDATE` locks on `inventory`, `UNIQUE` idempotency keys, and database `CHECK` constraints (`sold_lte_sale_stock` and `reserved_lte_total`).
- **Deeper Explanation**:
  ```sql
  -- 1. Atomic flash-sale quota claim (FlashSaleItemRepository)
  UPDATE flash_sale_items
  SET sold_count = sold_count + :qty
  WHERE id = :id AND (sold_count + :qty) <= sale_stock;

  -- 2. Database-level safety net (V1__initial_schema.sql)
  CONSTRAINT sold_lte_sale_stock CHECK (sold_count <= sale_stock)
  CONSTRAINT reserved_lte_total CHECK (reserved_stock <= total_stock)
  ```
  Even if 10,000 requests hit multiple backend replicas simultaneously, PostgreSQL serializes writes to that single row and physically prevents `sold_count > sale_stock` or `reserved_stock > total_stock`.
- **Follow-Up Questions**:
  - *What happens to the 9,900 losing requests?* (They receive `0` updated rows and fail cleanly with `409 Conflict`, or fast-fail via optional Redis admission control.)

### 6. Explain `SELECT FOR UPDATE` and why you use it.
- **Concise Answer**: `SELECT ... FOR UPDATE` (`@Lock(LockModeType.PESSIMISTIC_WRITE)` in `InventoryRepository`) acquires an exclusive row-level write lock in PostgreSQL for the duration of the transaction, forcing concurrent transactions targeting the same SKU to wait and read the newly committed stock rather than stale values.
- **Deeper Explanation**: Without `FOR UPDATE`, two transactions reading under PostgreSQL's default `READ COMMITTED` isolation level both see `available = 1` and both attempt to reserve it. With `findByProductIdForUpdate(productId)`, Transaction B blocks at the `SELECT` statement until Transaction A commits or rolls back, then sees the updated `reserved_stock` immediately.
- **Follow-Up Questions**:
  - *Can `SELECT FOR UPDATE` deadlock across multi-item carts?* (Yes, if TX1 locks SKU A then B while TX2 locks B then A. We prevent this by sorting product IDs deterministically before acquiring row locks.)

### 7. What is the difference between optimistic and pessimistic locking? Which did you use and why?
- **Concise Answer**: Optimistic locking (`@Version`) assumes conflicts are rare and aborts on commit if another transaction modified the row; pessimistic locking (`SELECT FOR UPDATE`) locks the row up front. We chose pessimistic locking for hot inventory reservations because flash-sale contention causes massive abort/retry storms under optimistic locking.
- **Deeper Explanation**: Note that `Inventory.java` still retains a `@Version Long version` column for safe admin/non-contended updates, while high-contention reservation paths explicitly use `@Lock(LockModeType.PESSIMISTIC_WRITE)` (`findByProductIdForUpdate`, `findByIdForUpdate`) or single-statement atomic SQL updates (`incrementSoldCountIfAvailable`).
- **Follow-Up Questions**:
  - *When is optimistic locking better?* (Low-contention edits like updating a user profile or product description where read-think-write spans long periods.)

### 8. How does your reservation expiry work? Is it safe with multiple instances?
- **Concise Answer**: A `@Scheduled` job scans `CREATED` reservations past `expires_at` (using partial index `idx_inv_res_expires_at_status`) and atomically claims each row via `UPDATE inventory_reservations SET status = 'EXPIRED' WHERE id = :id AND status = 'CREATED'`. Only the instance receiving `updatedRows == 1` decrements `reserved_stock`.
- **Deeper Explanation**: Look at `InventoryReservationRepository.claimExpiredReservation`:
  ```sql
  UPDATE inventory_reservations
  SET status = 'EXPIRED', released_at = :now, updated_at = :now
  WHERE id = :id AND status = 'CREATED';
  ```
  If 3 Spring Boot pods select the same expired reservation ID concurrently, PostgreSQL locks the row on the first `UPDATE`. Pod 1 flips `status` to `'EXPIRED'` and gets row count `1`, releasing stock once. Pods 2 and 3 subsequently evaluate `WHERE status = 'CREATED'`, get row count `0`, and skip stock restoration—guaranteeing exact-once release without distributed locks like ShedLock or ZooKeeper.
- **Follow-Up Questions**:
  - *What if a reservation expires while the customer is submitting payment at the exact same millisecond?* (`transitionFromCreated` also checks `WHERE id = :id AND status = 'CREATED'`, so only one state transition wins; if expiry won, the late payment triggers an auto-refund.)

### 9. What is TOCTOU and how does your system prevent it?
- **Concise Answer**: TOCTOU (*Time-of-Check to Time-of-Use*) is a race where a value checked in step 1 changes before it is mutated in step 2. FlashCart prevents it by holding a PostgreSQL `FOR UPDATE` lock across check-and-update or collapsing check+update into one atomic SQL `UPDATE ... WHERE (sold_count + qty) <= sale_stock`.
- **Deeper Explanation**: Classic e-commerce bugs check `if (stock >= qty)` in Java, then run `UPDATE inventory SET reserved_stock = reserved_stock + qty`. Between those two statements, another thread steals the unit. In FlashCart, PostgreSQL's row lock + `CHECK (reserved_stock <= total_stock)` eliminates the gap completely.
- **Follow-Up Questions**:
  - *Does `REPEATABLE READ` alone solve TOCTOU?* (In PostgreSQL `REPEATABLE READ` throws serialization errors on write-skew/concurrent updates requiring application retry logic; `FOR UPDATE` or atomic `UPDATE` predicates handle high contention cleanly without retry loops.)

### 10. What would happen if the database went down mid-reservation?
- **Concise Answer**: If PostgreSQL drops before `COMMIT`, the transaction rolls back automatically—zero partial writes, zero leaked locks, and the client receives a `500`/`503` error. If PostgreSQL fails *after* `COMMIT`, the reservation and order are durable and any unpaid reservation expires automatically once DB recovers.
- **Deeper Explanation**: Because `Inventory`, `InventoryReservation`, `Order`, and `OutboxEvent` share one ACID transaction, FlashCart never enters a split state where stock is reserved without an order or an order exists without reserved stock.
- **Follow-Up Questions**:
  - *What if the client times out right as the DB actually committed?* (The client safely retries with the same `idempotencyKey`, and FlashCart returns the already-created reservation instead of charging stock twice.)

### 11. How does your idempotency key prevent duplicate reservations?
- **Concise Answer**: `inventory_reservations.idempotency_key` has a `UNIQUE NOT NULL` constraint in PostgreSQL. Retried requests look up existing keys and replay the original result; simultaneous concurrent retries hit the unique index so only one reservation is ever created.
- **Deeper Explanation**: When a mobile client retries a checkout or flash-sale request due to a dropped TCP response, `InventoryService` checks `findByIdempotencyKey(key)` first. If two identical requests race in parallel before either commits, the second hits PostgreSQL unique-constraint enforcement rather than creating a second reservation.
- **Follow-Up Questions**:
  - *Should idempotency keys be scoped per user?* (Yes—combining user ID or prefixing with `userId` prevents one user's key from colliding with another's.)

### 12. What is `FOR UPDATE SKIP LOCKED` and why is it important for schedulers?
- **Concise Answer**: `SELECT ... FOR UPDATE SKIP LOCKED` locks available rows for the current worker while immediately skipping rows currently locked by another worker instance—preventing queue/batch contention across multiple application instances.
- **Deeper Explanation**: In multi-instance schedulers (like sweeping batches of `PENDING` outbox events or expired reservations), plain `FOR UPDATE` forces Instance B to stall waiting for Instance A's transaction to commit, only to find the rows already processed. `SKIP LOCKED` lets Instance A process rows 1–100 while Instance B immediately claims rows 101–200 in parallel.
- **Follow-Up Questions**:
  - *Is `SKIP LOCKED` appropriate for checking out a specific SKU?* (No! Checkout needs the *exact* inventory row for a product, so it must wait with `FOR UPDATE`, not skip it.)

---

## Spring Boot Questions

### 13. Explain your transaction boundaries in the inventory service.
- **Concise Answer**: Every reserve, confirm, release, and expiry-claim operation executes inside an explicit `@Transactional` boundary on the Service layer (`Controller` has zero `@Transactional` annotations), keeping transactions as short as possible with zero external network calls inside the lock window.
- **Deeper Explanation**: By disabling `spring.jpa.open-in-view: false`, database connections from HikariCP are acquired only for the duration of `@Transactional` service execution and immediately released before Jackson serializes the response DTO.
- **Follow-Up Questions**:
  - *Why never make HTTP calls (like Stripe or email APIs) inside a `@Transactional` inventory lock?* (A 3-second slow external HTTP call holds PostgreSQL row locks and HikariCP connections open for 3 seconds, freezing all other buyers of that SKU.)

### 14. How does `@Transactional` work internally?
- **Concise Answer**: Spring wraps the target bean in a dynamic proxy (CGLIB subclass by default in Spring Boot) managed by `TransactionInterceptor`, which obtains a connection from `PlatformTransactionManager`, disables auto-commit before the method runs, and commits or rolls back on `RuntimeException`/`Error`.
- **Deeper Explanation**: Because `@Transactional` relies on proxies, **self-invocation** (`this.innerMethod()` inside the same class) bypasses the proxy and ignores `@Transactional` attributes like `REQUIRES_NEW` or `MANDATORY`. That is why `OutboxService` and `InventoryService` are separate Spring beans.
- **Follow-Up Questions**:
  - *Do checked exceptions trigger rollback by default?* (No—only unchecked `RuntimeException` and `Error` unless `rollbackFor = Exception.class` is specified.)

### 15. What is transaction propagation? Which did you use and why?
- **Concise Answer**: Propagation defines how a transactional method behaves when called from an existing transaction (`REQUIRED` joins it; `REQUIRES_NEW` suspends it and opens a separate commit; `MANDATORY` throws if no active transaction exists). We use `REQUIRED` (default) for domain services and `Propagation.MANDATORY` on `OutboxService.recordEvent`.
- **Deeper Explanation**: Using `@Transactional(propagation = Propagation.MANDATORY)` on `OutboxService.recordEvent(...)` acts as a compile/runtime safety invariant: any caller emitting an outbox event **must** already be inside an active ACID transaction, preventing accidental non-atomic outbox writes. Conversely, per-item batch loops (like expiring individual reservations) can isolate failures per item so one bad row doesn't roll back an entire batch.
- **Follow-Up Questions**:
  - *When is `REQUIRES_NEW` dangerous?* (Each `REQUIRES_NEW` grabs a *second* simultaneous JDBC connection from HikariCP while holding the outer connection—under pool exhaustion this can self-deadlock the connection pool!)

### 16. How does Spring Security filter chain work in your application?
- **Concise Answer**: Requests hit `CorrelationIdFilter` (highest precedence), pass through Spring Security's `SecurityFilterChain` configured with `STATELESS` sessions and CORS, run `JwtAuthenticationFilter` (`OncePerRequestFilter`) before `UsernamePasswordAuthenticationFilter` to populate `SecurityContextHolder`, and enforce route/method RBAC rules.
- **Deeper Explanation**: In `SecurityConfig.java`, public routes (`/api/v1/auth/*`, `GET /api/v1/products/**`, `/actuator/health/**`) are permitted, `/api/v1/admin/**` requires `ROLE_ADMIN`, and missing/invalid tokens invoke a custom JSON `AuthenticationEntryPoint` (`401`) or `AccessDeniedHandler` (`403`) returning `ApiResponse` instead of redirecting to an HTML login form.
- **Follow-Up Questions**:
  - *Why does `JwtAuthenticationFilter` extend `OncePerRequestFilter`?* (Guarantees the JWT check runs strictly once per request even across internal servlet forwards/error dispatches.)

### 17. How do you handle Testcontainers in your integration tests?
- **Concise Answer**: Integration tests boot real `postgres:16-alpine`, `redis:7-alpine`, and Kafka containers via Testcontainers (`@Testcontainers` / `@ServiceConnection` or `@DynamicPropertySource`), run real Flyway `V1`/`V2`/`V3` migrations, and test real SQL constraints instead of H2 or mocked repositories.
- **Deeper Explanation**: H2 in-memory databases do not accurately emulate PostgreSQL's `FOR UPDATE` row locking semantics, `pg_trgm` GIN indexes, partial `WHERE` indexes, or `NUMERIC`/`CHECK` edge cases. Testing against real PostgreSQL 16 ensures our concurrency tests validate true production locking behavior.
- **Follow-Up Questions**:
  - *How do you keep Testcontainers suites fast?* (Use static/singleton shared containers across test classes so Postgres/Redis/Kafka start once per JVM test run rather than per test class.)

---

## Database Questions

### 18. Why did you use PostgreSQL over MySQL for this use case?
- **Concise Answer**: PostgreSQL 16 provides partial indexes (`WHERE status = 'CREATED'`), `pg_trgm` GIN trigram indexes for fast substring search, strict standard `CHECK` constraints (historically ignored in older MySQL 5.x/8.0 configs), `gen_random_uuid()`, and rock-solid `FOR UPDATE SKIP LOCKED` support.
- **Deeper Explanation**: Look at `V2__indexes.sql`: both `idx_inv_res_expires_at_status` and `idx_outbox_status_created` use partial index predicates (`WHERE status = 'CREATED'` and `WHERE status = 'PENDING'`). MySQL does not support partial indexes natively, forcing schedulers to index historical rows too.
- **Follow-Up Questions**:
  - *How does PostgreSQL MVCC handle readers while a writer holds `FOR UPDATE`?* (Readers doing plain `SELECT` never block on `FOR UPDATE` writers—catalog browsers read committed snapshots with zero lock contention.)

### 19. Explain your indexing strategy for the `inventory_reservations` table.
- **Concise Answer**: We index `(inventory_id, status)`, `idempotency_key` (unique), `user_id`, `order_id`, and a **partial index** on `(expires_at) WHERE status = 'CREATED'`.
- **Deeper Explanation**: Over months of operation, 99.9% of `inventory_reservations` rows sit in terminal states (`CONFIRMED`, `RELEASED`, `EXPIRED`). A standard B-Tree on `expires_at` would grow linearly forever. By adding `WHERE status = 'CREATED'`, PostgreSQL indexes *only* currently active pending checkouts—keeping the expiry scanner's working set tiny and fast in RAM.
- **Follow-Up Questions**:
  - *What happens to the partial index entry when a reservation transitions to `CONFIRMED`?* (PostgreSQL automatically removes it from `idx_inv_res_expires_at_status`!)

### 20. How does your Flyway migration strategy work?
- **Concise Answer**: Migrations live in `backend/src/main/resources/db/migration/` (`V1__initial_schema.sql`, `V2__indexes.sql`, `V3__seed_data.sql`), execute automatically on startup, and pair with `spring.jpa.hibernate.ddl-auto: validate` so Hibernate refuses to boot if entities diverge from SQL migrations.
- **Deeper Explanation**: Flyway stores SHA-256 checksums of every applied script in `flyway_schema_history`. Editing an already-applied migration fails validation immediately, enforcing immutable, forward-only database schema changes across dev, CI, and prod.
- **Follow-Up Questions**:
  - *How do you deploy a backward-compatible schema change before rolling out new code?* (Expand-and-contract: add nullable column in `V4`, backfill/dual-write in code, enforce `NOT NULL` or drop old column in `V5` after rollout.)

### 21. Why did you use `NUMERIC(10,2)` for monetary values instead of float?
- **Concise Answer**: IEEE-754 `float`/`double` are binary approximations that cannot represent decimal values like `0.10` or `19.99` exactly, causing rounding drift in financial totals. PostgreSQL `NUMERIC(10, 2)` paired with Java `BigDecimal` guarantees exact base-10 arithmetic.
- **Deeper Explanation**: All monetary columns (`products.price`, `orders.subtotal`, `orders.total_amount`, `order_items.unit_price`, `payments.amount`, `flash_sale_items.sale_price`) use `NUMERIC(10, 2)` and `BigDecimal` with explicit rounding only at final tax/discount boundaries.
- **Follow-Up Questions**:
  - *What is the alternative to `NUMERIC` in high-throughput financial ledgers?* (Storing integer minor units like `amount_cents BIGINT` alongside ISO-4217 currency scale.)

### 22. What is a `CHECK` constraint and how does it protect your inventory invariant?
- **Concise Answer**: A `CHECK` constraint is a boolean predicate enforced by PostgreSQL on every `INSERT` and `UPDATE`. On `inventory`, `CONSTRAINT reserved_lte_total CHECK (reserved_stock <= total_stock)` makes negative available stock impossible even if application code has a bug.
- **Deeper Explanation**: We enforce `total_stock >= 0`, `reserved_stock >= 0`, `reserved_stock <= total_stock`, `sold_count <= sale_stock`, `quantity > 0`, `price >= 0`, and `end_time > start_time` directly inside PostgreSQL—acting as the last line of defense for business invariants.
- **Follow-Up Questions**:
  - *Why keep both Java checks (`Inventory.reserve`) and DB `CHECK` constraints?* (Java validation produces friendly `InsufficientInventoryException` -> `409 Conflict` responses; DB `CHECK` guarantees mathematical impossibility of overselling under any circumstance.)

---

## Kafka Questions

### 23. What is the transactional outbox pattern and why do you use it?
- **Concise Answer**: Instead of writing to PostgreSQL and sending to Kafka separately (which risks lost or phantom events if one fails), FlashCart writes an `OutboxEvent` row into `outbox_events` inside the exact same DB transaction, and `OutboxPublisher` asynchronously relays `PENDING` rows to Kafka.
- **Deeper Explanation**: `OutboxService.recordEvent` uses `@Transactional(propagation = Propagation.MANDATORY)` to enforce participation in the caller's transaction. `OutboxPublisher` polls `PENDING` rows every 2 seconds, waits for Kafka broker acknowledgment (`acks=all`, `enable.idempotence=true`), and marks rows `PUBLISHED`.
- **Follow-Up Questions**:
  - *What is an alternative to polling the outbox table?* (Log-based CDC with **Debezium** tailing PostgreSQL's WAL for sub-second latency without polling load.)

### 24. How do you ensure your Kafka consumers are idempotent?
- **Concise Answer**: Every `DomainEvent` carries a unique UUID `eventId`. Before processing an event, `KafkaEventConsumer` checks `processed_events` (`PRIMARY KEY (event_id)`) and inserts the `eventId` inside the same `@Transactional` block as the consumer side effect.
- **Deeper Explanation**: Look at `KafkaEventConsumer.java`: if `processedEventRepository.existsByEventId(event.getEventId())` returns true, the consumer returns early without calling `NotificationService.deliverNotification(...)` again. Furthermore, `NotificationService.deliverNotification` checks `status == DELIVERED` as an extra domain guard.
- **Follow-Up Questions**:
  - *What if two consumer threads receive the same `eventId` simultaneously?* (Because `event_id` is the `PRIMARY KEY` on `processed_events`, the database rejects or serializes the duplicate insert cleanly.)

### 25. What happens if a Kafka message is redelivered?
- **Concise Answer**: Redelivery happens during consumer rebalances or crashes before offset commit (`enable-auto-commit: false`, `ack-mode: record`). When redelivered, `KafkaEventConsumer` detects the `eventId` in `processed_events` and skips re-executing the business logic.
- **Deeper Explanation**: Because Kafka guarantees at-least-once delivery, redelivery is expected normal behavior—not an error. Idempotent consumption makes redelivery completely harmless.
- **Follow-Up Questions**:
  - *How big does `processed_events` grow?* (In production, partition by date or run a retention cleanup job purging `processed_at < NOW() - INTERVAL '30 days'`.)

### 26. What is a dead-letter topic and when is a message sent there?
- **Concise Answer**: A Dead-Letter Topic (`<topic>.DLT`) receives poison messages that fail repeatedly so they don't block healthy messages behind them on the partition. In `KafkaConfig`, `DefaultErrorHandler` retries twice (`FixedBackOff(1000L, 2L)`) before `DeadLetterPublishingRecoverer` sends the record to `.DLT`.
- **Deeper Explanation**: Configured for `flashcart.order.created.DLT`, `flashcart.payment.succeeded.DLT`, and `flashcart.payment.failed.DLT`, allowing engineers to inspect malformed JSON payloads or transient downstream bugs offline and replay them once fixed.
- **Follow-Up Questions**:
  - *Does DLT preserve ordering for a specific aggregate key?* (If an `OrderCreated` message goes to DLT while a subsequent `OrderCancelled` arrives, downstream consumers must tolerate out-of-order recovery or pause on unrecoverable aggregate failures.)

### 27. Can you guarantee exactly-once delivery with your current setup?
- **Concise Answer**: No—and we explicitly document that FlashCart guarantees **at-least-once delivery** with **idempotent processing** (effectively-once effects), not end-to-end "exactly-once delivery."
- **Deeper Explanation**: Even with Kafka producer `enable.idempotence=true`, `OutboxPublisher` could succeed in sending to Kafka and crash right before committing `status = 'PUBLISHED'` in PostgreSQL—re-sending the message on restart. True cross-system exactly-once delivery across Postgres + Kafka + email does not exist; idempotent consumers (`processed_events`) solve the practical problem cleanly.
- **Follow-Up Questions**:
  - *What does Kafka's `enable.idempotence=true` actually guarantee?* (Exactly-once writes *per producer session to a single partition*—eliminating duplicates from broker ack timeouts, not outbox publisher crashes.)

---

## Redis Questions

### 28. What do you cache in Redis and why?
- **Concise Answer**: We cache read-heavy, low-churn data—`products` (5 min TTL), `productDetail` (5 min TTL), `categories` (15 min TTL), and `flashSales` metadata (30 sec TTL)—via `RedisCacheManager` to offload repetitive catalog queries from PostgreSQL.
- **Deeper Explanation**: We deliberately **never** treat Redis as authoritative for `inventory.reserved_stock` or financial balances; Redis only accelerates reads and optionally acts as a fast sold-out pre-filter during flash sales.
- **Follow-Up Questions**:
  - *Why is `flashSales` TTL only 30 seconds while `categories` is 15 minutes?* (Category trees rarely change, whereas flash-sale remaining counts change rapidly during live events.)

### 29. How do you handle cache invalidation?
- **Concise Answer**: Combination of explicit cache eviction (`@CacheEvict`) when admins mutate products, categories, or flash sales, plus bounded TTLs (5m / 15m / 30s) as a self-healing safety net.
- **Deeper Explanation**: Relying on TTL alone shows stale prices after an admin edit; relying on eviction alone risks drift if an eviction call fails during a network blip. Combining both gives immediate consistency on normal writes and bounded staleness on failures.
- **Follow-Up Questions**:
  - *How do you prevent cache stampede when a popular product cache entry expires?* (Use short jittered TTLs, `sync = true` on `@Cacheable` to coalesce concurrent misses in-JVM, or pre-warm flash-sale metadata before sale start.)

### 30. What happens if Redis goes down? Is your system still operational?
- **Concise Answer**: Yes. `RedisConfig` registers a custom `CacheErrorHandler` that intercepts `GET`/`PUT`/`EVICT`/`CLEAR` failures, logs a warning, and falls back directly to PostgreSQL—so checkout, flash sales, auth, and browsing stay 100% operational.
- **Deeper Explanation**: Look at `RedisConfig.errorHandler()`: Spring's default behavior propagates `RedisConnectionFailureException` and fails the entire HTTP request with a 500! Overriding `CacheErrorHandler` prevents Redis outages from taking down the storefront.
- **Follow-Up Questions**:
  - *What degrades when Redis is down?* (Higher read latency and increased PostgreSQL CPU/read load, plus loss of optional Redis flash-sale pre-filtering.)

### 31. How do you use Redis for rate limiting?
- **Concise Answer**: Currently `RateLimitService` uses Bucket4j in-memory token buckets (`auth-requests-per-minute: 30`, `flash-sale-requests-per-minute: 120`); for multi-instance production scaling, Bucket4j swaps cleanly to a Redis-backed `ProxyManager` (`bucket4j-redis` / Lettuce) sharing token counts across all backend nodes.
- **Deeper Explanation**: Documenting this honestly avoids overclaiming: single-node local Bucket4j works seamlessly for a single backend container and avoids Redis single-point-of-failure on rate limiting, while Redis-backed Bucket4j (`LettuceBasedProxyManager`) is the drop-in upgrade path for clustered deployments.
- **Follow-Up Questions**:
  - *Why token bucket over fixed-window counter?* (Fixed-window counters allow 2× burst traffic across minute boundaries `[00:59]` + `[01:00]`; Bucket4j token buckets enforce smooth greedy refill rates.)

---

## Security Questions

### 32. How do you prevent IDOR attacks?
- **Concise Answer**: Every user-scoped endpoint derives the caller identity from `@AuthenticationPrincipal User` (populated by `JwtAuthenticationFilter`)—never from a request body `userId`—and verifies resource ownership (`order.getUser().getId().equals(currentUser.getId())`) before returning or mutating records.
- **Deeper Explanation**: Even though primary keys are non-sequential UUIDs (preventing trivial `1, 2, 3` enumeration), UUIDs can still leak in logs or URLs; explicit service-layer ownership checks (`403 Forbidden` / `404 Not Found`) are mandatory on orders, addresses, carts, payments, and notifications.
- **Follow-Up Questions**:
  - *Why allow `ADMIN` bypass only on explicit `/api/v1/admin/**` routes or explicit role checks?* (Separation keeps customer controllers simple and ensures admin privileges are audited via `@PreAuthorize("hasRole('ADMIN')")`.)

### 33. Why do you store refresh tokens in `HttpOnly` cookies instead of `localStorage`?
- **Concise Answer**: Any JavaScript running on the page (including an XSS payload or compromised third-party npm dependency) can read `localStorage` and exfiltrate long-lived tokens. `HttpOnly` cookies are completely inaccessible to `document.cookie` or JavaScript.
- **Deeper Explanation**: FlashCart pairs an `HttpOnly`, `SameSite=Strict` refresh cookie (7 days) with a short-lived (15-minute) JWT access token kept only in JavaScript memory (`frontend/src/services/api.ts`). Even if an XSS flaw ever occurred, an attacker cannot steal the persistent refresh credential.
- **Follow-Up Questions**:
  - *Doesn't storing refresh tokens in cookies open you up to CSRF?* (`SameSite=Strict` prevents cross-site browsers from attaching the cookie on third-party requests, and normal API calls require an `Authorization: Bearer` header rather than ambient cookies.)

### 34. How does JWT refresh token rotation work?
- **Concise Answer**: Every call to `/api/v1/auth/refresh` validates the incoming refresh token in `refresh_tokens`, marks that row `used = true`, issues a brand-new refresh cookie + access JWT, and revokes **all** tokens for that user if an already-used token is ever presented again.
- **Deeper Explanation**: If an attacker steals a refresh cookie and uses it before or after the legitimate user, the next refresh attempt presents a `used == true` token. FlashCart's reuse detection revokes the entire token family immediately, locking out both the stolen copy and forcing clean re-login.
- **Follow-Up Questions**:
  - *What happens if a React SPA triggers two parallel 401 refreshes at the exact same moment?* (Frontend `api.ts` uses an `isRefreshing` flag + `refreshSubscribers` queue so only **one** `/auth/refresh` HTTP request fires and all queued requests receive the single rotated token!)

### 35. How do you prevent brute force attacks on login?
- **Concise Answer**: Bucket4j rate limiting on authentication endpoints (`30` requests/minute via `RateLimitService`), BCrypt password hashing (slow work factor 10), generic `"Invalid email or password"` error messages (preventing account enumeration), and account `enabled` lock support.
- **Deeper Explanation**: Returning identical `401` errors whether an email exists or the password is wrong stops attackers from harvesting registered customer emails via `/login`.
- **Follow-Up Questions**:
  - *How would you harden `/forgot-password` against enumeration?* (Always return `200 OK` with a generic `"If the email exists, a reset link was sent"` response regardless of whether the address is registered.)

---

## System Design Questions

### 36. How would you scale FlashCart to 1 million concurrent users?
- **Concise Answer**: Put static frontend assets on a global CDN, horizontally scale stateless Spring Boot instances behind an L7 load balancer, move read traffic to PostgreSQL read replicas + Redis clusters, queue flash-sale spikes with Redis admission + virtual waiting rooms/Kafka partitioning, and shard hot flash-sale counters or pre-allocate stock tokens in Redis/Lua backed by async DB settlement.
- **Deeper Explanation**: At 1M concurrent users (say 100k req/s during a drop), a single PostgreSQL `flash_sale_items` row lock (`SELECT FOR UPDATE`) becomes a physical ceiling (~thousands of TPS per row). At that tier:
  1. CDN caches product pages & static assets.
  2. Redis Cluster (with atomic Lua scripts or partitioned stock buckets—e.g. splitting 1,000 units into 10 shards of 100) absorbs the 100k req/s spike in memory and rejects sold-out users at the edge.
  3. Only the 1,000 winning tokens hit Kafka → PostgreSQL order creation workers!
- **Follow-Up Questions**:
  - *How do you recover if Redis loses a flash-sale shard mid-event at 1M scale?* (Fail closed briefly, reconcile `sale_stock - COUNT(orders)` from PostgreSQL, re-seed Redis counters, and resume.)

### 37. How would you add a recommendation system?
- **Concise Answer**: Stream `OrderCreated` and product-view Kafka events into a separate analytics/ML pipeline that computes co-purchase scores ("frequently bought together") or vector embeddings, storing precomputed top-K product IDs per SKU/user in Redis or a PostgreSQL `pgvector` table for sub-10ms reads.
- **Deeper Explanation**: Because FlashCart already emits `OrderCreated` via the Transactional Outbox to Kafka (`flashcart.order.created`), adding a recommendation consumer requires zero changes to the checkout critical path.
- **Follow-Up Questions**:
  - *How do you handle cold-start products with zero orders?* (Fall back to category popularity or content-based similarity on title/description embeddings.)

### 38. How would you implement real-time inventory updates in the UI?
- **Concise Answer**: Replace short polling with **Server-Sent Events (SSE)** or **WebSockets** subscribed to product/flash-sale IDs, backed by Redis Pub/Sub (for multi-instance fan-out) triggered whenever `OutboxPublisher` or `InventoryService` updates stock.
- **Deeper Explanation**: Polling 10,000 open browser tabs every 2 seconds creates 5,000 req/s of read noise. With SSE + Redis Pub/Sub, each backend node maintains open lightweight SSE streams and broadcasts stock updates only when inventory actually changes (throttled/debounced at e.g. 250ms–500ms during heavy flash sales).
- **Follow-Up Questions**:
  - *Why SSE instead of full WebSockets for inventory countdowns?* (Stock updates are unidirectional server → client, work seamlessly over HTTP/2 multiplexing, and auto-reconnect natively in browsers via `EventSource`.)

### 39. What monitoring would you add for production?
- **Concise Answer**: FlashCart already exposes Micrometer/Prometheus metrics (`http_server_requests`, `hikaricp_connections_*`, `jvm_*`) scraped into Grafana and correlation-ID logs (`[cid=...]`). For production, I would add custom business counters, Alertmanager paging rules, and OpenTelemetry distributed tracing.
- **Deeper Explanation**:
  - **Custom Business Metrics**: `flashcart_reservations_created_total`, `flashcart_oversell_attempts_blocked_total`, `flashcart_outbox_pending_lag`, `flashcart_payment_late_refunds_total`.
  - **Alerts**: Outbox `PENDING` queue age > 30s, Kafka consumer lag > 1,000, HikariCP pending connections > 10 sustained for 1m, 5xx rate > 1%, and `available_stock < 0` (impossible invariant canary).
  - **Tracing**: OpenTelemetry agent exporting HTTP → PostgreSQL → Kafka traces to Grafana Tempo or Jaeger.

### 40. How would you handle database scaling?
- **Concise Answer**: Start with vertical scaling + PgBouncer connection pooling + read replicas for catalog/analytics (`@Transactional(readOnly = true)` routed to replica datasource); next extract independent domains (`notifications`, `analytics`) to separate databases; and finally partition large append-only tables (`orders`, `inventory_reservations`, `outbox_events`) by time or shard by `product_id`/`user_id`.
- **Deeper Explanation**: Read/write splitting alone immediately removes 70–80% of traffic (product browsing, search, dashboards) from the primary writer while keeping `SELECT FOR UPDATE` strong consistency intact on the primary node. Monthly range partitioning on `outbox_events`, `orders`, and `inventory_reservations` keeps indexes compact as row counts reach tens of millions.
