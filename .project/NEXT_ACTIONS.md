# FlashCart — Next Actions

## Current State
All local development, optimization, full-stack container orchestration, automated test suites (`43/43` backend + Testcontainers, `11/11` Vitest, `2/2` Playwright E2E), k6 load & 10,000-attempt flash-sale concurrency verification, observability provisioning, and engineering documentation are **complete** and recorded locally on branch `master`.

## Optional Next Actions (Requires User Input / Authorization)
1. **Remote GitHub Push & CI Execution** *(Free — Requires user GitHub repo URL & permission)*
   - Create a GitHub repository, add `origin`, and run `git push -u origin master` to trigger `.github/workflows/ci.yml`.
2. **Optional Cloud Deployment (Phase 16)** *(Requires user provider selection & account auth)*
   - **`$0` Free Split Option**: Vercel/Netlify (`frontend/`, `/api/*` rewrite) + Neon PostgreSQL 16 + Upstash Redis (`REDIS_SSL=true`) + Render Free Web Service (`backend/`, `SPRING_PROFILES_ACTIVE=prod`, `KAFKA_ENABLED=false`).
   - **Always-On Paid Option (`~$5–$14/mo`)**: Railway Hobby (`$5/mo`) or Render Starter (`$7/mo` web + `$6–$7/mo` managed PostgreSQL), avoiding 15-minute free-tier sleep cold starts.

## Live Local Services Currently Running
- Storefront & Admin UI: `http://localhost:3000` (Nginx + `/api/*` proxy; seeded admin `admin@flashcart.com` / `Admin@123456`, customers `customer1@flashcart.com` & `customer2@flashcart.com` / `Customer@123`)
- Backend API & Swagger UI: `http://localhost:8080/swagger-ui.html` (`Actuator /actuator/health` -> `UP`)
- Grafana & Prometheus: `http://localhost:3001` (`admin`/`admin`) & `http://localhost:9090`

## Session Recovery Protocol
1. Read `AGENTS.md` and all `.project/*.md` files.
2. Run `git status` and `git log --oneline -10`.
3. Inspect container state via `docker-compose ps`.
