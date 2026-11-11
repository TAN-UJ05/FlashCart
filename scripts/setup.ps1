# FlashCart Local Setup Script (Windows PowerShell)
$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
}

Write-Host "Starting FlashCart..."
docker-compose up --build -d
Write-Host "Waiting for services to become healthy..."
Start-Sleep -Seconds 30
Write-Host "FlashCart is running!"
Write-Host "Frontend:   http://localhost:3000"
Write-Host "Backend:    http://localhost:8080"
Write-Host "Swagger UI: http://localhost:8080/swagger-ui.html"
Write-Host "Grafana:    http://localhost:3001 (admin/admin)"
Write-Host "Prometheus: http://localhost:9090"
Write-Host ""
Write-Host "Development Credentials:"
Write-Host "Admin:    admin@flashcart.com / Admin@123456"
Write-Host "Customer: customer1@flashcart.com / Customer@123"
