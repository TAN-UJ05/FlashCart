# FlashCart REST API Documentation

- **Base URL**: `http://localhost:8080/api/v1` (or proxied via `http://localhost:3000/api/v1`)
- **OpenAPI / Swagger UI**: `http://localhost:8080/swagger-ui.html` (`/v3/api-docs`)
- **Authentication**: `Authorization: Bearer <accessToken>` header (`15m` JWT), paired with `HttpOnly`, `SameSite=Strict` `refreshToken` cookie (`7d`).

---

## 1. Common Response & Pagination Formats

### Standard Envelope (`ApiResponse<T>`)
```json
{
  "success": true,
  "message": "Optional status message",
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "field": "optionalFieldName",
    "value": "optionalRejectedValue"
  }
}
```
*(Fields with `null` values are omitted via `@JsonInclude(JsonInclude.Include.NON_NULL)`.)*

### Pagination (`PageResponse<T>`)
Query params: `?page=0&size=20` (server clamps `size` to max `100`).
```json
{
  "content": [ ... ],
  "pageNumber": 0,
  "pageSize": 20,
  "totalElements": 30,
  "totalPages": 2,
  "last": false,
  "first": true
}
```

### Error Status Codes (`GlobalExceptionHandler`)
| HTTP Status | Error Code | Trigger |
|---|---|---|
| `400 Bad Request` | `INVALID_OPERATION` / `MALFORMED_REQUEST` / `INVALID_PARAMETER` | Validation failure (`data` contains field map), malformed JSON, invalid state transition |
| `401 Unauthorized` | `UNAUTHORIZED` / `BAD_CREDENTIALS` / `AUTHENTICATION_REQUIRED` | Missing/expired JWT, invalid credentials, refresh token reuse detected |
| `403 Forbidden` | `FORBIDDEN` / `ACCESS_DENIED` | Insufficient role (`CUSTOMER` hitting `/admin/**`) |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Entity UUID/ID or slug does not exist |
| `409 Conflict` | `DUPLICATE_RESOURCE` / `INSUFFICIENT_INVENTORY` / `FLASH_SALE_ERROR` | Duplicate email/SKU, out of stock, sold-out flash sale |
| `402 Payment Required` | `PAYMENT_ERROR` | Payment-specific processing error |
| `429 Too Many Requests` | `RATE_LIMITED` | Bucket4j limit exceeded on `/auth/*` or `/flash-sales/*/purchase` |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected server error (logged with `X-Correlation-ID`) |

---

## 2. Health & Observability Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | Application health response (`status`, `service`, `timestamp`) |
| `GET` | `/actuator/health` | Public | Spring Boot Actuator detailed health (DB, Redis, Disk) |
| `GET` | `/actuator/prometheus` | Public (dev) | Prometheus metrics scrape endpoint |

---

## 3. Authentication Endpoints (`/api/v1/auth`)

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Yes | Register `CUSTOMER` account, returns `AuthResponse` (`accessToken`, `user`) and sets `refreshToken` cookie |
| `POST` | `/api/v1/auth/login` | Public | Yes | Authenticate email/password, issues JWT + `refreshToken` cookie |
| `POST` | `/api/v1/auth/refresh` | Cookie / Body | Yes | Rotates refresh token (detects reuse and revokes all user sessions on replay) |
| `POST` | `/api/v1/auth/logout` | Cookie / Body | No | Revokes current refresh token and clears cookie |
| `GET` | `/api/v1/auth/me` | Authenticated | No | Returns current authenticated `UserDto` |
| `POST` | `/api/v1/auth/forgot-password` | Public | Yes | Issues single-use 1h reset token and queues `PASSWORD_RESET` notification |
| `POST` | `/api/v1/auth/reset-password` | Public | Yes | Validates reset token, updates BCrypt password, revokes all active refresh tokens |

---

## 4. User Profile & Addresses (`/api/v1/users/me`)

