# FlashCart — Test Results & Verification Log

All records below capture actual executed commands, environment conditions, and observed outputs on **2026-11-11** (latest post-`#55` code revision).

---

## 1. Environment Verification (Phase 0)
| Check | Command | Observed Result |
|---|---|---|
| Java Toolchain | `java -version` | Oracle JDK 22.0.1 (`backend/pom.xml` targets `--release 21`) |
| Maven | `mvn --version` | Apache Maven `3.9.14` |
| Node.js / npm | `node --version ; npm --version` | Node `v24.13.0` / `npm 11.6.2` |
| Docker Engine | `docker --version` | Docker `29.9.2` (`3,551 MB` / `~3.47 GiB` VM RAM) |
| Docker Compose | `docker-compose --version` | `v5.6.1` standalone |
| Git | `git --version` | `2.50.1` |
| Host Hardware | Host system | Windows 11 x64, AMD Ryzen 5 7520U (`8` logical cores), `7.28 GB` RAM |

---

## 2. Backend Full Suite — Unit + Testcontainers Integration + Concurrency (Post-`#55`)
**Command**:
```powershell
$env:PATH = ($env:PATH -split ';' | ForEach-Object { $_.Trim('"') }) -join ';'
$env:DOCKER_HOST = 'npipe:////./pipe/docker_engine'
mvn test -o -f C:\Users\tanuj\Desktop\FlashCart\backend\pom.xml "-Dspring.profiles.active=test"
```
**Environment**: Real Testcontainers (`postgres:16-alpine`, `redis:7-alpine`, `confluentinc/cp-kafka:7.6.0`), Flyway migrations `V1`–`V3` (19 tables), Hibernate `ddl-auto: validate`, `spring.profiles.active=test`.
**Summary**: **`Tests run: 43, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS` (`02:49 min`, finished `2026-11-11T23:05:08+05:30`)**.

| Test Class | Tests Run | Failures / Errors / Skipped | Time Elapsed | Scope Verified |
|---|---|---|---|---|
| `AuthServiceTest` | 5 | 0 / 0 / 0 | `4.661 s` | Register, duplicate email rejection, refresh rotation & reuse detection revoking user tokens |
| `CartServiceTest` | 4 | 0 / 0 / 0 | `1.111 s` | Add/update/remove cart items, server-side subtotal calculation |
| `RateLimitAndDtoTest` | 2 | 0 / 0 / 0 | `1.076 s` | Bucket4j auth/flash-sale throttling + DTO validation constraints |
| `InventoryServiceTest` | 8 | 0 / 0 / 0 | `1.862 s` | `total - reserved` stock invariant, `InsufficientInventoryException`, reserve/confirm/release/expiry claims |
| `OrderServiceTest` | 5 | 0 / 0 / 0 | `0.514 s` | Order state transitions, immutable `OrderItem` snapshots, IDOR ownership rejection |
| `PaymentServiceTest` | 7 | 0 / 0 / 0 | `0.366 s` | Payment idempotency key deduplication, success/fail callbacks, late-payment auto-refund after expiry |
| `ProductServiceTest` | 3 | 0 / 0 / 0 | `0.897 s` | Batched page loading (category/images/inventory/live flash sale) + Redis `PageResponse<ProductDto>` JSON round-trip |
| `AuthIntegrationTest` *(Testcontainers)* | 2 | 0 / 0 / 0 | `104.4 s` | Full PG+Redis+Kafka boot, Flyway `V1`–`V3` seed check, login/refresh/reuse-detection/reset/logout, trigram search |
| `FlashSaleConcurrencyIntegrationTest` *(Testcontainers)* | 3 | 0 / 0 / 0 | `34.90 s` | **100 stock / 10,000 concurrent attempts** (100 threads + `CountDownLatch`: `100` confirmed, `9,900` rejected, **`0` oversells**); plus Redis-bypassed direct PG `25/250` locking; plus Redis counter sync & per-user idempotency |
| `KafkaOutboxIntegrationTest` *(Testcontainers)* | 1 | 0 / 0 / 0 | `0.421 s` | `outbox_events` relay -> Kafka broker -> `KafkaEventConsumer` + `processed_events` deduplication |
| `OrderPaymentIntegrationTest` *(Testcontainers)* | 3 | 0 / 0 / 0 | `1.773 s` | End-to-end checkout, payment confirmation/failure release, per-user idempotency isolation, late payment auto-refund |

