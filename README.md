# Modbus TCP Server Simulator

Rust-приложение, реализующее Modbus TCP сервер с REST API, Swagger документацией и **MCP** (Model Context Protocol) по HTTP для подключения ИИ-клиентов (например Cursor).

## 🚀 Быстрый запуск

### Вариант 1: Docker Compose (рекомендуется)

```bash
# Запуск из Docker Hub
docker-compose up -d

# Или с локальной сборкой для разработки
docker-compose -f docker-compose.dev.yml up -d
```

### Вариант 2: Локальная сборка

```bash
# Сборка и запуск
cargo run

# Или сборка релиза
cargo build --release
./target/release/modbus_tcp_server_rust
```

### Вариант 3: PowerShell скрипт

```powershell
# Запуск из Docker Hub
.\docker-compose.ps1 start

# Запуск в режиме разработки
.\docker-compose.ps1 dev

# Остановка
.\docker-compose.ps1 stop

# Просмотр логов
.\docker-compose.ps1 logs
```

## 📊 Доступные сервисы

После запуска доступны следующие сервисы:

| Сервис | URL | Описание |
|--------|-----|----------|
| **Web API** | http://localhost:9090 | REST API для управления Modbus регистрами |
| **Swagger UI** | http://localhost:9090/api/v1/swagger/ | Интерактивная документация API |
| **Modbus TCP** | localhost:5021 | Modbus TCP сервер |
| **MCP (HTTP)** | http://localhost:8081/mcp | Streamable HTTP, те же регистры/coils, что и у REST (см. ниже) |
| **Веб-UI регистров** | http://localhost:9090/ui/ | Статическая страница: чтение/запись через REST (тот же store) |

При локальном `cargo run` без Docker: Web API по умолчанию на **9090**, Modbus на **502**, MCP по умолчанию на **8081** — см. переменные окружения. UI: **`http://localhost:<WEB_SERVER_PORT>/ui/`**.

## 🔌 Подключение к Modbus TCP

### Параметры подключения:
- **IP адрес**: `localhost` или `127.0.0.1`
- **Порт**: `5021` (или `502` при локальном запуске)
- **Unit ID**: `1` (по умолчанию)

### Пример подключения с помощью Python:

```python
from pymodbus.client import ModbusTcpClient

# Подключение к серверу
client = ModbusTcpClient('localhost', 5021)

if client.connect():
    print("✅ Подключение успешно!")
    
    # Чтение holding registers
    result = client.read_holding_registers(0, 10)
    print(f"Holding registers: {result.registers}")
    
    # Запись в holding register
    client.write_register(0, 12345)
    
    client.close()
else:
    print("❌ Ошибка подключения!")
```

### Пример подключения с помощью Node.js:

```javascript
const ModbusRTU = require('modbus-serial');

const client = new ModbusRTU();
client.connectTCP("localhost", { port: 5021 });

client.readHoldingRegisters(0, 10)
    .then(data => {
        console.log("Holding registers:", data.data);
    })
    .catch(err => {
        console.error("Ошибка:", err);
    });
```

## 📖 Swagger UI - Интерактивная документация

### Доступ к Swagger UI:

1. Откройте браузер
2. Перейдите по адресу: **http://localhost:9090/api/v1/swagger/**
3. Вы увидите интерактивную документацию API

### Основные разделы API:

#### 🔧 Управление Holding Registers
- `GET /api/v1/holding-registers/{addr}/{cnt}` - Чтение регистров хранения
- `POST /api/v1/holding-register/{addr}/{data}` - Запись в регистр хранения
- `POST /api/v1/holding-registers/{addr}` - Запись нескольких регистров

#### 📊 Управление Input Registers
- `GET /api/v1/input-registers/{addr}/{cnt}` - Чтение входных регистров
- `POST /api/v1/input-register/{addr}/{data}` - Запись в входной регистр
- `POST /api/v1/input-registers/{addr}` - Запись нескольких входных регистров

#### ⚡ Управление Discrete Coils
- `GET /api/v1/discrete-coils/{addr}/{cnt}` - Чтение дискретных катушек
- `POST /api/v1/discrete-coil/{addr}/{data}` - Запись в дискретную катушку
- `POST /api/v1/discrete-coils/{addr}` - Запись нескольких катушек

#### 🔌 Управление Discrete Inputs
- `GET /api/v1/discrete-inputs/{addr}/{cnt}` - Чтение дискретных входов
- `POST /api/v1/discrete-input/{addr}/{data}` - Запись в дискретный вход
- `POST /api/v1/discrete-inputs/{addr}` - Запись нескольких дискретных входов

### Примеры использования Swagger UI:

#### 1. Чтение Holding Registers
1. Найдите endpoint `GET /api/v1/holding-registers/{addr}/{cnt}`
2. Нажмите "Try it out"
3. Введите параметры:
   - `addr`: `0` (начальный адрес)
   - `cnt`: `10` (количество регистров)
4. Нажмите "Execute"
5. Получите результат в формате JSON

