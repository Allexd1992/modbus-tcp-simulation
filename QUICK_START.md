# 🚀 Быстрый старт - Modbus TCP Server

## ⚡ Мгновенный запуск

```bash
# 1. Запуск из Docker Hub
docker-compose up -d

# 2. Проверка статуса
docker-compose ps
```

## 📊 Доступные сервисы

| Сервис | URL | Описание |
|--------|-----|----------|
| **Swagger UI** | http://localhost:8080/api/v1/swagger/ | 📖 Интерактивная документация API |
| **Web API** | http://localhost:8080 | 🔧 REST API для управления регистрами |
| **Modbus TCP** | localhost:502 | 🔌 Modbus TCP сервер |

## 🔌 Быстрое подключение к Modbus

### Python пример:
```python
from pymodbus.client import ModbusTcpClient

client = ModbusTcpClient('localhost', 502)
if client.connect():
    # Чтение 10 регистров начиная с адреса 0
    result = client.read_holding_registers(0, 10)
    print(f"Регистры: {result.registers}")
    
    # Запись значения 12345 в регистр 0
    client.write_register(0, 12345)
    client.close()
```

### Node.js пример:
```javascript
const ModbusRTU = require('modbus-serial');

const client = new ModbusRTU();
client.connectTCP("localhost", { port: 502 });

client.readHoldingRegisters(0, 10)
    .then(data => console.log("Регистры:", data.data));
```

## 📖 Использование Swagger UI

1. **Откройте браузер**: http://localhost:8080/api/v1/swagger/
2. **Выберите endpoint** (например, `GET /api/v1/holding-registers/{addr}/{cnt}`)
3. **Нажмите "Try it out"**
4. **Введите параметры**:
   - `addr`: `0` (начальный адрес)
   - `cnt`: `10` (количество регистров)
5. **Нажмите "Execute"**
6. **Получите результат** в формате JSON

## 🛠️ Управление

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Логи
docker-compose logs -f

# Статус
docker-compose ps
```

## 🐛 Устранение проблем

### Порт занят?
```bash
# Проверьте занятые порты
netstat -ano | findstr :8080
netstat -ano | findstr :502

# Измените порты в docker-compose.yml
```

### Docker не найден?
```powershell
# Добавьте в PATH
$env:PATH += ";C:\Program Files\Docker\Docker\resources\bin"
```

## 📚 Полная документация

См. [README.md](README.md) для полной документации.

---

**🎯 Готово!** Ваш Modbus TCP сервер работает на:
- **Swagger UI**: http://localhost:8080/api/v1/swagger/
- **Modbus TCP**: localhost:502 