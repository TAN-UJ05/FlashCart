# FlashCart Deployment Guide

This guide covers local development with Docker Compose, environment configuration, production hardening (`application-prod.yml`), verified 2026 cloud hosting options, deployment steps, and operational rollback procedures.

---

## 1. Local Development with Docker Compose

> **System Note**: On Windows in this repository, use the standalone `docker-compose` binary, **not** `docker compose`.

### Quick Start
1. Copy the environment template:
   ```powershell
   Copy-Item .env.example .env
   ```
   *(Or on Linux/macOS: `cp .env.example .env`)*
2. Start the entire stack (PostgreSQL, Redis, Zookeeper, Kafka, Backend, Frontend, Prometheus, Grafana):
   ```powershell
   docker-compose up --build -d
   ```
   Alternatively, run the helper script:
   - Windows PowerShell: `.\scripts\setup.ps1`
   - Linux/macOS/Git Bash: `./scripts/setup.sh`

3. Verify service health:
   ```powershell
   docker-compose ps
   curl http://localhost:8080/actuator/health
   ```

### Local Service Endpoints

| Service | URL | Credentials / Notes |
|---|---|---|
| Frontend (React + Nginx) | `http://localhost:3000` | Proxies `/api/*` to `backend:8080` |
| Backend API | `http://localhost:8080` | Spring Boot 3.4 |
| Swagger UI | `http://localhost:8080/swagger-ui.html` | Interactive OpenAPI spec (enabled in `dev`, disabled in `prod`) |
| Actuator Health / Metrics | `http://localhost:8080/actuator/health`, `/actuator/prometheus` | Used by Docker & Prometheus |
| Grafana | `http://localhost:3001` | `admin` / `admin` |
| Prometheus | `http://localhost:9090` | Scrapes backend every 15s |
| PostgreSQL | `localhost:5432` | DB `flashcart`, user `flashcart` |
| Redis | `localhost:6379` | Append-only persistence enabled |
| Kafka | `localhost:9092` | Single local broker (`kafka:29092` internal, `localhost:9092` external) |

---

## 2. Environment Variables & `prod` Profile (`application-prod.yml`)

Base configuration lives in `backend/src/main/resources/application.yml`, while production overrides live in `backend/src/main/resources/application-prod.yml` (`SPRING_PROFILES_ACTIVE=prod`).

| Variable | Description / Property | Dev Default (`docker-compose.yml` / `dev`) | `prod` Default / Requirement (`application-prod.yml`) |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Active Spring profile | `dev` | `prod` |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://postgres:5432/flashcart` | Managed PostgreSQL with SSL (`?sslmode=require`) |
| `SPRING_DATASOURCE_USERNAME` | PostgreSQL user | `flashcart` | Dedicated least-privilege DB user |
| `SPRING_DATASOURCE_PASSWORD` | PostgreSQL password | `flashcart_dev` | Required (no fallback in `prod`; startup fails if omitted) |
| `SPRING_DATA_REDIS_HOST` | Redis hostname | `redis` | Managed Redis / Upstash host |
| `SPRING_DATA_REDIS_PORT` | Redis port | `6379` | `6379` |
| `REDIS_PASSWORD` | `spring.data.redis.password` | *(empty)* | Required for managed Redis / Upstash |
| `REDIS_SSL` | `spring.data.redis.ssl.enabled` | `false` | `false` default in `prod`; set `true` for Upstash / TLS Redis |
| `KAFKA_ENABLED` | `spring.kafka.listener.auto-startup` & `flashcart.kafka.enabled` | `true` | `true` default; set `false` to cleanly disable `OutboxPublisher`, `KafkaEventConsumer`, and `KafkaConfig` when no Kafka broker is provisioned |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | Kafka broker list | `kafka:29092` (Compose internal; host `localhost:9092`) | Managed Kafka brokers (SASL/SSL) when `KAFKA_ENABLED=true` |
| `FLASHCART_JWT_SECRET` | `flashcart.jwt.secret` (min 32 chars) | Fallback only in `dev` / `test` profiles | Required (no default fallback in base `application.yml` or `prod`) |
| `FLASHCART_COOKIE_SECURE` | `flashcart.jwt.cookie-secure` | `false` | `true` default in `prod` (requires HTTPS/TLS) |
| `FLASHCART_TRUST_PROXY` | `flashcart.rate-limit.trust-proxy` | `false` | Set `true` only behind a trusted reverse proxy/load balancer |
| `FLASHCART_UPLOAD_DIRECTORY` | Local product image path | `/app/uploads/images` | Persistent volume or object storage adapter |
| `FRONTEND_URL` | Allowed CORS origin (`flashcart.cors.allowed-origins`) | `http://localhost:3000` | `https://app.yourdomain.com` |
| `HEALTH_SHOW_DETAILS` | `management.endpoint.health.show-details` | `always` | `when_authorized` default in `prod` |
| `SWAGGER_ENABLED` | `springdoc.swagger-ui.enabled` & `springdoc.api-docs.enabled` | `true` | `false` default in `prod` |
| `LOG_LEVEL` | `logging.level.com.flashcart` | `INFO` | `INFO` default in `prod` |

