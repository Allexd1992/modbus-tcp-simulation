#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "logs", "status", "build", "dev")]
    [string]$Action = "start"
)

# Добавляем Docker в PATH
$env:PATH += ";C:\Program Files\Docker\Docker\resources\bin"

Write-Host "🐳 Docker Compose Manager для Modbus TCP Server" -ForegroundColor Cyan
Write-Host "Действие: $Action" -ForegroundColor Yellow

switch ($Action) {
    "start" {
        Write-Host "🚀 Запуск Modbus TCP Server из Docker Hub..." -ForegroundColor Green
        docker-compose up -d
        Write-Host "✅ Сервис запущен!" -ForegroundColor Green
        Write-Host "📊 Web API: http://localhost:8082" -ForegroundColor Cyan
        Write-Host "🔌 Modbus TCP: localhost:5021" -ForegroundColor Cyan
        Write-Host "📖 Swagger UI: http://localhost:8082/api/v1/swagger/" -ForegroundColor Cyan
    }
    
    "dev" {
        Write-Host "🔧 Запуск в режиме разработки..." -ForegroundColor Green
        docker-compose -f docker-compose.dev.yml up -d
        Write-Host "✅ Сервис запущен в режиме разработки!" -ForegroundColor Green
        Write-Host "📊 Web API: http://localhost:8082" -ForegroundColor Cyan
        Write-Host "🔌 Modbus TCP: localhost:5021" -ForegroundColor Cyan
    }
    
    "stop" {
        Write-Host "🛑 Остановка сервисов..." -ForegroundColor Yellow
        docker-compose down
        docker-compose -f docker-compose.dev.yml down
        Write-Host "✅ Сервисы остановлены!" -ForegroundColor Green
    }
    
    "restart" {
        Write-Host "🔄 Перезапуск сервисов..." -ForegroundColor Yellow
        docker-compose down
        docker-compose up -d
        Write-Host "✅ Сервисы перезапущены!" -ForegroundColor Green
    }
    
    "logs" {
        Write-Host "📋 Показать логи..." -ForegroundColor Yellow
        docker-compose logs -f
    }
    
    "status" {
        Write-Host "📊 Статус сервисов..." -ForegroundColor Yellow
        docker-compose ps
    }
    
    "build" {
        Write-Host "🔨 Сборка образа..." -ForegroundColor Yellow
        docker build -t allexd2010/modbus-server-sim:1.0.0 .
        Write-Host "✅ Образ собран!" -ForegroundColor Green
        Write-Host "📤 Загрузка в Docker Hub..." -ForegroundColor Yellow
        docker push allexd2010/modbus-server-sim:1.0.0
        Write-Host "✅ Образ загружен в Docker Hub!" -ForegroundColor Green
    }
}

Write-Host "`n💡 Использование:" -ForegroundColor Cyan
Write-Host "  .\docker-compose.ps1 start    - Запустить из Docker Hub" -ForegroundColor White
Write-Host "  .\docker-compose.ps1 dev      - Запустить в режиме разработки" -ForegroundColor White
Write-Host "  .\docker-compose.ps1 stop     - Остановить сервисы" -ForegroundColor White
Write-Host "  .\docker-compose.ps1 restart  - Перезапустить сервисы" -ForegroundColor White
Write-Host "  .\docker-compose.ps1 logs     - Показать логи" -ForegroundColor White
Write-Host "  .\docker-compose.ps1 status   - Статус сервисов" -ForegroundColor White
Write-Host "  .\docker-compose.ps1 build    - Собрать и загрузить образ" -ForegroundColor White 