---

## 3. Frontend Lint, Unit Tests & Production Build
| Check | Command | Observed Result |
|---|---|---|
| Lint (`oxlint`) | `npm --prefix C:\Users\tanuj\Desktop\FlashCart\frontend run lint` | **PASS** — `0` errors (`2` Fast Refresh warnings), `82` files, `227ms` |
| Unit Tests (`Vitest` + RTL) | `npm --prefix C:\Users\tanuj\Desktop\FlashCart\frontend test -- --run` | **PASS** — `4` files (`format.test.ts`, `cart.test.tsx`, `product.test.tsx`, `auth.test.tsx`), **`11/11` tests passed**, `27.96s` |
| TypeScript + Vite Build | `npm --prefix C:\Users\tanuj\Desktop\FlashCart\frontend run build` | **PASS** — Exit code `0` (`dist/` clean, rebuilt into `flashcart-frontend:latest` nginx container) |

---

## 4. Playwright Browser End-to-End Tests (Post-`#55`)
**Command**:
```powershell
npm --prefix C:\Users\tanuj\Desktop\FlashCart\tests\e2e test -- --reporter=list
```
**Environment**: Chromium against live 8-container Docker Compose stack (`http://localhost:3000`).
**Result**: **`2 passed (19.6 s)`**:
- `Customer Journey › complete purchase flow` (`12.8 s`): Browse products → search (`laptop`) → register customer → add item to cart → cart badge updates → checkout shipping form → place order → simulated payment success → verified in `/orders`.
- `Customer Journey › admin can manage products` (`3.7 s`): Admin login → `/admin/products` → create product (including post-`#55` Redis cache eviction) → visible in UI catalog list.

---

## 5. Grafana k6 Load & Flash-Sale Concurrency Tests (Live Stack, Post-`#55`)
Executed with `grafana/k6:latest` against the live Docker Compose backend inside the `3.47 GiB` Docker Desktop VM (`docs/PERFORMANCE.md` holds detailed breakdowns).

