# FlashCart — Known Limitations

This document transparently lists the deliberate scope boundaries, local-development shortcuts, and known architectural limitations of FlashCart.

---

## 1. Simulated Payment Gateway
- **Current behavior**: `PaymentService` implements a deterministic `SIMULATOR` provider (`PaymentProvider.SIMULATOR`) with explicit endpoints/actions to simulate payment success, failure, timeout, and refund.
- **Limitation**: No real money moves, and there is no live Stripe, Razorpay, or PCI-DSS card-vault integration.
- **Mitigation path**: The `payments` table, `idempotency_key`, state machine, and webhook callback handler mirror real gateway webhooks (`PAYMENT_SUCCEEDED` / `PAYMENT_FAILED`). See [PAYMENT_FLOW.md](./PAYMENT_FLOW.md) for the exact Stripe/Razorpay adapter steps.

## 2. Mock Email Delivery
- **Current behavior**: `NotificationService` persists notification records (`PENDING → QUEUED → DELIVERED/FAILED`) in PostgreSQL and logs the email payload (registration, password reset token, order confirmation, payment failure) via SLF4J rather than dispatching via an external SMTP provider by default.
- **Limitation**: Password reset tokens and order confirmations are visible in application logs and the `notifications` table rather than arriving in a real inbox unless SMTP credentials are configured.

## 3. Single-Node Kafka Broker
- **Current behavior**: `docker-compose.yml` runs a single Zookeeper and a single Kafka broker with `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1`.
- **Limitation**: There is no broker-level fault tolerance or partition replication in the local Docker topology.
- **Mitigation path**: Production deployment requires a 3-broker managed cluster (e.g., Confluent Cloud or MSK) with replication factor `3` and `min.insync.replicas = 2`.

## 4. Local Filesystem Image Storage
- **Current behavior**: Uploaded product images are saved to `FLASHCART_UPLOAD_DIRECTORY` (`/app/uploads/images` in Docker, backed by volume `uploads_data`) and served by the Spring Boot backend.
- **Limitation**: Local container volumes do not replicate across horizontally scaled backend instances and are unsuitable for multi-node cloud production.
- **Mitigation path**: Introduce a `StorageService` implementation targeting Amazon S3, Cloudflare R2, or Supabase Storage behind a CDN.

## 5. Local / Single-Machine Load Tests Only
- **Current behavior**: k6 load tests (`tests/load/*.js`) and concurrency tests target local Docker containers or Testcontainers on a single developer workstation.
- **Limitation**: Throughput and tail-latency benchmarks reflect single-host CPU, disk I/O, and Docker bridge networking rather than multi-AZ production hardware.

## 6. Polling Instead of WebSockets / SSE for Inventory Updates
- **Current behavior**: Live flash-sale stock counts and order statuses refresh via HTTP API fetches (TanStack Query polling/refetch) rather than persistent WebSocket or Server-Sent Events (SSE) connections.
- **Limitation**: Users viewing a flash-sale page may see slightly stale remaining-stock numbers for a few seconds until the next query poll, though the server-side purchase endpoint always enforces exact real-time stock.

## 7. No Distributed Tracing Backend (Jaeger / Zipkin / OpenTelemetry Collector)
- **Current behavior**: Every request receives a correlation ID stored in SLF4J MDC and logged across layers, and metrics are scraped by Prometheus for Grafana.
- **Limitation**: There is no OpenTelemetry trace exporter sending spans across HTTP → DB → Outbox → Kafka consumer boundaries into Jaeger or Tempo.

## 8. Single Primary PostgreSQL Instance (No Read Replicas)
- **Current behavior**: Both transactional writes (`SELECT FOR UPDATE` reservations) and read-heavy queries (`GET /products`, `GET /admin/analytics/*`) share one PostgreSQL 16 node (partially shielded by Redis caching on product/category reads).
- **Limitation**: Heavy analytical queries or sustained high-concurrency flash-sale traffic share connection pool capacity (`HikariCP`) and disk I/O with OLTP writes.

## 9. In-Memory / Local Bucket4j Rate Limiting Default
- **Current behavior**: Rate limiting protects authentication endpoints using Bucket4j. Without a distributed Redis-backed `ProxyManager` enabled across multiple instances, each JVM instance tracks buckets independently.
- **Mitigation path**: Wire Bucket4j's `LettuceBasedProxyManager` to the existing Redis cluster when scaling beyond one backend instance.

## 10. Single-Currency / Simplified Pricing Model
- **Current behavior**: All monetary columns use `NUMERIC(10, 2)` without a multi-currency column or external tax/shipping rate calculator API.
- **Limitation**: Suitable for single-region pricing demonstration; international storefronts would require `currency` columns (ISO-4217), FX rate snapshots, and regional tax rules.
