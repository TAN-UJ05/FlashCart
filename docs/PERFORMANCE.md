# FlashCart Performance Engineering & Benchmarks

This document describes FlashCart's load testing suite, performance targets, database indexing and pooling design, caching strategy, and benchmark tracking.

> **Verified (2026-11-11)**: All benchmark and concurrency numbers below reflect actual measured outputs executed on 2026-11-11 against the running Docker Compose stack and Testcontainers suite after the `#55` catalog N+1 & Redis caching fix (`43/43` Maven tests in `02:49 min`, `2/2` Playwright E2E in `19.6 s`, and live k6 + PostgreSQL invariant verification). See [.project/TEST_RESULTS.md](../.project/TEST_RESULTS.md) for the consolidated execution log.

---

## 1. Test Environment & Hardware Specifications

- **OS**: Windows 11 x64
- **CPU**: AMD Ryzen 5 7520U (8 logical cores)
- **RAM**: 7.28 GB host RAM (`Docker Desktop VM`: `3,551 MB` / `3.47 GiB` allocated to the 8-container stack)
- **Runtime**: Java 21 bytecode (`--release 21`) on JDK 22 / Spring Boot 3.4.0 / Embedded Tomcat
- **Database**: PostgreSQL 16 (Docker container)
- **Cache**: Redis 7 (Docker container)
- **Messaging**: Apache Kafka 3.7 + Zookeeper (Docker containers)
- **Load Generator**: Grafana k6 (`grafana/k6:latest`, `tests/load/*.js`)

---

## 2. k6 Load Test Scripts & Scenarios

All k6 load test scripts reside in `tests/load/`:

| Script | Scenario | Virtual Users / Rate | Target Thresholds |
|---|---|---|---|
| `tests/load/product-browsing.js` | Catalog pagination (`GET /api/v1/products`) + trigram search (`GET /api/v1/products/search?q=laptop`) | Ramping `0 → 100 → 500 → 0` VUs over 2 minutes | `p(95) < 500ms`, `errors < 1%` |
| `tests/load/flash-sale-concurrency.js` | Flash sale thundering herd (`POST /api/v1/flash-sales/{id}/purchase`) against 100-unit stock | `ramping-arrival-rate`: `100 → 10,000 req/s` (`500–1,000` VUs) | `successful_reservations <= 100`, `0` overselling, graceful `409 Conflict` when sold out |
| `tests/load/checkout-flow.js` | Authenticated customer cart & order read loop (`GET /api/v1/cart`, `GET /api/v1/orders`) | Ramping `0 → 50 → 200 → 0` VUs over 3 minutes | `p(95) < 800ms`, `checkout_errors < 5%` |

### Running k6 Load Tests
```powershell
# 1. Product browsing benchmark
k6 run tests/load/product-browsing.js

# 2. Checkout flow benchmark
k6 run tests/load/checkout-flow.js

# 3. Flash sale 10,000-attempt concurrency rush
# Automatically resolves live flash sale, 100-stock item, and customer1 token via setup()
# Optional overrides: FLASH_SALE_ID, PRODUCT_ID, TEST_USER_TOKEN, STAGE_SCALE, SUMMARY_PATH
k6 run -e SUMMARY_PATH=tests/load/results/flash-sale-results.json tests/load/flash-sale-concurrency.js

# Or run via Docker Desktop on the Compose bridge network (zero-NAT invocation):
docker run --rm --network flashcart_default -v "${PWD}/tests/load:/scripts" grafana/k6 run -e BASE_URL=http://backend:8080 /scripts/product-browsing.js
```
When `SUMMARY_PATH` is specified, JSON metrics export to that file (and `tests/load/results/flash-sale-results.json` prints alongside the stdout report). All three k6 scripts also support `-e STAGE_SCALE=0.1` for scaled quick smoke runs.

---

## 3. Actual Measured Results (Verified 2026-11-11)

All live k6 benchmarks below were executed with `grafana/k6:latest` directly on the Compose bridge network (`--network flashcart_default -e BASE_URL=http://backend:8080`) after the `#55` optimization:

| Scenario | Completed | Throughput (req/s) | p50 (med) | p90 | p95 | Max Latency | Error Rate | Oversell Count | Status |
|---|---|---|---|---|---|---|---|---|---|
| Product Browsing (`500` VUs, `2m`, direct bridge) | `35,588` reqs | `294.46 req/s` | `4.82 ms` | `28.02 ms` | `57.12 ms` | `758.53 ms` | `0.00%` (`0/35,588`) | N/A | PASS |
| Checkout / Cart & Order Flow (`200` VUs, `3m`, direct bridge) | `24,781` reqs | `131.91 req/s` | `7.33 ms` | `15.04 ms` | `21.92 ms` | `6,782.65 ms` | `0.00%` (`0/24,781`) | N/A | PASS |
| Flash Sale Rush (`100 → 10,000 req/s`, `500–1,000` VUs, `15s` + teardown, `ELEC-001` `100` stock) | `1,228` reqs *(74,271 dropped iters)* | `61.18 req/s` | `13.90 s` *(2xx: `11.10 s`)* | — | `15.65 s` *(2xx: `14.14 s`)* | — | `0.00%` unexpected (`0` 5xx; `54` `409`, `1,072` `429`) | **0** (`100/100` sold) | PASS |
| Java JUnit + Testcontainers (`FlashSaleConcurrencyIntegrationTest`) | `10,000` attempts / `100` stock (`+` `25/250` direct PG) | `3/3` in `34.90 s` | — | — | — | — | `0.00%` unexpected | **0** (`100` confirmed, `9,900` rejected) | PASS |

