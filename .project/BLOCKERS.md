# FlashCart — Blockers & Action Items

## Active External Items Requiring Explicit User Authorization (Phase 16)
None blocking local execution, testing, or verification. Live **public cloud deployment** requires user decisions/credentials:

1. **GitHub Remote Repository Push** *(Optional until user approves remote push)*
   - **Why**: Required to host code remotely and trigger `.github/workflows/ci.yml` or Git-connected cloud deployments.
   - **Cost**: `$0` (GitHub free tier).
   - **Action needed**: Explicit approval + target repository URL/authentication (per Git safety rules, no automated push was performed).

2. **Cloud Hosting Provider Choice & Credentials (Phase 16)**
   - **Why**: Deploying live public URLs requires signing into external platforms (Vercel/Netlify, Render/Railway, Neon, Upstash).
   - **Cost Options**: `$0` Hobby split architecture (Vercel/Netlify + Neon PG + Upstash Redis + Render Free with cold start / `KAFKA_ENABLED=false`) OR `~$5–$14/mo` paid always-on stack (Railway Hobby / Render Always-On).
   - **Action needed**: Review options in Phase 16 summary (`docs/DEPLOYMENT.md`) and authorize chosen provider/account setup.

## Resolved Engineering & Environment Blockers
1. **[RESOLVED] N+1 Catalog Bottleneck & Missing Product List Cache (`#55`)**: Initial `product-browsing.js` 500-VU k6 test failed latency/EOF thresholds (`p95 = 11.7s`, `1.33%` errors). Diagnosed ~63 SQL queries/page + disabled list cache + immutable `List` serialization issue under `GenericJackson2JsonRedisSerializer`; resolved in `ProductService` / `PageResponse` / repositories (`p95 = 57.12ms`, `0.00%` errors on Docker bridge).
2. **[RESOLVED] Outbox Notification Serialization & Delivery Gap (`#50`)**: Ensured registration/password-reset/order/payment events serialize cleanly and dispatch asynchronously through `outbox_events` -> Kafka -> `KafkaEventConsumer` -> `[MOCK EMAIL]`.
3. **[RESOLVED] Local Docker Build DNS/NAT Failure**: Multi-stage Dockerfiles remain untouched for CI/standard hosts; local container images built cleanly using external scratch staging directory without leaving untracked artifacts in the repo.
4. **[RESOLVED] Quoted Windows `PATH` & Docker Pipe Access for Testcontainers**: Stripping embedded quotes from `PATH` (`DOCKER_HOST=npipe:////./pipe/docker_engine`) allowed Testcontainers `postgres:16-alpine`, `redis:7-alpine`, and `confluentinc/cp-kafka:7.6.0` to boot cleanly (`43/43` PASS).
5. **[RESOLVED] Windows `host.docker.internal` NAT Hairpinning & k6 Docs Bug**: Fixed `docs/TESTING.md` (`host-gateway` + `--network flashcart_default -e BASE_URL=http://backend:8080`) for zero-NAT Docker bridge benchmarking.
6. **[RESOLVED] Stray Root `test-results/` Folder**: Deleted temporary root `test-results/` and added `test-results/` to `.gitignore`.