All endpoints require authentication; ownership is bound to `@AuthenticationPrincipal User`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/users/me` | Get authenticated user's profile |
| `PUT` | `/api/v1/users/me` | Update `firstName`, `lastName`, `phone` |
| `PUT` | `/api/v1/users/me/password` | Change password (verifies current password) |
| `GET` | `/api/v1/users/me/addresses` | List saved shipping addresses (default first) |
| `POST` | `/api/v1/users/me/addresses` | Create new shipping address |
| `PUT` | `/api/v1/users/me/addresses/{id}` | Update saved address (ownership verified) |
| `DELETE` | `/api/v1/users/me/addresses/{id}` | Delete saved address (ownership verified) |

---

## 5. Products, Images & Categories

### Public Catalog
| Method | Path | Query Params / Body | Description |
|---|---|---|---|
| `GET` | `/api/v1/products` | `page`, `size`, `sortBy` (`createdAt`\|`price`\|`name`), `sortDir` (`asc`\|`desc`), `categoryId`, `search`, `minPrice`, `maxPrice` | Paginated, filtered active product catalog |
| `GET` | `/api/v1/products/search` | `q`, `page`, `size` | Search active products by keyword |
| `GET` | `/api/v1/products/{id}` | — | Single product details + images + stock info |
| `GET` | `/api/v1/images/{filename}` | — | Serve uploaded product image (`Cache-Control: max-age=86400`) |
| `GET` | `/api/v1/categories` | — | List active categories |
| `GET` | `/api/v1/categories/{id}` | — | Get category by numeric ID |
| `GET` | `/api/v1/categories/slug/{slug}` | — | Get category by URL slug |

---

## 6. Shopping Cart (`/api/v1/cart`)

All endpoints require authentication.

| Method | Path | Request Body | Description |
|---|---|---|---|
| `GET` | `/api/v1/cart` | — | Fetch user's cart with server-calculated subtotal/total |
| `POST` | `/api/v1/cart/items` | `{ productId, quantity }` | Add item or increment quantity (validates stock) |
| `PUT` | `/api/v1/cart/items/{productId}` | `{ quantity }` | Update item quantity (`0` removes or enforces `>= 1`) |
| `DELETE` | `/api/v1/cart/items/{productId}` | — | Remove product from cart |
| `DELETE` | `/api/v1/cart` | — | Clear entire cart |

---

## 7. Orders (`/api/v1/orders`)

All endpoints require authentication.

| Method | Path | Headers / Body | Description |
|---|---|---|---|
| `POST` | `/api/v1/orders/checkout` | Optional `Idempotency-Key` header; `{ addressId \| shipping..., notes, idempotencyKey }` | Reserves inventory (`SELECT FOR UPDATE`), computes server-side prices, snapshots `OrderItem`s, clears cart, emits `OrderCreated` outbox event |
| `GET` | `/api/v1/orders` | `?page=0&size=10` | Paginated order history for current user |
| `GET` | `/api/v1/orders/{id}` | — | Order detail with items & shipping snapshot (IDOR-checked) |
| `POST` | `/api/v1/orders/{id}/cancel` | — | Cancel unpaid/pending order and release reserved inventory |

---

## 8. Payments (`/api/v1/payments`)

All endpoints require authentication.

| Method | Path | Headers / Body | Description |
|---|---|---|---|
| `POST` | `/api/v1/payments/initiate` | Optional `Idempotency-Key`; `{ orderId, idempotencyKey }` | Creates idempotent `PENDING` payment using server-side `order.totalAmount` (rejects expired reservations) |
| `POST` | `/api/v1/payments/callback` | `{ paymentId \| transactionId, outcome: "SUCCEEDED"\|"FAILED"\|"TIMEOUT", failureReason }` | Idempotent callback processor; confirms reservations or releases/auto-refunds late payments |
| `POST` | `/api/v1/payments/{id}/refund` | — | Refund a `SUCCEEDED` payment and restore inventory |
| `GET` | `/api/v1/payments/order/{orderId}` | — | List payment attempts for an order (ownership checked) |

---

## 9. Flash Sales (`/api/v1/flash-sales`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/flash-sales` | Public | List active and upcoming flash sales |
| `GET` | `/api/v1/flash-sales/live` | Public | List currently live flash sales |
| `GET` | `/api/v1/flash-sales/{id}` | Public | Flash sale details and remaining item stock |
| `POST` | `/api/v1/flash-sales/{id}/purchase` | Authenticated (Rate Limited) | Body `{ productId, quantity, idempotencyKey, addressId \| shipping... }` + optional `Idempotency-Key` header. Atomically claims flash-sale quota + reserves warehouse stock + creates order |