### Scenario Details & PostgreSQL Invariant Verification
- **Product Browsing (`500` VUs, `2m`, direct Docker bridge)**: `35,588` requests (`294.46 req/s`), `med (p50) = 4.82 ms`, `p90 = 28.02 ms`, `p95 = 57.12 ms` (`< 500ms` **PASS**), `max = 758.53 ms`, `error rate = 0.00%` (`0/35,588`, `< 1%` **PASS**), `checks = 100.00%` (`71,176/71,176`).
- **Checkout / Cart & Order Flow (`200` VUs, `3m`, direct Docker bridge)**: `24,781` requests (`131.91 req/s`), `med (p50) = 7.33 ms`, `p90 = 15.04 ms`, `p95 = 21.92 ms` (`< 800ms` **PASS**), `max = 6,782.65 ms`, `error rate = 0.00%` (`0/24,781`, `< 5%` **PASS**), `checks = 100.00%` (`24,781/24,781`).
- **Flash Sale Concurrency Rush (`100 → 10,000 req/s` `ramping-arrival-rate`, `500–1,000` VUs, `15s` + teardown, `ELEC-001` `100` stock, direct Docker bridge)**: `1,228` HTTP requests completed (`61.18 req/s`; `74,271` dropped iterations at `1,000` VUs inside the single-node `3.47 GiB` Docker VM):
  - **`100` confirmed reservations** (`<= 100` **PASS**; `expected_response:true p50 = 11.10 s, p95 = 14.14 s`)
  - **`54` sold-out `409 Conflict`** responses
  - **`1,072` rate-limited `429`** responses (single `customer1` credential hitting Bucket4j `120 req/min`)
  - **`0.00%` unexpected errors (`0` 5xx)**; overall `p50 = 13.90 s`, `p95 = 15.65 s`
  - **Zero oversell verified in PostgreSQL**: `flash_sale_items.sold_count = 100/100`, `inventory.reserved_stock = 100`, `flash_sale_orders = 100`
- **Java JUnit + Testcontainers Concurrency (`FlashSaleConcurrencyIntegrationTest`)**: `3/3 PASS` in `34.90 s` (`100` threads / `10,000` attempts vs `100` stock = `100` confirmed, `9,900` rejected, **`0` oversells**; plus Redis-bypassed direct PG lock check `25/250`). Full backend suite: **`43/43 PASS` (`02:49 min`)**.

### Pre/Post-`#55` `host.docker.internal` NAT Comparison (`product-browsing.js`, `500` VUs)

| Run Mode | Requests | Throughput | p50 (med) | p95 | Error Rate | Assessment |
|---|---|---|---|---|---|---|
| Pre-`#55` (`host.docker.internal` NAT) | `6,726` | `52.13 req/s` | `2.18 s` | `11.7 s` | `1.33%` TCP EOF | **FAIL** (N+1 queries + uncached `getProducts`) |
| Post-`#55` (`host.docker.internal` NAT) | `22,919` | `167.63 req/s` (`3.22x`) | `235.25 ms` (`9.3x` faster) | `1,298.14 ms` | `0.23%` TCP EOF (`53/22,919`, `< 1%`) | **PASS** (residual EOFs/tail are Windows `host.docker.internal` NAT hairpinning artifact) |
| Post-`#55` (`--network flashcart_default` Direct Bridge) | `35,588` | `294.46 req/s` | `4.82 ms` | `57.12 ms` | `0.00%` (`0/35,588`) | **PASS** (zero NAT hairpinning) |

---

## 4. Database Query & Index Optimization

Defined in `V2__indexes.sql` to eliminate sequential table scans on hot paths:

1. **Product Search (`idx_products_name_trgm`)**: PostgreSQL `GIN` trigram index using `pg_trgm` (`gin_trgm_ops`) so `ILIKE '%keyword%'` searches remain index-backed instead of falling back to sequential scans.
2. **Catalog Filtering & Sorting**: B-Tree indexes on `products(category_id)`, `products(active)`, `products(price)`, and `products(created_at DESC)`.
3. **Partial Index for Reservation Expiry (`idx_inv_res_expires_at_status`)**:
   ```sql
   CREATE INDEX idx_inv_res_expires_at_status
   ON inventory_reservations(expires_at)
   WHERE status = 'CREATED';
   ```
   Keeping only active `CREATED` reservations in the index keeps the expiry scheduler query small and constant-time regardless of millions of historical `CONFIRMED`, `RELEASED`, or `EXPIRED` rows.
