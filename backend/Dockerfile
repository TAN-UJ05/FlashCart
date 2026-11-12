FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S flashcart && adduser -S flashcart -G flashcart
COPY --from=builder /app/target/*.jar app.jar
RUN mkdir -p /app/uploads && chown -R flashcart:flashcart /app
USER flashcart
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0 -XX:+UseSerialGC"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD sh -c 'wget -q -O - http://localhost:${PORT:-8080}/actuator/health || exit 1'
ENTRYPOINT ["java", "-jar", "app.jar"]
