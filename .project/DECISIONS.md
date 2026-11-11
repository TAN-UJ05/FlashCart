# FlashCart — Architecture & Engineering Decisions

## Decision Log

### 2026-11-11 — Modular Monolith Architecture (14 Packages)
- **Decision**: Organize backend as a modular monolith (`auth`, `user`, `category`, `product`, `inventory`, `cart`, `order`, `payment`, `flashsale`, `notification`, `admin`, `analytics`, `kafka`, `common`), NOT microservices.
- **Reason**: Keeps order placement, inventory row locking, reservation creation, and `outbox_events` persistence inside one PostgreSQL ACID transaction while preserving strict module boundaries (`Controller -> Service -> Repository -> Entity/DTO`).

### 2026-11-11 — Java 22 Toolchain with `--release 21`
- **Decision**: Compile `backend/pom.xml` with `--release 21` on installed Oracle JDK 22.
- **Reason**: Ensures Java 21 LTS bytecode compatibility with Spring Boot `3.4.0` and CI runners (`actions/setup-java@v4` Java 21).

### 2026-11-11 — Standalone `docker-compose` & `npm`
- **Decision**: Use `docker-compose` (v5.6.1 standalone) instead of `docker compose`, and `npm` (11.6.2) instead of `pnpm`.
- **Reason**: Neither `docker compose` plugin nor `pnpm` is installed on the host workstation.

### 2026-11-11 — Inventory Locking: Pessimistic `SELECT FOR UPDATE` + Conditional SQL + `CHECK`
- **Decision**: Use PostgreSQL `SELECT ... FOR UPDATE` on `inventory`, single-statement conditional update `SET sold_count = sold_count + :qty WHERE ... AND (sold_count + :qty) <= sale_stock` on `flash_sale_items`, `UNIQUE` `idempotency_key` columns, and DB-level `CHECK` constraints (`reserved_lte_total`, `sold_lte_sale_stock`).
- **Reason**: Eliminates TOCTOU and retry storms under 10,000-request spikes and guarantees zero overselling across multiple instances even if Redis fails.

### 2026-11-11 — Redis Lua Admission Control + Transaction-Synchronized Rollback
- **Decision**: Use `FlashSaleStockCache` atomic Lua `DECRBY` pre-filter (`BYPASS` on Redis outage) + `TransactionSynchronization.afterCompletion` counter restoration on rollback + `afterCommit` sync on expiry/cancel.
- **Reason**: Sheds guaranteed sold-out traffic before acquiring PostgreSQL connections while keeping PostgreSQL as strict source of truth.

### 2026-11-11 — Transactional Outbox + Idempotent Consumers (`processed_events`)
- **Decision**: Write `outbox_events` inside domain `@Transactional(propagation = Propagation.MANDATORY)`, relay via `OutboxPublisher` (`FOR UPDATE SKIP LOCKED`), deduplicate via `processed_events`, and route poison messages to `*.DLT`. Also support `KAFKA_ENABLED=false` toggle (`application-prod.yml`).
- **Reason**: Prevents Postgres/Kafka dual-write drift locally and allows zero-cost Kafka-optional free-tier cloud demos without changing domain code.

### 2026-11-11 — Batch Catalog Loading + Redis `@Cacheable` Fix (`#55`)
- **Decision**: Resolved the k6 `product-browsing.js` bottleneck by eliminating ~63 N+1 queries per product page via batch `JOIN FETCH`/`IN` queries (`findByIdInWithCategory`, `findByProductIdInOrderBySortOrderAsc`, `findLiveByProductIds`), adding `@Cacheable(RedisConfig.CACHE_PRODUCTS)` on `ProductService.getProducts`, and copying `PageResponse.content` into a mutable `ArrayList` for `GenericJackson2JsonRedisSerializer` polymorphic typing.
- **Impact**: Improved 500-VU NAT throughput `3.22x` (`52.13 -> 167.63 req/s`), cut NAT median latency `9.3x` (`2.18s -> 235ms`), and achieved `294.46 req/s` (`p50 = 4.82ms`, `p95 = 57.12ms`, `0.00%` error rate) over Docker bridge networking.

### 2026-11-11 — Local Prebuilt Staging for Sandboxed Docker Image Builds
- **Decision**: Keep repo `backend/Dockerfile` and `frontend/Dockerfile` clean multi-stage Dockerfiles for CI and normal connected hosts, while on NAT-restricted local Docker build environments stage prebuilt JAR/`dist` artifacts strictly inside the external agent scratch folder to build clean local images without polluting tracked Dockerfiles or repo directories.

### 2026-11-11 — Production Proxy Rewrite for `SameSite=Strict` Refresh Cookies
- **Decision**: Configure React API client with `baseURL: '/api/v1'` (`withCredentials: true`) and Nginx `/api` proxy (Compose) + platform rewrite rules (`vercel.json`/`netlify.toml` documented in `docs/DEPLOYMENT.md`).
- **Reason**: Keeps browser calls same-origin when frontend and backend deploy on separate free-tier hosts so `HttpOnly; SameSite=Strict` refresh cookies are never dropped cross-site.
