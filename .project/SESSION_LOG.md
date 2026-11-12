# FlashCart — Session Log

## Session 2026-11-11 — Full Autonomous Build, Optimization, Testing & Handover

### Summary of Work Completed
1. **Environment & Foundation**: Inspected Windows 11 x64 environment (JDK 22 `--release 21`, Maven 3.9.14, Node 24.13.0, npm 11.6.2, Docker 29.9.2, standalone `docker-compose v5.6.1`, Git 2.50.1); initialized `master` repo, `AGENTS.md`, and `.project/` state tracking.
2. **Backend Modular Monolith (`backend/`)**: Built 14 cohesive Spring Boot 3.4 modules (`auth`, `user`, `category`, `product`, `inventory`, `cart`, `order`, `payment`, `flashsale`, `notification`, `admin`, `analytics`, `kafka`, `common`), Flyway migrations `V1`–`V3` (19 PostgreSQL tables, `CHECK` constraints, `pg_trgm` + partial indexes, seed data), Spring Security JWT + rotated `HttpOnly` refresh cookies, pessimistic `SELECT FOR UPDATE` + atomic conditional SQL inventory locks, Lua Redis admission control, Transactional Outbox + idempotent Kafka consumers + `.DLT`, and Actuator/Micrometer Prometheus metrics.
3. **Frontend SPA (`frontend/`)**: Built complete React 19 + TypeScript + Vite 8 + Tailwind CSS v3 (`3.4.17`) customer storefront and Admin portal (Dashboard, Recharts Analytics, Product/Category/Inventory/Flash-Sale/Order/Customer management), in-memory JWT + cookie refresh interceptor queue, React Hook Form + Zod validation, and Nginx reverse proxy.
4. **Performance Optimization Caught via k6 (`#55`)**: Diagnosed `product-browsing.js` initial threshold miss (`~63` SQL N+1 queries/page + missing `@Cacheable` + immutable list in `PageResponse`); fixed with batch `JOIN FETCH`/`IN` queries (~63 -> ~5 SQL on miss, 0 on hit) + `@Cacheable("products")` + `new ArrayList<>(page.getContent())`. Lifted 500-VU direct-bridge performance to `294.46 req/s`, `p50 = 4.82ms`, `p95 = 57.12ms`, `0.00%` error rate (`3.22x` throughput / `9.3x` p50 improvement over NAT).
5. **Comprehensive Verification (Post-`#55`)**:
   - Maven full suite (`mvn test -o -f backend/pom.xml "-Dspring.profiles.active=test"`): **`43/43 PASS` (`02:49 min`)** using real PostgreSQL 16, Redis 7, and Kafka 7.6 Testcontainers (incl. `FlashSaleConcurrencyIntegrationTest` `10,000` concurrent attempts vs `100` stock = `0` oversells).
   - Frontend lint + Vitest: `0` lint errors, **`11/11` PASS**.
   - Playwright E2E against live Docker Compose stack: **`2/2` PASS (`19.6 s`)**.
   - Grafana k6 load & rush suite (`product-browsing.js`, `checkout-flow.js`, `flash-sale-concurrency.js`) verified with live PostgreSQL invariant check (`ELEC-001 sold_count=100/100`, `reserved_stock=100`, `flash_sale_orders=100`, `0` oversells).
6. **Observability & Stack Reset**: Provisioned Prometheus + Grafana (`FlashCart Backend Overview`), cleanly reset volumes (`docker-compose down -v; docker-compose up -d --no-build`) so live app starts fresh and healthy on `localhost:3000` / `:8080` / `:9090` / `:3001`.
7. **Documentation & Audit**: Authored `README.md` + 14 engineering docs in `docs/` (15 total), resolved CI/doc/gitignore findings (`#59`–`#62`), updated all `.project/*.md` files, and prepared local milestone commits (no remote push without user approval).


## Session 2026-11-12 — Full-Stack Bugfix Audit, Live Verification & Redeployment