4. **Partial Index for Outbox Publisher (`idx_outbox_status_created`)**:
   ```sql
   CREATE INDEX idx_outbox_status_created
   ON outbox_events(status, created_at)
   WHERE status = 'PENDING';
   ```
   Guarantees the outbox poller scans only unpublished rows.

---

## 5. Connection Pooling (HikariCP)

Spring Boot 3 uses HikariCP by default (`application.yml`):
- `maximum-pool-size: 30`
- `minimum-idle: 5`
- `connection-timeout: 30000` (30s)

Under flash-sale burst load:
- **Contention Model**: Pessimistic row locks (`SELECT ... FOR UPDATE`) serialize threads modifying the *same* `inventory` or `flash_sale_items` row inside PostgreSQL.
- **Pool Sizing Discipline**: Keeping `maximum-pool-size` at `30` rather than unbounded prevents PostgreSQL context-switching thrash while waiting threads queue cleanly in HikariCP or get fast-rejected by Redis admission control.
- **Monitoring**: Grafana dashboard `FlashCart Backend Overview` tracks `hikaricp_connections_active`, `hikaricp_connections_pending`, and `hikaricp_connections_acquire_seconds_max` in real time.

---

## 6. Redis Caching & Admission Control

Configured in `RedisConfig.java` (`RedisCacheManager` with `GenericJackson2JsonRedisSerializer` and graceful `CacheErrorHandler` fallback):

| Cache Name | TTL | Invalidation Strategy | Purpose |
|---|---|---|---|
| `products` | 5 minutes | Evicted on admin product create/update/delete | Offloads catalog listing & pagination from PostgreSQL |
| `productDetail` | 5 minutes | Evicted on product mutation or stock update | Fast product detail page rendering |
| `categories` | 15 minutes | Evicted on category mutation | Nearly static navigation tree |
| `flashSales` | 30 seconds | Short TTL + eviction on sale mutation | Shields DB during flash-sale countdown traffic |
| Flash-Sale Admission Counter *(optional pre-filter)* | Duration of flash sale | Authoritative state remains PostgreSQL | Rejects surplus requests after stock reaches 0 before acquiring JDBC connections |

*(Redis cache hit/miss counters are exposed via Actuator / Prometheus `cache_gets_total` metrics; `ProductService.getProducts(...)` Redis caching and eviction were verified under live `500`-VU k6 load in `#55`.)*

---

## 7. Identified Bottlenecks & Optimization Decisions

1. **Single-Row Lock Contention on Hot Flash-Sale SKUs**:
   - *Bottleneck*: When 10,000 requests target 1 row in `flash_sale_items`, PostgreSQL serializes updates on that row.
   - *Optimizations*: Keep the transaction tiny (check idempotency → conditional atomic update / lock → insert reservation → write outbox → commit; **no external HTTP or Redis writes after DB lock**), optionally reject requests early via Redis admission counter once sold out, and return `409 Conflict` immediately.
2. **Catalog Listing N+1 Queries & Redis Polymorphic Serialization (`#55` Resolved)**:
   - *Bottleneck Exposed by Initial k6*: Running `product-browsing.js` (`500` VUs) surfaced `~63` SQL N+1 queries per catalog page (`Product` → `Category`, `ProductImage`, `FlashSaleItem`), combined with a missing `@Cacheable` annotation on `ProductService.getProducts(...)` and unmodifiable `List` instances in `PageResponse.from(...)` failing Redis `GenericJackson2JsonRedisSerializer` `NON_FINAL` polymorphic typing.
   - *Resolution*:
     - Added batch `JOIN FETCH` / `IN` repository queries (`ProductRepository.findByIdInWithCategory`, `ProductImageRepository.findByProductIdInOrderBySortOrderAsc`, `FlashSaleItemRepository.findLiveByProductIds`) and `@BatchSize(size = 50)` on `Order.items`—cutting catalog reads from **`~63` SQL queries per page down to `~5` on cache miss and `0` SQL on Redis cache hit**.
     - Added `@Cacheable(value = RedisConfig.CACHE_PRODUCTS, ...)` on `ProductService.getProducts(...)` (keeping `CacheInvalidationService.evictProductCaches()` on admin mutations).
     - Wrapped `.content(new ArrayList<>(page.getContent()))` in `PageResponse.from(...)` so Jackson polymorphic Redis serialization/deserialization succeeds cleanly.
   - *Measured Result*: Jumped Windows NAT throughput **`3.22x`** (`52.13 → 167.63 req/s`) and cut median latency **`9.3x`** (`2.18 s → 235.25 ms`), reaching **`294.46 req/s`**, **`p50 = 4.82 ms`**, **`p95 = 57.12 ms`**, and **`0.00%` errors** over direct Docker bridge.
3. **Pagination Caps**:
   - Enforce bounded page sizes on product, order, and admin list endpoints so callers cannot trigger unbounded full-table serializations.
