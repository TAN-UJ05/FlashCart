#!/bin/bash
# FlashCart Local Setup Script
set -e

if [ ! -f .env ] && [ -f .env.example ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Starting FlashCart..."
docker-compose up --build -d
echo "Waiting for services to become healthy..."
sleep 30
echo "FlashCart is running!"
echo "Frontend:   http://localhost:3000"
echo "Backend:    http://localhost:8080"
echo "Swagger UI: http://localhost:8080/swagger-ui.html"
echo "Grafana:    http://localhost:3001 (admin/admin)"
echo "Prometheus: http://localhost:9090"
echo ""
echo "Development Credentials:"
echo "Admin:    admin@flashcart.com / Admin@123456"
echo "Customer: customer1@flashcart.com / Customer@123"