---

## 10. Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Authenticated | Paginated notifications for current user (`?page=0&size=20`) |

---

## 11. Admin Endpoints (`/api/v1/admin/**`, requires `ROLE_ADMIN`)

| Module | Method | Path | Description |
|---|---|---|---|
| **Products** | `GET` | `/api/v1/admin/products` | List all products (including inactive), filter by `search`, `categoryId` |
| **Products** | `POST` | `/api/v1/admin/products` | Create product + initial inventory record |
| **Products** | `PUT` | `/api/v1/admin/products/{id}` | Update product details |
| **Products** | `DELETE` | `/api/v1/admin/products/{id}` | Soft-deactivate product |
| **Products** | `POST` | `/api/v1/admin/products/{id}/images` | Upload `multipart/form-data` image (`file`, `altText`, `isPrimary`) |
| **Products** | `DELETE` | `/api/v1/admin/products/{id}/images/{imageId}` | Remove product image |
| **Categories** | `GET` | `/api/v1/admin/categories` | List all categories (active & inactive) |
| **Categories** | `POST` | `/api/v1/admin/categories` | Create category |
| **Categories** | `PUT` | `/api/v1/admin/categories/{id}` | Update category |
| **Categories** | `DELETE` | `/api/v1/admin/categories/{id}` | Deactivate category |
| **Inventory** | `GET` | `/api/v1/admin/inventory` | Paginated warehouse inventory list |
| **Inventory** | `GET` | `/api/v1/admin/inventory/low-stock` | Items with `availableStock <= threshold` (default `10`) |
| **Inventory** | `GET` | `/api/v1/admin/inventory/product/{productId}` | Get inventory row for a product |
| **Inventory** | `PUT` | `/api/v1/admin/inventory/product/{productId}/adjust` | Adjust stock (`adjustment` delta or `newTotalStock` >= `reservedStock`) |
| **Orders** | `GET` | `/api/v1/admin/orders` | List all orders (optional `?status=` filter) |
| **Orders** | `PATCH` | `/api/v1/admin/orders/{id}/status` | Advance/cancel/refund order status (`UpdateOrderStatusRequest`) |
| **Flash Sales** | `GET` | `/api/v1/admin/flash-sales` | List all flash sales for management |
| **Flash Sales** | `POST` | `/api/v1/admin/flash-sales` | Create flash sale with item allocations |
| **Flash Sales** | `PUT` | `/api/v1/admin/flash-sales/{id}` | Update flash sale window/status |
| **Flash Sales** | `POST` | `/api/v1/admin/flash-sales/{id}/items` | Add/update flash sale item price & stock |
| **Flash Sales** | `DELETE` | `/api/v1/admin/flash-sales/{id}` | Deactivate flash sale |
| **Customers** | `GET` | `/api/v1/admin/customers` | Paginated customer list with optional `?search=` |
| **Customers** | `PATCH` | `/api/v1/admin/customers/{id}/status` | Enable/disable customer account (`{ "enabled": boolean }`) |
| **Analytics** | `GET` | `/api/v1/admin/analytics/dashboard` | Dashboard stats, daily revenue series (`?days=30`), status breakdown, top products, low stock |
