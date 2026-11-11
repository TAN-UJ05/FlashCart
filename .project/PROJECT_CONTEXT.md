# FlashCart — Project Context

## Project Purpose
Production-oriented full-stack e-commerce platform demonstrating high-concurrency inventory management, flash sales, transactional outbox messaging, caching, security, and observability.

## Verified Technology Stack
| Layer | Technology | Verified Version |
|---|---|---|
| Language | Java | 21 bytecode (`--release 21`) on JDK 22 |
| Backend Framework | Spring Boot | 3.4.0 |
| Build Tool | Maven | 3.9.14 |
| Database | PostgreSQL | 16 (Flyway migrations `V1`–`V3`, 19 tables) |
| Cache / Pre-Filter | Redis | 7 (`7.4.12` in Compose; `redis:7-alpine` in tests) |
| Messaging | Apache Kafka | 3.7 (`confluentinc/cp-kafka:7.6.0`) |
| Frontend | React + TypeScript | 19 + 5.x |
| Bundler | Vite | 8.x (`frontend/package.json`) |
| Styling | Tailwind CSS | 3.x (`^3.4.17`) |
| State/Data | TanStack Query | v5 |
| Forms / Validation | React Hook Form + Zod | Installed & tested |
| Charts / Icons | Recharts + Lucide React | Installed & wired to live admin analytics |
| Containerization | Docker + Docker Compose | Docker 29.9.2 + standalone `docker-compose v5.6.1` |
| CI/CD | GitHub Actions | `.github/workflows/ci.yml` |
| Observability | Spring Actuator + Prometheus + Grafana | Provisioned in `monitoring/` |
| Testing | JUnit 5, Mockito, Testcontainers, Vitest/RTL, Playwright, Grafana k6 | Executed & verified |

## Architecture: Modular Monolith (`backend/src/main/java/com/flashcart/`)
14 cohesive backend packages (`auth`, `user`, `category`, `product`, `inventory`, `cart`, `order`, `payment`, `flashsale`, `notification`, `admin`, `analytics`, `kafka`, `common`), structured strictly as `Controller -> Service -> Repository -> Entity/DTO`, with Flyway schema governance and `spring.jpa.open-in-view=false`.

## Core Non-Negotiable Invariants
1. `Available Stock = Total Stock - Reserved Stock` — PostgreSQL `CHECK (reserved_stock <= total_stock)` and negative guards enforce zero overselling.
2. Flash-sale stock limit enforced atomically in PostgreSQL (`UPDATE flash_sale_items SET sold_count = sold_count + :qty WHERE id = :id AND (sold_count + :qty) <= sale_stock` + `CHECK (sold_count <= sale_stock)`), with optional non-authoritative Redis Lua admission pre-filter.
3. Reservation idempotency (`inventory_reservations.idempotency_key` `UNIQUE NOT NULL`) and payment idempotency (`payments.idempotency_key` `UNIQUE NOT NULL`).
4. Multi-instance safe reservation expiry via atomic `UPDATE ... WHERE status = 'CREATED'` claiming and partial index `idx_inv_res_expires_at_status`.
5. Late payment after reservation expiry triggers automatic refund and order cancellation rather than consuming unreserved stock.
6. Immutable `order_items` snapshots isolate historical orders from catalog mutations.
7. Transactional Outbox (`outbox_events`) + idempotent Kafka consumers (`processed_events`) + Dead Letter Topics (`*.DLT`).
8. Security: BCrypt password hashing, short-lived JWT access tokens (in React memory), rotated `HttpOnly; SameSite=Strict` refresh cookies with reuse detection, RBAC (`ROLE_CUSTOMER`, `ROLE_ADMIN`), IDOR ownership checks, and Bucket4j rate limiting.

## Key Environment Constraints
- **Docker Compose**: Standalone `docker-compose` (`docker compose` plugin is not installed).
- **Package Managers**: Use `npm` (`pnpm` is not installed).
- **JDK**: Oracle JDK 22 installed on Windows 11 x64; `backend/pom.xml` configures `<release>21</release>`.
- **Docker Build Environment**: `docker-compose` container builds inside a restricted network sandbox require offline staging or reachable Maven/npm registries; local builds produced verified `flashcart-backend:latest` and `flashcart-frontend:latest` images running cleanly across all 8 services.
- **Git & Cost Safety**: Local commits on `master`; zero remote push and zero paid cloud provisioning without explicit user approval.
