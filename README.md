# FlashCart

[![Java](https://img.shields.io/badge/Java-21%20(%2D%2Drelease%2021)-orange.svg)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-TypeScript%20%2B%20Vite-blue.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Kafka](https://img.shields.io/badge/Apache%20Kafka-3.7-231F20.svg)](https://kafka.apache.org/)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF.svg)](./.github/workflows/ci.yml)

**FlashCart** is a production-oriented, full-stack e-commerce platform engineered to solve high-concurrency inventory reservation, zero-oversell flash sales, idempotent payment processing, and reliable event-driven messaging.

---

## Problem Statement

Under normal storefront load, standard CRUD apps appear to work—until a flash sale drops **100 units** to **10,000 concurrent buyers**. Naive read-then-write implementations fail catastrophically through:
- **TOCTOU Race Conditions & Overselling**: Two threads read `available = 1` and both confirm an order.
- **Duplicate Requests / Retries**: Double-taps or network timeouts reserve or charge inventory twice.
- **Phantom / Lost Async Events**: Writing to PostgreSQL and publishing to Kafka separately causes dual-write inconsistencies.
- **Late Payment Callbacks**: Succeeding a payment after a reservation expires steals stock allocated to another customer.

FlashCart solves these at the database, transaction, and messaging boundaries with verifiable invariants.

---

## Key Features

- **Zero-Oversell Inventory Engine**: PostgreSQL pessimistic row locks (`SELECT ... FOR UPDATE`), `CHECK (reserved_stock <= total_stock)` constraints, and canonical multi-item lock ordering.
- **Multi-Instance Safe Expiry Scheduler**: Automatically releases abandoned `CREATED` reservations after 15 minutes using atomic `UPDATE ... WHERE status = 'CREATED'` claims (backed by partial PostgreSQL indexes).
- **High-Concurrency Flash-Sale Engine**: Atomic `sold_count <= sale_stock` enforcement (`CHECK` constraint + `FOR UPDATE`), optional Redis admission control (`flashsale:stock:{flashSaleId}:{productId}`), and graceful fallback to PostgreSQL.
- **Idempotent Payment Simulator**: Supports `PENDING`, `SUCCEEDED`, `FAILED`, `TIMEOUT`, and `REFUNDED` transitions, ignores duplicate callbacks, and automatically refunds late payments arriving after reservation expiry.
- **Transactional Outbox & Kafka Consumers**: Domain events (`OrderCreated`, `PaymentSucceeded`, `PaymentFailed`, `InventoryReleased`, `NotificationRequested`) persist atomically in `outbox_events` (`Propagation.MANDATORY`), publish via `OutboxPublisher`, and deduplicate at consumers via `processed_events` + `.DLT` dead-letter topics.
- **Hardened Authentication & RBAC**: BCrypt hashing, short-lived JWT access tokens (15m, in memory), `HttpOnly` `SameSite=Strict` rotated refresh cookies (7d) with reuse detection, Bucket4j rate limiting, and service-layer IDOR checks.
- **Full Customer & Admin Storefront**: Catalog search (`pg_trgm` GIN index), filtering, persistent cart, checkout with shipping address book, order history/timeline, flash sales with live countdowns, and an admin console with Recharts analytics, inventory adjustment, and image upload.
- **Observability Stack**: Spring Boot Actuator, Micrometer Prometheus metrics, pre-provisioned Grafana dashboard, and `X-Correlation-ID` MDC request tracing.

---

## Technology Stack

| Layer | Technology | Version / Details |
|---|---|---|
| **Backend** | Java 21 (`--release 21`), Spring Boot, Spring Security, Spring Data JPA | Spring Boot `3.4.0`, MapStruct `1.6.3`, Lombok |
| **Database & Migrations** | PostgreSQL, Flyway | PostgreSQL `16`, `V1` schema, `V2` indexes, `V3` seed data |
| **Cache & Rate Limiting** | Redis, Bucket4j | Redis `7`, `RedisCacheManager` (graceful fallback), Bucket4j `8.10.1` |
| **Messaging** | Apache Kafka, Spring Kafka | Kafka `3.7` + Zookeeper, Transactional Outbox + DLT |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS | TanStack Query, React Hook Form + Zod, Recharts, Lucide |
| **Testing** | JUnit 5, Mockito, Testcontainers, Vitest + RTL, Playwright, k6 | Real PG/Redis/Kafka containers (no mocked DB in integration) |
| **Observability** | Actuator, Micrometer, Prometheus, Grafana | Pre-provisioned datasource & `FlashCart Backend Overview` dashboard |
| **DevOps & CI** | Docker, `docker-compose`, GitHub Actions | Multi-stage Dockerfiles + CI (`backend-build`, `frontend-build`, `security-check`) |

---

## Architecture Overview

FlashCart is built as a **Modular Monolith** under `com.flashcart.*` (`auth`, `user`, `category`, `product`, `inventory`, `cart`, `order`, `payment`, `flashsale`, `notification`, `admin`, `analytics`, `kafka`, `common`), structured strictly as **Controller → Service → Repository → Entity/DTO**. Keeping core modules in one deployment unit enables single-transaction ACID consistency across order creation, inventory locking, and outbox recording while preserving clean module boundaries for future service extraction.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for diagrams and deep architectural trade-offs.

---

## Local Setup Instructions

### Prerequisites
- **Java 21+** (JDK 22 supported via `--release 21` in `pom.xml`)
- **Node.js 20.19+ or 22.12+** (required by Vite 8; tested with Node 24 + `npm`)
- **Docker & Docker Compose** (use standalone `docker-compose` on Windows)

### Setup Steps
1. **Clone the repository**:
   ```powershell
   git clone <your-repo-url>
   cd FlashCart
   ```
2. **Create environment file**:
   ```powershell
   Copy-Item .env.example .env
   ```
   *(Linux/macOS: `cp .env.example .env`)*
3. **Start the full stack**:
   ```powershell
   docker-compose up --build
   ```
   Or use the helper scripts:
   - Windows PowerShell: `.\scripts\setup.ps1`
   - Linux/macOS/Git Bash: `./scripts/setup.sh`
4. **Access Services**:
   - **Frontend Storefront**: http://localhost:3000
   - **Backend API**: http://localhost:8080
   - **Swagger UI**: http://localhost:8080/swagger-ui.html
   - **Grafana**: http://localhost:3001 (`admin` / `admin`)
   - **Prometheus**: http://localhost:9090

---

## Development Credentials (Local Dev Only)

Seeded automatically by Flyway `V3__seed_data.sql` for local development and testing:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@flashcart.com` | `Admin@123456` |
| **Customer 1** | `customer1@flashcart.com` | `Customer@123` |
| **Customer 2** | `customer2@flashcart.com` | `Customer@123` |

*(Never use development seed credentials in production deployments.)*

---

## Documentation Index

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Modular monolith design, module boundaries, diagrams, trade-offs |
| [docs/DATABASE_DESIGN.md](./docs/DATABASE_DESIGN.md) | Mermaid ER diagram, all 19 tables, index strategy, constraints |
| [docs/INVENTORY_CONCURRENCY.md](./docs/INVENTORY_CONCURRENCY.md) | `SELECT FOR UPDATE`, `CHECK` constraints, expiry safety, TOCTOU defense |
| [docs/FLASH_SALE_DESIGN.md](./docs/FLASH_SALE_DESIGN.md) | Thundering herd control, Redis pre-filter, atomic sale stock |
| [docs/PAYMENT_FLOW.md](./docs/PAYMENT_FLOW.md) | Payment states, idempotency, late-payment auto-refund policy |
| [docs/KAFKA_EVENT_FLOW.md](./docs/KAFKA_EVENT_FLOW.md) | Transactional outbox, topics, `processed_events`, DLT retries |
| [docs/SECURITY.md](./docs/SECURITY.md) | JWT + `HttpOnly` cookie rotation, reuse detection, RBAC, IDOR, rate limiting |
| [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) | Complete REST API reference grouped by module |
| [docs/TESTING.md](./docs/TESTING.md) | Testing pyramid, Testcontainers, Playwright, k6, CI |
| [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) | Load test scenarios, HikariCP, Redis TTLs, benchmarks |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Environment config, cloud comparison, deployment & rollback |
| [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common Docker, DB, Kafka, Flyway, and build fixes |
| [docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md) | Honest scope boundaries and production gaps |
| [docs/INTERVIEW_PREPARATION.md](./docs/INTERVIEW_PREPARATION.md) | 40 deep engineering Q&As & 30s/1m/3m project pitches |

---

## Running Tests & Benchmarks

### Backend Unit & Integration Tests (Testcontainers)
*(Requires Docker running for Testcontainers PostgreSQL, Redis, and Kafka)*
```powershell
mvn test -f backend/pom.xml -Dspring.profiles.active=test
```

### High-Concurrency Oversell Test
```powershell
mvn test -f backend/pom.xml -Dtest=FlashSaleConcurrencyIntegrationTest -Dspring.profiles.active=test
```

### Frontend Build & Component Tests
```powershell
cd frontend ; npm test -- --run ; npm run build
```

### Playwright End-to-End Tests
```powershell
cd tests/e2e ; npm install ; npx playwright install chromium ; npx playwright test
```

### k6 Load & Flash-Sale Rush Tests
```powershell
k6 run tests/load/product-browsing.js
k6 run tests/load/checkout-flow.js

# 10,000-attempt flash-sale concurrency spike (auto-discovers live sale + 100-stock item + customer1 login)
k6 run -e SUMMARY_PATH=tests/load/results/flash-sale-results.json tests/load/flash-sale-concurrency.js

# Optional overrides: -e FLASH_SALE_ID=... -e PRODUCT_ID=... -e TEST_USER_TOKEN=... -e STAGE_SCALE=0.1
```

> **Verification Status (Verified 2026-11-11)**: **`43/43`** Maven unit + Testcontainers tests PASS (`02:49 min`, including `FlashSaleConcurrencyIntegrationTest` `3/3` in `34.90 s` with `100` confirmed / `9,900` rejected / **`0` oversells**), **`11/11`** Vitest frontend tests PASS, **`2/2`** Playwright E2E flows PASS (`19.6 s`), and live k6 direct-bridge benchmarks PASS (`294.46 req/s` browsing at `p95 = 57.12 ms`, `0.00%` error rate, **`0` oversells** in PostgreSQL on flash-sale rush). See [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) and [.project/TEST_RESULTS.md](./.project/TEST_RESULTS.md).

---

## Known Limitations & Future Improvements

FlashCart intentionally uses a simulated payment provider, local filesystem image storage, mock email logging, a single-node Kafka broker, and polling UI updates (see [docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md)).

**Planned / Future Improvements**:
- Live Stripe / Razorpay payment adapter with HMAC webhook signature verification
- S3 / Cloudflare R2 object storage for product media
- Server-Sent Events (SSE) + Redis Pub/Sub for live flash-sale stock updates
- Redis-backed distributed Bucket4j rate limiting (`LettuceBasedProxyManager`)
- OpenTelemetry distributed tracing (Tempo / Jaeger) & read-replica routing for analytics