### Same-Origin Cookie Requirement for Static Frontend Hosting
`frontend/src/services/api.ts` sets `baseURL: '/api/v1'` with `withCredentials: true`, and `AuthController` sets the refresh token cookie with `HttpOnly; SameSite=Strict`. When hosting the React build on **Vercel** or **Netlify** separately from the backend API URL, configure platform **proxy rewrites** (`/api/:path*` → `https://<your-backend-host>/api/:path*`) rather than calling a cross-origin API domain directly from the browser. This keeps requests same-origin and prevents browsers from rejecting `SameSite=Strict` refresh cookies.

---

## 3. Local Dev vs. Production Configuration Differences

| Aspect | Local Development (`dev`) | Production (`prod` / `application-prod.yml`) |
|---|---|---|
| **JWT Secret** | Dev fallback in `application-dev.yml` | Mandatory `FLASHCART_JWT_SECRET` (no default; startup fails if unset) |
| **JWT Cookie Flags** | `HttpOnly`, `SameSite=Strict`, `Secure=false` (`FLASHCART_COOKIE_SECURE=false`) | `HttpOnly`, `SameSite=Strict`, `Secure=true` (`FLASHCART_COOKIE_SECURE=true`) |
| **SQL Logging** | Optional | Disabled (`spring.jpa.show-sql: false`) |
| **Redis TLS** | Plain TCP (`REDIS_SSL=false`) | TLS supported via `REDIS_SSL=true` |
| **Kafka Graceful Toggle** | Local broker (`KAFKA_ENABLED=true`) | `KAFKA_ENABLED=true`, or `KAFKA_ENABLED=false` for zero-Kafka free-tier demos (persists `outbox_events` in PostgreSQL without broker errors) |
| **Actuator Exposure** | `health.show-details: always`, Prometheus exposed locally | `HEALTH_SHOW_DETAILS=when_authorized`; restrict `/actuator/prometheus` to internal VPC/scraper |
| **Swagger UI & OpenAPI Docs** | Enabled at `/swagger-ui.html` | Disabled (`SWAGGER_ENABLED=false`) |
| **Image Storage** | Local volume (`uploads_data`) | Object storage (S3 / Cloudflare R2 / Supabase Storage) |
| **HTTPS / TLS & Rewrites** | Nginx proxies `/api/*` over HTTP on localhost | Edge HTTPS + Vercel/Netlify `/api/*` rewrite to backend |

---

## 4. Cloud Deployment Options & Verified 2026 Provider Comparison

> **Cost Policy**: Per project rules, no paid cloud infrastructure is provisioned without explicit user approval. The comparison below reflects verified 2026 pricing and free-tier terms.

| Provider / Component | Free / Hobby Tier (2026 Verified) | Paid Estimate | Pros for FlashCart | Limitations |
|---|---|---|---|---|
| **Vercel / Netlify (Frontend)** | `$0` Hobby static CDN + automatic HTTPS | `$0` free tier | Zero-config Vite build + edge `/api/*` proxy rewrite to keep `SameSite=Strict` cookies same-origin | Commercial team usage requires paid plans |
| **Render (Backend Web + PG)** | Hobby `$0/mo` (`5 GB` egress); Free Web `<1 CPU / 512MB RAM` (`750 hrs/mo`); Free PostgreSQL **expires after 30 days** | Always-on Web `$7/mo` + Basic PostgreSQL `$6–$7/mo` | Simple Git/Docker deploy, managed TLS | Free web service spins down after 15m idle (~60s cold start); Free DB expires in 30 days |
| **Neon (PostgreSQL 16)** | Permanent `$0` Free (`100 CU-hrs/mo`, `1 GB` storage, `5 GB` egress) | Scales usage-based on paid tiers | Permanent free PostgreSQL 16 with SSL + Flyway compatibility | Auto-scales to zero after 5m idle (short wake latency) |
| **Upstash (Redis)** | Permanent `$0` Free (`250 MB` storage, `500k` commands/mo, `10 GB/mo` bandwidth) | Pay-as-you-go above limits | Serverless TLS Redis compatible with Spring Data Redis (`REDIS_SSL=true`) | Monthly command cap (`500k`) can be hit by sustained load tests |
| **Railway** | 30-day `$5` Trial → reverts to `$0` Free (`$1/mo` credit, `1 vCPU / 0.5 GB RAM`) or `$5/mo` Hobby | Usage-based (`$5/mo` Hobby minimum) | Clean Docker workflow + internal networking + simple env management | `$1/mo` free credit limits continuous 24/7 JVM runtime without Hobby plan |
| **Fly.io** | Pay-as-you-go (legacy permanent free allowance discontinued for new accounts; card required) | `~$2–$6.70/mo` for `256MB–1GB` VM | Multi-region edge VMs and private WireGuard networking | Card required; Spring Boot JVM requires `>= 512MB` RAM |
| **Confluent Cloud (Kafka)** | `$400` 30-day promo credits on Basic cluster (no forever-free cluster) | Usage-based after trial credits expire | Managed Kafka without operating Zookeeper | Not `$0` long-term; set `KAFKA_ENABLED=false` for zero-cost demo mode |