#### 2. Запись в Holding Register
1. Найдите endpoint `POST /api/v1/holding-register/{addr}/{data}`
2. Нажмите "Try it out"
3. Введите параметры:
   - `addr`: `0` (адрес регистра)
   - `data`: `12345` (значение для записи)
4. Нажмите "Execute"
5. Получите подтверждение записи

#### 3. Запись нескольких регистров
1. Найдите endpoint `POST /api/v1/holding-registers/{addr}`
2. Нажмите "Try it out"
3. Введите параметры:
   - `addr`: `0` (начальный адрес)
   - Request body: `[100, 200, 300, 400, 500]`
4. Нажмите "Execute"

## 🤖 MCP (Model Context Protocol)

Отдельный HTTP-сервер (Axum) с транспортом **Streamable HTTP** по пути **`/mcp`**. Доступ к данным тем же in-memory хранилищем, что и REST API: чтение/запись holding/input registers и discrete coils/inputs через **tools** (имена вида `modbus_read_holding_registers`, `modbus_write_holding_registers` и т.д.).

### Адрес и переменная окружения

| Параметр | Описание |
|----------|----------|
| **Базовый URL** | `http://<хост>:<MCP_SERVER_PORT>/mcp` |
| **`MCP_SERVER_PORT`** | Порт MCP-сервера (по умолчанию **`8081`**). Значение **`0`** — MCP не поднимается. |

В логах при старте будет строка с фактическим значением `MCP_SERVER_PORT`.

### Подключение в Cursor

В проекте или в пользовательских настройках добавьте MCP-сервер с типом **Streamable HTTP** и URL, например:

`http://127.0.0.1:8081/mcp`

Либо файл **`.cursor/mcp.json`** в корне репозитория:

```json
{
  "mcpServers": {
    "modbus-apcs": {
      "url": "http://127.0.0.1:8081/mcp"
    }
  }
}
```

После изменения конфигурации перезапустите Cursor. Сервер приложения при этом должен быть запущен, и порт MCP не должен совпадать с конфликтующими сервисами.

### Docker

В `docker-compose.yml` порт **8081** проброшен на хост; задайте при необходимости `MCP_SERVER_PORT` в `environment`.

---

## 🛠️ Переменные окружения

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `WEB_SERVER_PORT` | `9090` | Порт для Web API, Swagger и `/ui` |
| `MB_SERVER_PORT` | `502` | Порт для Modbus TCP |
| `MCP_SERVER_PORT` | `8081` | Порт MCP (Streamable HTTP на `/mcp`); `0` — отключить MCP |
| `RUST_LOG` | `info` | Уровень логирования |

## 📋 Команды управления

### Docker Compose команды:

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Просмотр логов
docker-compose logs -f

# Статус сервисов
docker-compose ps

# Перезапуск
docker-compose restart
```

### PowerShell скрипт команды:

```powershell
# Запуск из Docker Hub
.\docker-compose.ps1 start

# Запуск в режиме разработки
.\docker-compose.ps1 dev

# Остановка
.\docker-compose.ps1 stop

# Просмотр логов
.\docker-compose.ps1 logs

# Статус
.\docker-compose.ps1 status

# Сборка и загрузка образа
.\docker-compose.ps1 build
```

## 🔍 Мониторинг и отладка

### Просмотр логов:
```bash
# Docker Compose логи
docker-compose logs -f

# Логи конкретного контейнера
docker logs modbus-tcp-server

# PowerShell скрипт
.\docker-compose.ps1 logs
```

### Проверка статуса:
```bash
# Статус контейнеров
docker-compose ps

# Детальная информация
docker-compose ps -a
```

### Health Check:
Сервис автоматически проверяет доступность Swagger UI каждые 30 секунд.

## 🐛 Устранение неполадок

### Проблема: Порт уже занят
```bash
# Проверьте, какие процессы используют порты
netstat -ano | findstr :9090
netstat -ano | findstr :5021
netstat -ano | findstr :8081

# Остановите конфликтующие процессы или измените порты в docker-compose.yml и переменные WEB_SERVER_PORT / MB_SERVER_PORT / MCP_SERVER_PORT
```

### Проблема: Docker не найден
```powershell
# Добавьте Docker в PATH
$env:PATH += ";C:\Program Files\Docker\Docker\resources\bin"
```

### Проблема: Контейнер не запускается
```bash
# Проверьте логи
docker-compose logs

# Запустите в интерактивном режиме
docker-compose up
```

## 📚 Дополнительные ресурсы

- **Docker Hub**: https://hub.docker.com/r/allexd2010/modbus-server-sim
- **GitHub**: [Репозиторий проекта]
- **Modbus Protocol**: https://modbus.org/
- **Swagger Documentation**: https://swagger.io/

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте логи: `.\docker-compose.ps1 logs`
2. Убедитесь, что порты не заняты
3. Проверьте, что Docker запущен
4. Создайте issue в репозитории проекта

---

**Версия**: 1.0.0  
**Автор**: allexd2010  
**Лицензия**: MIT
