# FlashCart — Persistent Agent Instructions

## Project Purpose
FlashCart is a production-oriented, full-stack e-commerce platform with high-concurrency inventory management and flash sales. It is designed to demonstrate real engineering depth for software engineering interviews at top product companies.

## Repository Root
`C:\Users\tanuj\Desktop\FlashCart`

## Required Stack (Non-Negotiable)
- **Backend**: Java 21 (JDK 22 installed, use `--release 21` flag), Spring Boot 3.x, Spring Security, Spring Data JPA, Hibernate, Maven
- **Database**: PostgreSQL + Flyway migrations (NO Hibernate auto-create in production)
- **Cache**: Redis (Spring Data Redis)
- **Messaging**: Apache Kafka (Spring Kafka)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + TanStack Query + React Hook Form + Zod + Recharts + Lucide
- **Testing**: JUnit 5, Mockito, Testcontainers, React Testing Library, Playwright, k6
- **DevOps**: Docker, Docker Compose (use `docker-compose` command, NOT `docker compose`), GitHub Actions
- **Observability**: Spring Actuator, Micrometer, Prometheus, Grafana

## Architecture: Modular Monolith
Modules: auth, users, products, categories, inventory, cart, orders, payments, flash-sales, notifications, admin, analytics, common

Layer structure per module: Controller → Service → Repository → Entity/DTO

## Critical Business Invariants (NEVER VIOLATE)
1. `Available Stock = Total Stock - Reserved Stock` — PostgreSQL enforces this, NEVER go negative
2. No overselling: 100 units → max 100 confirmed reservations regardless of concurrency
3. Duplicate requests MUST NOT create duplicate reservations (idempotency keys)
4. Expired reservations MUST release stock exactly ONCE (atomic state transitions)
5. Payment callbacks MUST be idempotent — duplicate success callbacks do NOT double-confirm
6. NEVER trust frontend prices or inventory values — recalculate server-side
7. NEVER expose JPA entities directly through APIs — use DTOs
8. Historical order snapshots MUST NOT change when product data changes

## Security Rules
- BCrypt or Argon2 for passwords
- JWT access tokens (short-lived) + secure HttpOnly refresh tokens (rotated)
- RBAC: CUSTOMER and ADMIN roles
- NEVER commit secrets or credentials
- `.env` files are gitignored — only `.env.example` with placeholders is committed
- Rate limit authentication endpoints
- IDOR prevention: authenticated identity determines ownership

## Coding Standards
- Controllers: NO business logic
- Services: transaction boundaries explicit
- DTOs: validation annotations
- No circular module dependencies
- Meaningful variable/method names
- Preserve all existing comments unless directly changed

## Testing Standards
- NEVER mark a test PASSED without actually running it
- NEVER mock away database in integration tests — use Testcontainers
- Concurrency test: 100 units, 10,000 concurrent attempts, 0 overselling
- Unit tests: JUnit 5 + Mockito
- Integration tests: Testcontainers (PostgreSQL, Redis, Kafka)
- E2E: Playwright

## Git Safety Rules
- NEVER force-push
- NEVER reset without approval  
- NEVER commit secrets, build output, or generated files
- Create meaningful commits after verified milestones
- Check `git status` and `git diff` before committing

## Docker Commands
Use `docker-compose` (standalone), NOT `docker compose` — the plugin is not installed on this system.
Primary startup: `docker-compose up --build`

## Deployment and Cost Rules
- NEVER provision paid resources without explicit user approval
- NEVER incur unexpected charges
- Research free-tier options first
- Ask for approval before any paid action

## Project Memory Recovery
On session start: read AGENTS.md → read all `.project/*.md` files → inspect repo structure → check git log → continue from `.project/NEXT_ACTIONS.md`

Trigger phrase: `RESUME FLASHCART DEVELOPMENT` → execute full recovery protocol

## Definition of Done
A feature is COMPLETE only when:
1. Implementation exists and is correct
2. Configuration is correct
3. It has been executed/inspected
4. Relevant tests have been run and passed
5. Edge cases have been considered
6. Actual result has been recorded in `.project/TEST_RESULTS.md`
