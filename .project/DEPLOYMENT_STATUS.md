# FlashCart — Deployment Status

## Current Live Deployment Status
- **Local Production-Like Docker Compose Stack**: **RUNNING & VERIFIED HEALTHY** (all 8 containers cleanly reset with fresh volumes and verified via HTTP probes on `2026-11-11`):
  - Frontend (`flashcart-frontend`): `http://localhost:3000` (React 19 SPA + Nginx `/api/*` reverse proxy)
  - Backend (`flashcart-backend`): `http://localhost:8080` (`/actuator/health` -> `{"status":"UP"}`, `/actuator/prometheus`, `/swagger-ui.html`, `/v3/api-docs`)
  - Prometheus (`flashcart-prometheus`): `http://localhost:9090` (scraping `flashcart-backend` & `prometheus` -> both `up`)
  - Grafana (`flashcart-grafana`): `http://localhost:3001` (`admin`/`admin`, provisioned Prometheus datasource + `FlashCart Backend Overview` dashboard)
  - PostgreSQL 16 (`flashcart-postgres`): `localhost:5432` (Flyway `V1`–`V3` seeded cleanly)
  - Redis 7 (`flashcart-redis`): `localhost:6379` (`7.4.12`)
  - Apache Kafka 3.7 + Zookeeper (`flashcart-kafka`, `flashcart-zookeeper`): `localhost:9092` / `kafka:29092`
- **Public Cloud Live URL**: **NOT DEPLOYED** (Phase 16 research & production config completed; awaiting explicit user approval for provider choice, account authorization, and Git push).

## Production Hardening Completed (`application-prod.yml` & `docs/DEPLOYMENT.md`)
- Mandatory `FLASHCART_JWT_SECRET` in `prod` (no insecure default fallback)
- Mandatory `SPRING_DATASOURCE_PASSWORD` in `prod`
- `FLASHCART_COOKIE_SECURE=true` default in `prod` (`SameSite=Strict` + proxy rewrite compatibility via relative `/api/v1` base URL)
- `REDIS_SSL` configurable (`true` for TLS-enabled Upstash/managed Redis)
- `KAFKA_ENABLED` clean feature toggle (`true`/`false` disables `OutboxPublisher`, `KafkaEventConsumer`, and `KafkaConfig` when deploying without Kafka)
- `SWAGGER_ENABLED=false` & `HEALTH_SHOW_DETAILS=when_authorized` defaults in `prod`

## Verified 2026 Cloud Cost Comparison Summary
| Component | `$0` Free / Hobby Option | Always-On Paid Estimate | Trade-off |
|---|---|---|---|
| Frontend | Vercel / Netlify Free (`$0`, `/api/*` proxy rewrite) | `$0` hobby | Static CDN + HTTPS; free hobby non-commercial |
| Backend (Spring Boot) | Render Free (`$0`, `512MB`, 15m idle spin-down) | Railway Hobby `$5/mo` or Render Starter `$7/mo` | Render Free has ~60s cold start; always-on eliminates sleep |
| PostgreSQL 16 | Neon Free (`$0` permanent, `1 GB`, `100 CU-hrs/mo`) | Render Basic PG `$6–$7/mo` or Railway usage | Neon wakes quickly on connect (avoid Render Free PG 30-day expiry) |
| Redis 7 | Upstash Free (`$0`, `250 MB`, `500k cmds/mo`, `REDIS_SSL=true`) | Railway Redis usage | `500k` commands/mo sufficient for demos, not heavy load testing |
| Kafka | `KAFKA_ENABLED=false` (`$0`, outbox persists in PG) | Confluent Cloud `$400` 30-day promo -> pay-as-you-go | Zero-cost demo cleanly disables broker polling without code changes |

## Pre-Production Verification Checklist
- [x] PostgreSQL migrations (`V1`–`V3`) & schema validation (`ddl-auto: validate`) verified
- [x] Seed data loaded cleanly (`ELEC-001` 100 flash-sale stock, categories, products, admin/customer demo users)
- [x] Health, Prometheus, Swagger (dev), and Grafana endpoints verified `200 OK`
- [x] Customer registration, login, checkout, payment simulator verified in Playwright E2E
- [x] Admin catalog management verified in Playwright E2E
- [x] Flash-sale concurrency (`100` stock, `10,000` attempts, `0` oversells) verified in Testcontainers + k6
- [ ] User approval obtained for public cloud provider & GitHub remote push
- [ ] Live cloud URL deployed & health-checked
