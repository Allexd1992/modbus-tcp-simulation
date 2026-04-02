# Modbus TCP Server Simulation

[![Docker Hub](https://img.shields.io/docker/pulls/allexd2010/modbus-server-sim?logo=docker)](https://hub.docker.com/r/allexd2010/modbus-server-sim)

Симулятор Modbus TCP с **единым in-memory хранилищем**: веб-интерфейс, **REST API**, **Swagger** и **MCP (Model Context Protocol)** по HTTP для клиентов вроде Cursor. Написано на Rust (Rocket, tokio-modbus, rmcp).

## Возможности

- **Modbus TCP** — holding/input registers, coils и discrete inputs.
- **REST** — те же данные, что и по Modbus и MCP.
- **Веб-UI** (`/ui/`) — матрица регистров, форматы UInt16/Int32/float/double, битовая маска, автообновление с настраиваемым интервалом, подсказка MCP с примером `mcp.json` и скачиванием.
- **MCP** — Streamable HTTP на пути `/mcp`, инструменты `modbus_read_holding_registers`, `modbus_write_holding_registers` и др.

## Требования

- Для сборки: Rust toolchain.
- Для контейнера: Docker (или только образ с Docker Hub).

## Быстрый старт

### Образ Docker Hub (рекомендуется)

Текущий тег: **`2.0.0`**.

```bash
docker pull allexd2010/modbus-server-sim:2.0.0

docker run -d --name modbus-sim \
  -p 9090:9090 \
  -p 502:502 \
  -p 18081:8081 \
  allexd2010/modbus-server-sim:2.0.0
```

| На хосте | В контейнере | Назначение |
|----------|----------------|------------|
| 9090 | 9090 | HTTP: REST, Swagger, `/ui/` |
| 502 | 502 | Modbus TCP |
| **18081** | **8081** | MCP (`http://<хост>:18081/mcp`) |

Почему **18081** снаружи: внутри процесса MCP слушает порт из `MCP_SERVER_PORT` (по умолчанию **8081**). Проброс `18081:8081` совпадает с подсказкой в веб-UI для Cursor. Если нужен MCP на хосте как **8081**, используйте `-p 8081:8081`.

Локальная сборка образа:

```bash
docker build -t allexd2010/modbus-server-sim:2.0.0 .
```

### Docker Compose

```bash
docker compose up -d
```

Порты и образ задаются в `docker-compose.yml`.

### Без Docker

```bash
cargo run --release
```

По умолчанию: веб **9090**, Modbus **502**, MCP **8081** (см. переменные окружения ниже). UI: `http://127.0.0.1:9090/ui/`.

## Сервисы после запуска

| Что | URL / адрес |
|-----|-------------|
| Веб-UI | `http://<хост>:9090/ui/` |
| Swagger | `http://<хост>:9090/api/v1/swagger/` |
| REST | базовый префикс `/api/v1/` |
| Modbus TCP | `<хост>:502` (или порт из `MB_SERVER_PORT` и проброса Docker) |
| MCP | `http://<хост>:<порт MCP на хосте>/mcp` |

## Веб-интерфейс

- Вкладки: holding / input / coils / discrete inputs.
- Поля **Сдвиг** и **Количество** задают окно чтения (до 256 слов запросом; таблица показывает ограниченное число строк — см. подсказку внизу).
- **Авто** — периодическое чтение; интервал в секундах; при фокусе в ячейке автообновление не перезаписывает ввод.
- Кнопка **AI** — текст про MCP, текущий URL для Cursor, скачивание `mcp.json` (хост как у страницы, порт **18081** по умолчанию или `?mcpPort=` в URL страницы).

## Адреса Modbus и документация

В протоколе и API используется **смещение с нуля** (первый holding — адрес **0**). Соответствие «документации» Modicon: holding **40001** → смещение **0**, **40021** → **20**.

## REST API (кратко)

Все маршруты под `/api/v1/`; примеры для holding:

- `GET /api/v1/holding-registers/{addr}/{cnt}` — чтение
- `POST /api/v1/holding-register/{addr}/{data}` — одно слово
- `POST /api/v1/holding-registers/{addr}` — тело JSON `{"data":[…]}`

Аналогично для input, coils и discrete — см. Swagger.

## MCP (Cursor и др.)

- Транспорт: **Streamable HTTP**, endpoint **`/mcp`**.
- Тот же store, что у REST.
- В инструментах параметр **`addr`** — **смещение по протоколу**, не номер 40001.

Пример `mcp.json` (глобально `%USERPROFILE%\.cursor\mcp.json` или проект `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "modbus-tcp-sim": {
      "url": "http://127.0.0.1:18081/mcp"
    }
  }
}
```

При локальном `cargo run` без Docker обычно: `http://127.0.0.1:8081/mcp`. После смены конфигурации Cursor нужен **полный перезапуск** Cursor.

Отключить MCP: `MCP_SERVER_PORT=0`.

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|----------------|----------|
| `WEB_SERVER_PORT` | `9090` | HTTP (REST, Swagger, статика `/ui`) |
| `MB_SERVER_PORT` | `502` | Modbus TCP |
| `MCP_SERVER_PORT` | `8081` | Порт MCP внутри процесса; **`0`** — не поднимать MCP |
| `RUST_LOG` | (нет) | Уровень логирования, например `info` |



Порт замените на тот, что задан в `MB_SERVER_PORT` и проброшен с хоста (по умолчанию **502**).

## Устранение неполадок

- **Порт занят** — проверьте `netstat` / Диспетчер задач; смените проброс или переменные окружения.
- **MCP в Cursor не отвечает** — убедитесь, что URL указывает на **хост и порт**, куда проброшен контейнер (часто **18081**, а не 8081).
- **Пустой или не тот ответ в UI** — API должен возвращать **JSON-массив**; при прокси и HTML-ответе таблица не заполнится.



- Docker Hub: `allexd2010/modbus-server-sim`
- Теги: например **`2.0.0`**

## Лицензия

MIT

---

**Версия документации:** соответствует релизу ветки и образу **2.0.0**.