### Issues Diagnosed & Fixed
1. **`/admin/customers` HTTP 500 (`function lower(bytea) does not exist`)**: Removed nullable `:search IS NULL OR LOWER(...)` JPQL pattern in `UserRepository`; branched `UserService.listCustomers` explicitly between `findByRole` and `searchUsersByRole`; clamped `page`/`size` bounds in `AdminCustomerController`.
2. **Overlapping Live Flash Sales 500 (`IncorrectResultSizeDataAccessException`)**: Updated `FlashSaleItemRepository.findLiveByProductId` and `findLiveByProductIds` to return ordered non-sold-out candidates deterministically (`fsi.soldCount < fsi.saleStock ORDER BY fsi.salePrice ASC, fs.endTime ASC`).
3. **Product Edit `imageUrl` Ignored**: Updated `ProductService.updateProduct` to update existing primary `ProductImage` or insert one when `imageUrl` is provided, and updated `AdminProductFormPage` to load primary image URL, wait for `categoriesQuery`, handle Zod v4 numeric inputs (`setValueAs`), replace nested `<Link><Button>`, and invalidate storefront caches on deactivation.
4. **SPA Auth, Session Hint & Cross-User Cache Isolation**: Eliminated anonymous initial-load `401 /api/v1/auth/refresh` noise via `flashcart_has_session` storage hint (`auth.store.tsx` / `api.ts`), cleared React Query cache on login/register/logout/failed refresh, scoped private query keys by `user?.id ?? 'anon'` across customer pages, and fixed post-logout stale private route redirect (`Header`, `AdminLayout`, `LoginPage`).
5. **Admin & Storefront UI Guards**: Fixed `SearchInput` Clear (`X`) timer snap-back (`useRef`), fixed `AdminFlashSalesPage` local `datetime-local` timezone formatting + modal reset/validation + item remove button, enforced server-matching order status transitions in `AdminOrdersPage` and ownership/role pay/cancel guards in `OrderDetailPage`/`PaymentResultPage`, enforced integer adjustment validation in `AdminInventoryPage`, and filtered zero-count `PieChart` slices with legend formatting in `AdminDashboardPage`.

### Verification Summary (`2026-11-12`)
- **Backend (`mvn test -o -f backend/pom.xml "-Dspring.profiles.active=test"`)**: **`46/46 PASS` (`02:49 min`)** with real PostgreSQL 16, Redis 7, and Kafka 7.6 Testcontainers (including 3 new regression tests).
- **Frontend**: `oxlint` **`0` errors**; Vitest **`5 files / 13 tests PASS`** (`search-input.test.tsx` added); `tsc -b && vite build` **PASS**.
- **Live Docker Stack (`docker-compose`)**: Rebuilt `flashcart-backend:latest` and `flashcart-frontend:latest`; Playwright E2E **`2/2 PASS (23.0s)`** and full interactive browser audits passed with **`0` console/page/HTTP errors**.


## Session 2026-11-12 (Part 2) — Frontend Visual Redesign, Admin Role Separation & Verification

### Changes Implemented
1. **Admin Purchasing Separation (Backend RBAC + Service Defense + Frontend Guardrails)**:
   - Added `@PreAuthorize("hasRole('CUSTOMER')")` on `CartController`, `OrderController.checkout` & `getMyOrders`, `PaymentController.initiatePayment` & `handleCallback`, `FlashSaleController.purchase`, and `UserController` customer address endpoints; added service-layer `AccessDeniedException` checks in `OrderService`, `FlashSaleService`, and `PaymentService`.
   - Kept `GET /api/v1/orders/{id}`, order cancellation, `GET /api/v1/payments/order/{orderId}`, and `POST /api/v1/payments/{id}/refund` open to `ADMIN` + owner `CUSTOMER` so admin order management remains functional.
   - Updated frontend `useCart` (disabled for `ADMIN`), `<CustomerRoute>` guard redirecting `ADMIN` to `/admin` on `/cart`, `/checkout`, `/orders`, `/payment-result`, `Header` (hides Cart/Customer Orders), `ProfilePage` (hides Saved Addresses), and replaced buy CTAs on `ProductCard`, `ProductDetailPage`, and `FlashSaleCard`/`FlashSalePage` with `Manage` / `Edit Product` / `Manage Campaign` management actions for admins.
2. **Complete UI/UX & Typography Overhaul**:
   - Introduced `Space Grotesk`, `Plus Jakarta Sans`, and `JetBrains Mono` fonts (`index.html`, `tailwind.config.js`, `index.css`), unified Obsidian (`#0B1120`) + Electric Indigo (`#4F46E5`) + Amber (`#F59E0B`) + Slate/Alabaster surface palette, glassmorphic header, dark obsidian admin sidebar rail, smooth CSS entrance/hover transitions, and upgraded Recharts visualizations.
   - Removed generic placeholder/cliché footer & hero copy and redesigned `/payment-result` into a **Secure Sandbox Checkout** terminal (`UPI`, `Card`, `NetBanking` tabs alongside deterministic sandbox test outcomes).

### Verification Summary
- **Backend (`mvn test -o -f backend/pom.xml "-Dspring.profiles.active=test"`)**: **`47/47 PASS`** (new `AuthIntegrationTest.adminCannotUseCustomerPurchasingEndpoints_returnsForbidden` verified `403 Forbidden` across all purchasing endpoints).
- **Frontend**: `oxlint` **`0` errors**; Vitest **`14/14 PASS`** (added admin `Manage` assertion in `product.test.tsx`); `tsc -b && vite build` **PASS**.
- **Live Docker Stack & Browser Verification**: Rebuilt `flashcart-backend:latest` and `flashcart-frontend:latest`; Playwright E2E **`2/2 PASS (14.1s)`**; `verify_live_fixes.mjs` & `verify_live_mutations.mjs` **`0` console/page/HTTP errors**.
