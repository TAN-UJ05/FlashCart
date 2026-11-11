# FlashCart Troubleshooting Guide

Common development, Docker, database, messaging, and build issues—and how to resolve them.

---

## 1. Backend Won't Start

**Symptoms**: Container `flashcart-backend` exits with code 1 or `mvn spring-boot:run` fails during context startup.

**Checks**:
- **Inspect logs**:
  ```powershell
  docker-compose logs -f backend
  ```
- **Missing JWT secret**: Ensure `FLASHCART_JWT_SECRET` (or `JWT_SECRET` in `.env`) is at least **32 characters** long for HMAC-SHA256 (`Keys.hmacShaKeyFor`). Shorter keys throw `WeakKeyException`.
- **Port 8080 already bound**: Another local process is listening on port 8080.
  ```powershell
  netstat -ano | findstr :8080
  ```
  Stop the conflicting process or map a different host port in `docker-compose.yml`.

---

## 2. Database Connection Failures

**Symptoms**: `PSQLException: Connection to postgres:5432 refused` or `FATAL: password authentication failed`.

**Causes & Fixes**:
1. **Docker vs. Host URL mismatch**:
   - Inside Docker (`docker-compose`), the backend must connect to `jdbc:postgresql://postgres:5432/flashcart`.
   - Running Maven/IDE locally on Windows must connect to `jdbc:postgresql://localhost:5432/flashcart`.
2. **Postgres still initializing**: Wait until `docker-compose ps` shows `postgres` status as `healthy`.
3. **Stale volume credentials**: If you changed `POSTGRES_PASSWORD` after creating the volume, the old password remains persisted inside `postgres_data`. Reset the local volume (destroys local dev data):
   ```powershell
   docker-compose down -v ; docker-compose up -d postgres
   ```

---

## 3. Redis Connection Failures

**Symptoms**: `RedisConnectionFailureException: Unable to connect to Redis`.

**Checks**:
- Confirm Redis container is healthy:
  ```powershell
  docker exec flashcart-redis redis-cli ping
  # Expected: PONG
  ```
- Verify `SPRING_DATA_REDIS_HOST` is `redis` inside Docker and `localhost` when running on the host.
- **Graceful Degradation**: FlashCart's `RedisConfig` is designed to degrade gracefully when Redis is unavailable for caching, falling back to PostgreSQL queries instead of crashing every catalog read.

---

## 4. Kafka Connection Failures

**Symptoms**: `Connection to node -1 (localhost/127.0.0.1:9092) could not be established` or `Broker may not be available`.

**Causes & Fixes**:
1. **Zookeeper not ready before Kafka**: Check `docker-compose logs zookeeper kafka`. Restart Kafka if Zookeeper restarted:
   ```powershell
   docker-compose restart kafka
   ```
2. **Advertised listener mismatch (Docker internal vs. Windows host)**:
   - Containers inside the Compose network need an internal listener (e.g., `kafka:9092` or `kafka:29092`), while tools running directly on the Windows host (e.g., locally launched `mvn spring-boot:run`) resolve `localhost:9092`.
   - Verify `KAFKA_ADVERTISED_LISTENERS` in `docker-compose.yml` matches how your backend process runs (containerized vs. host).

---

## 5. Flyway Migration Failures

**Symptoms**: `FlywayValidateException: Validate failed: Migrations have failed validation` or checksum mismatch.

**Causes & Fixes**:
- **Edited an already-applied migration file**: Never modify `V1__initial_schema.sql`, `V2__indexes.sql`, or `V3__seed_data.sql` after they have been executed against a database. Add a new versioned migration (`V4__...sql`) instead.
- **Dirty local dev state**: Reset local Postgres volume cleanly:
  ```powershell
  docker-compose down -v ; docker-compose up --build -d
  ```
- **Hibernate schema mismatch**: `spring.jpa.hibernate.ddl-auto=validate` fails startup if a JPA entity field or column name disagrees with Flyway SQL. Compare the entity `@Column` mapping against `V1__initial_schema.sql`.

---

## 6. JWT Token & Refresh Cookie Issues

**Symptoms**: Repeated `401 Unauthorized` after login, or silent refresh failing on page reload.

