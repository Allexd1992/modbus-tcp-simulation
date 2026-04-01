#!/usr/bin/env pwsh

Write-Host "🔍 Проверка наличия Docker..." -ForegroundColor Yellow

try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker найден: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker не установлен!" -ForegroundColor Red
    Write-Host "📥 Установите Docker Desktop с https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    exit 1
}

Write-Host "🔨 Сборка Docker образа..." -ForegroundColor Yellow
Write-Host "📦 Тег: allexd2010/modbus-server-sim:1.0.0" -ForegroundColor Cyan

docker build -t allexd2010/modbus-server-sim:1.0.0 .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Образ успешно собран!" -ForegroundColor Green
    Write-Host "🐳 Для запуска используйте:" -ForegroundColor Cyan
    Write-Host "   docker run -p 9090:9090 -p 502:502 -p 8081:8081 allexd2010/modbus-server-sim:1.0.0" -ForegroundColor White
} else {
    Write-Host "❌ Ошибка при сборке образа!" -ForegroundColor Red
    exit 1
} 