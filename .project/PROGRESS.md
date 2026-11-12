# FlashCart — Progress Tracker

## Current Status
**All local engineering, full-stack integration, concurrency verification, k6 load testing, observability, containerization, and documentation phases (Phases 0–15, Phase 17) are COMPLETE and VERIFIED.**
**Phase 16 (Cloud Deployment)** is researched and configuration-hardened (`application-prod.yml`, `DEPLOYMENT.md`, `$0` split-stack plan + paid comparison ready), awaiting explicit user authorization before pushing to GitHub or provisioning cloud services.

## Verified Environment Specs
- OS: Windows 11 x64 (`AMD Ryzen 5 7520U`, 8 logical cores, `7.28 GB` host RAM)
- Docker Desktop VM: `3,551 MB` (`~3.47 GiB` limit), Docker `29.9.2`, `docker-compose v5.6.1` standalone
- Java: JDK 22 compiling with `--release 21` (`pom.xml`), Maven `3.9.14`
- Node.js / npm: Node `v24.13.0`, npm `11.6.2`
- Git: `2.50.1` (`master` branch)

## Phase Completion Summary
- [x] **Phase 0**: Environment inspection, Git init, `AGENTS.md`, `.project/` memory system
- [x] **Phase 1**: Backend modular monolith skeleton (`com.flashcart.*`), Frontend Vite+React+TS+Tailwind v3 (`3.4.17`) shell, Docker Compose, `.gitignore`, `.env.example`
- [x] **Phase 2**: PostgreSQL 16 schema (`V1__initial_schema.sql` 19 tables + constraints, `V2__indexes.sql`, `V3__seed_data.sql`), JPA entities & repositories
- [x] **Phase 3**: Auth module (JWT + rotated `HttpOnly` refresh cookies + reuse detection + password reset + Bucket4j rate limiting + login/register/reset pages)
- [x] **Phase 4**: Product & Category CRUD, search (`pg_trgm` GIN index), pagination, image storage/serving, admin product management, batch query + `@Cacheable` N+1 fix (`#55`)
- [x] **Phase 5**: Inventory locking (`SELECT FOR UPDATE`, `CHECK` constraints), `InventoryReservation` lifecycle, multi-instance safe expiry scheduler
- [x] **Phase 6**: Cart & Order workflows, server-side price recalculation, `OrderItem` snapshots, cancellation, order history/detail UI
- [x] **Phase 7**: Payment simulator (`SUCCEEDED` / `FAILED` / `TIMEOUT` / `REFUNDED`), idempotency keys, late-payment auto-refund, UI payment simulator
- [x] **Phase 8**: Flash-sale engine (atomic conditional SQL + `CHECK` constraint + optional Redis Lua admission control & rollback sync), countdown UI & admin management
- [x] **Phase 9**: Redis 7 caching (`RedisCacheManager`, TTLs `5m`/`15m`/`30s`, `GenericJackson2JsonRedisSerializer`, graceful `CacheErrorHandler` fallback)
- [x] **Phase 10**: Kafka Transactional Outbox (`outbox_events` `PENDING`/`PUBLISHED`/`FAILED`), `OutboxPublisher` (`FOR UPDATE SKIP LOCKED`), `KafkaEventConsumer` idempotency (`processed_events`) + `.DLT` dead-letter topics, `KAFKA_ENABLED` toggle
- [x] **Phase 11**: Notifications (`REGISTRATION`, `PASSWORD_RESET`, `ORDER_CONFIRMATION`, `PAYMENT_FAILED` mock email + DB tracking) & Admin Analytics (Recharts + live PostgreSQL aggregation)
- [x] **Phase 12**: Complete customer & admin React UI (Home, Catalog, Search, Product Detail, Flash Sales, Cart, Checkout, Payment Result, Orders, Profile, Addresses, Admin Dashboard/Products/Categories/Inventory/Flash Sales/Orders/Analytics)
- [x] **Phase 13**: Automated Tests — Backend `47/47` PASS (Unit `35/35` + Testcontainers `12/12` incl. 10,000-attempt concurrency & admin purchasing RBAC), Frontend Vitest `14/14` PASS, Playwright E2E `2/2` PASS, Live zero-error browser audits PASS
- [x] **Phase 14**: Observability & Load Tests — Actuator + Prometheus + Grafana dashboard verified `UP`, k6 `product-browsing.js` (`294.46 req/s`, `p95=57.12ms`, `0%` errors), `checkout-flow.js` (`131.91 req/s`, `p95=21.92ms`, `0%` errors), `flash-sale-concurrency.js` (`100` confirmed, `0` oversells verified in PostgreSQL)
- [x] **Phase 15**: Docker & CI/CD — 8-container Compose stack verified from fresh volume reset, `.github/workflows/ci.yml` configured (backend, frontend, trufflehog security scan)
- [ ] **Phase 16**: Cloud Deployment — Provider evaluation & `$0` vs paid comparison complete (`docs/DEPLOYMENT.md`); **awaiting explicit user approval & account auth** before GitHub push or cloud provisioning
- [x] **Phase 17**: Final documentation (14 docs in `docs/` + `README.md` = 15 total), `.project/` state synchronization, security/QA audit, local milestone Git commit