### Recommended `$0` Zero-Cost Split Architecture
1. **Frontend**: **Vercel** or **Netlify (`$0` Hobby)** with `/api/:path*` proxy rewrite pointing to the backend URL.
2. **Backend**: **Render Free Web Service (`$0`, accepting ~60s wake latency after 15m idle)** or **Railway Hobby (`$5/mo` / trial)** running `backend/Dockerfile` with `SPRING_PROFILES_ACTIVE=prod`.
3. **Database**: **Neon PostgreSQL 16 (`$0` permanent free tier)** (`?sslmode=require`).
4. **Redis**: **Upstash Redis (`$0` permanent free tier)** with `REDIS_SSL=true`.
5. **Kafka**: Set **`KAFKA_ENABLED=false`** for `$0` zero-Kafka demo deployment (disables `OutboxPublisher`, `KafkaEventConsumer`, and `KafkaConfig` cleanly while retaining `outbox_events` persistence in PostgreSQL), or connect **Confluent Cloud** when `KAFKA_ENABLED=true`.

---

## 5. Production Deployment Steps

1. **Provision External Infrastructure**: Create PostgreSQL 16 database (Neon/RDS), Redis instance (Upstash with TLS), and optionally Kafka (Confluent Cloud / MSK if `KAFKA_ENABLED=true`).
2. **Configure Backend Environment Variables**:
   - `SPRING_PROFILES_ACTIVE=prod`
   - `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
   - `SPRING_DATA_REDIS_HOST`, `SPRING_DATA_REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL=true`
   - `KAFKA_ENABLED=true` (with `SPRING_KAFKA_BOOTSTRAP_SERVERS`, or `KAFKA_ENABLED=false` without Kafka)
   - `FLASHCART_JWT_SECRET` (cryptographically random 256+ bit secret; no fallback in `prod`)
   - `FLASHCART_COOKIE_SECURE=true`, `FRONTEND_URL=https://app.yourdomain.com`
   - `SWAGGER_ENABLED=false`, `HEALTH_SHOW_DETAILS=when_authorized`, `LOG_LEVEL=INFO`
3. **Configure Frontend Rewrite**: Add a rewrite rule in `vercel.json` / `netlify.toml` forwarding `/api/:path*` to `https://<backend-domain>/api/:path*`.
4. **Validate Database Migrations**: Flyway runs automatically on boot (`spring.flyway.enabled=true`). Pre-validate ahead of traffic cutover via:
   ```bash
   mvn flyway:validate -f backend/pom.xml
   ```
   *(Keep `spring.jpa.hibernate.ddl-auto=validate`; never use `create` or `update` in production.)*
5. **Build & Push Container Images**:
   ```bash
   docker build -t flashcart-backend:latest ./backend
   docker build -t flashcart-frontend:latest ./frontend
   ```
6. **Verify Deployment**:
   - `GET https://app.yourdomain.com/actuator/health` (or backend health endpoint) returns `{"status":"UP"}`.
   - `GET https://app.yourdomain.com/api/v1/products` returns catalog items cleanly through the same-origin proxy rewrite.
   - Sign-in returns JWT access token and sets `HttpOnly; SameSite=Strict; Secure` refresh cookie.

---

## 6. Rollback Procedure

1. **Application Rollback**:
   - Re-deploy the previous immutable container tag (e.g., `flashcart-backend:<previous-git-sha>`) on your orchestrator or cloud platform dashboard.
   - Wait for `/actuator/health` to return `200 OK` before shifting traffic back.
2. **Database Schema Safety**:
   - **Rule**: Follow **expand-and-contract** migrations. Never drop columns or rename tables in a single release if an older application container might roll back against the schema.
   - Because Flyway migrations are forward-only (`V1`, `V2`, `V3`, ...), if a breaking migration occurred in production:
     1. Take an immediate snapshot/backup before any manual intervention.
     2. Restore from pre-deployment database snapshot if data corruption occurred, or apply a new forward corrective migration (`V{N+1}__revert_...sql`) rather than mutating already-applied Flyway checksums.
3. **Outbox & Kafka Replay Safety**:
   - Pending `outbox_events` remain safely in PostgreSQL during backend restarts or when `KAFKA_ENABLED=false`. Once a healthy container boots with `KAFKA_ENABLED=true`, `OutboxPublisher` resumes publishing automatically, and idempotent consumers (`processed_events`) prevent duplicate processing.