| Scenario & Network Path | Command Summary | Requests / Rate | Latency | Error / Check Metrics | Outcome |
|---|---|---|---|---|---|
| `product-browsing.js` (`500` VUs, `2m`, direct Docker bridge post-`#55`) | `docker run --rm --network flashcart_default ... k6 run -e BASE_URL=http://backend:8080 /scripts/product-browsing.js` | `35,588` reqs (`294.46 req/s`) | `med = 4.82 ms`, `avg = 15.02 ms`, `p90 = 28.02 ms`, **`p95 = 57.12 ms`**, `max = 758.53 ms` | `errors = 0.00%` (`0/35,588`), checks `71,176/71,176` (`100%`) | **PASS** (`p95 < 500ms`, `errors < 1%`) |
| `product-browsing.js` *(Pre-`#55` baseline via `host.docker.internal` NAT)* | `... -e BASE_URL=http://host.docker.internal:8080 ...` | `6,726` reqs (`52.13 req/s`) | `p50 = 2.18 s`, `p95 = 11.7 s` | `errors = 1.33%` (`90` TCP EOFs) | **FAIL** *(Exposed N+1 + missing cache bottleneck -> fixed in `#55`)* |
| `product-browsing.js` *(Post-`#55` comparison via `host.docker.internal` NAT)* | `... -e BASE_URL=http://host.docker.internal:8080 ...` | `22,919` reqs (`167.63 req/s`, **`3.22x`**) | `med = 235.25 ms` (**`9.3x` faster**), `p95 = 1,298.14 ms` | `errors = 0.23%` (`53` Windows NAT EOFs, `<1%` PASS) | **Improved `3.22x`** *(Bridge run isolates true backend latency from Windows NAT hairpinning)* |
| `checkout-flow.js` (`200` VUs, `3m`, direct Docker bridge post-`#55`) | `docker run --rm --network flashcart_default ... k6 run -e BASE_URL=http://backend:8080 /scripts/checkout-flow.js` | `24,781` reqs (`131.91 req/s`) | `med = 7.33 ms`, `avg = 10.21 ms`, `p90 = 15.04 ms`, **`p95 = 21.92 ms`**, `max = 6,782.65 ms` | `checkout_errors = 0.00%` (`0/24,781`), checks `24,781/24,781` (`100%`) | **PASS** (`p95 < 800ms`, `errors < 5%`) |
| `flash-sale-concurrency.js` (`100 -> 10,000 req/s` `ramping-arrival-rate`, `500–1,000` VUs, `ELEC-001` `100` stock, direct bridge post-`#55`) | `docker run --rm --network flashcart_default ... k6 run -e BASE_URL=http://backend:8080 -e SUMMARY_PATH=/scripts/results/flash-sale-results.json /scripts/flash-sale-concurrency.js` | `1,228` HTTP reqs (`61.18 req/s`; `74,271` dropped iters at `1,000` maxVUs in single-node `3.47 GiB` VM) | Overall: `p50 = 13.90 s`, `p95 = 15.65 s` · Expected `2xx`: `p50 = 11.10 s`, `p95 = 14.14 s` | **`100` `2xx` confirmed** (`<=100`), `54` `409 Conflict`, `1,072` `429` (single `customer1` `120 req/min` limit), **`0.00%` unexpected errors (`0` 5xx)** | **PASS — `0` Oversells** |

### Live PostgreSQL Post-k6 Invariant Verification
Executed immediately after `flash-sale-concurrency.js` against `flashcart-postgres`:
```sql
SELECT p.sku, i.total_stock, i.reserved_stock, (i.total_stock - i.reserved_stock) AS available_stock,
       fsi.sale_stock, fsi.sold_count, (fsi.sale_stock - fsi.sold_count) AS remaining_flash_stock
FROM flash_sale_items fsi JOIN products p ON p.id = fsi.product_id JOIN inventory i ON i.product_id = p.id;
```
**Observed Output**:
- `ELEC-001`: `total_stock = 150`, `reserved_stock = 100`, `available_stock = 50`, `sale_stock = 100`, `sold_count = 100`, `remaining_flash_stock = 0`
- `inventory_reservations`: `CREATED` count = `100` (qty = `100`), `CONFIRMED` count = `1` (qty = `1`, from prior flow)
- `orders WHERE notes LIKE 'Flash Sale%'`: `100` rows — **exact 1:1 conservation of stock, zero overselling**.

---

## 6. Clean Stack Reset & Observability Verification (`2026-11-11 23:09 IST`)
After resetting volumes cleanly (`docker-compose down -v; docker-compose up -d --no-build`):
- `GET http://localhost:8080/actuator/health` -> `200 OK` (`{"status":"UP"}`, `PostgreSQL` + `Redis 7.4.12` UP)
- `GET http://localhost:3000/api/v1/flash-sales/live` -> `200 OK` (`Weekend Tech Lightning Sale`: `ELEC-001` `100/100`, `ELEC-003` `60/60`, `ELEC-004` `40/40`)
- `GET http://localhost:3000/api/v1/products?page=0&size=5` -> `200 OK` (`totalElements: 30`)
- `GET http://localhost:9090/api/v1/targets` -> `flashcart-backend` (`health: "up"`), `prometheus` (`health: "up"`)
- `GET http://localhost:3001/api/dashboards/uid/flashcart-backend-overview` *(with admin auth)* -> `200 OK` (`"FlashCart Backend Overview"`, `7` panels)