**Checks**:
1. **Cookie blocked by `SameSite` / `Secure` mismatch**:
   - Over local HTTP (`http://localhost:3000`), the refresh cookie must NOT set `Secure=true` (browsers reject `Secure` cookies over plain HTTP except sometimes localhost quirks; keep `Secure` profile-driven).
2. **Frontend / Backend origin mismatch**:
   - Use `http://localhost:3000` consistently (not `http://127.0.0.1:3000`) so `withCredentials: true` and CORS `Access-Control-Allow-Credentials: true` match `FRONTEND_URL`.
3. **Refresh token reuse revocation**:
   - If two concurrent browser tabs or tests submit the **same** old refresh token twice, reuse detection revokes all refresh tokens for that user. Re-login to issue a fresh token family.

---

## 7. Docker Networking & Windows `docker-compose` Issues

**Symptoms**: `'docker compose' is not a docker command` or container DNS lookup failure.

**Fixes**:
- Always use standalone `docker-compose` (with hyphen) on this environment:
  ```powershell
  docker-compose up --build
  ```
- Do **not** use `&&` in Windows PowerShell 5.1; use `;` to chain commands:
  ```powershell
  docker-compose down ; docker-compose up --build -d
  ```
- **Docker Build `Network is unreachable` / `Connection timed out` hitting Maven Central or npmjs**:
  On Windows hosts where ISP/network routing requires IPv6 or blocks Linux container bridge NAT to `repo.maven.apache.org` / `registry.npmjs.org`, `docker build` inside BuildKit containers can fail even when host Maven/npm builds succeed. The repository's standard multi-stage Dockerfiles (`backend/Dockerfile` and `frontend/Dockerfile`) are preserved for CI and standard Docker hosts; on NAT-restricted or offline workstations, either enable Docker Desktop IPv6 / configure HTTP proxy settings, or package the application locally (`mvn package -o -DskipTests -f backend/pom.xml` and `npm --prefix frontend run build`) before building runtime images.

---

## 8. Port Conflicts

Default ports used by the FlashCart stack:

| Port | Service |
|---|---|
| `3000` | Frontend (Nginx / Vite) |
| `3001` | Grafana |
| `5432` | PostgreSQL |
| `6379` | Redis |
| `8080` | Backend API |
| `9090` | Prometheus |
| `9092` | Kafka |
| `2181` | Zookeeper |

Find and inspect occupying processes on Windows:
```powershell
Get-NetTCPConnection -LocalPort 8080,3000,5432,6379,9092 -ErrorAction SilentlyContinue | Format-Table LocalPort,State,OwningProcess
```

---

## 9. Memory Issues (Docker / JVM / Kafka)

**Symptoms**: Containers killed with exit code `137` (OOMKilled) or slow builds inside Docker.

**Fixes**:
- Allocate at least **6–8 GB RAM** to Docker Desktop (WSL2 `.wslconfig`) because PostgreSQL + Redis + Zookeeper + Kafka + Spring Boot + Prometheus + Grafana run simultaneously.
- Limit JVM heap inside containers if memory is tight by adding `JAVA_TOOL_OPTIONS=-Xmx512m` to the `backend` environment in `docker-compose.yml`.

---

## 10. Maven & Frontend Build Failures

### Backend (`mvn compile` / JDK 22)
- **Symptom**: Annotation processor or `--release` failure with JDK 22 + Lombok/MapStruct.
- **Fix**: Verify `pom.xml` configures `<source>21</source>`, `<target>21</target>`, and `<arg>--release</arg><arg>21</arg>` with `lombok-mapstruct-binding`. Run:
  ```powershell
  mvn clean compile -f backend\pom.xml
  ```

### Frontend (`npm run build`)
- **Symptom**: `pnpm` not recognized or Tailwind v4 PostCSS errors.
- **Fix**: Use `npm` (not `pnpm`) and ensure Tailwind CSS v3.x (`tailwindcss@^3.4.17`) is installed matching `tailwind.config.js`:
  ```powershell
  cd frontend ; npm install ; npm run build
  ```

### Testcontainers Fails on Windows
- **Symptom**: `Could not find a valid Docker environment`.
- **Fix**: Ensure Docker Desktop is running before executing `mvn test -f backend\pom.xml`.
