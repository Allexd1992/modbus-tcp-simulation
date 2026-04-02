# Modbus TCP Server Simulation

A **Modbus TCP** simulator with a single in-memory store: **web UI**, **REST API**, **Swagger**, and **MCP (Model Context Protocol)** over HTTP. One process shares data across Modbus, REST, and MCP.

**Image:** `allexd2010/modbus-server-sim`  
**Current tag (example):** `2.0.0`

---

## Quick start

```bash
docker pull allexd2010/modbus-server-sim:2.0.0

docker run -d --name modbus-sim \
  -p 9090:9090 \
  -p 502:502 \
  -p 18081:8081 \
  allexd2010/modbus-server-sim:2.0.0
```

### Port mapping

| Host | Container | Purpose |
|------|-----------|---------|
| 9090 | 9090 | HTTP: REST, Swagger, web UI `/ui/` |
| 502 | 502 | Modbus TCP |
| **18081** | **8081** | MCP: `http://<host>:18081/mcp` |

Inside the container, MCP listens on the port from `MCP_SERVER_PORT` (default **8081**). Mapping `18081:8081` matches the hint in the web UI for Cursor. To expose MCP on the host as **8081**, use `-p 8081:8081`.

---

## After startup

| Service | URL / address |
|---------|----------------|
| Web UI | `http://<host>:9090/ui/` |
| Swagger | `http://<host>:9090/api/v1/swagger/` |
| REST | base path `/api/v1/` |
| Modbus TCP | `<host>:502` (or the port from `MB_SERVER_PORT` and your `-p` mapping) |
| MCP | `http://<host>:<mapped host port>/mcp` |

---

## Features

- **Modbus TCP** — holding/input registers, coils, discrete inputs.
- **REST** — the same data as Modbus and MCP.
- **Web UI** — register table, UInt16/Int32/float/double formats, bitmask, auto-refresh.
- **MCP** — Streamable HTTP at `/mcp` (e.g. Cursor integration).

The protocol and API use **zero-based addressing** (the first holding register is address **0**).

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_SERVER_PORT` | `9090` | HTTP (REST, Swagger, `/ui`) |
| `MB_SERVER_PORT` | `502` | Modbus TCP |
| `MCP_SERVER_PORT` | `8081` | MCP port inside the process; **`0`** disables MCP |
| `RUST_LOG` | (none) | Log level, e.g. `info` |

Disable MCP:

```bash
docker run -d --name modbus-sim -e MCP_SERVER_PORT=0 \
  -p 9090:9090 -p 502:502 \
  allexd2010/modbus-server-sim:2.0.0
```

---

## MCP (short)

Transport: **Streamable HTTP**, endpoint **`/mcp`**. In tools, the `addr` parameter is the **protocol offset** (not 40001-style documentation numbers).

Example for Cursor (`mcp.json`):

```json
{
  "mcpServers": {
    "modbus-tcp-sim": {
      "url": "http://127.0.0.1:18081/mcp"
    }
  }
}
```

After changing the config, fully restart Cursor.

---

## Troubleshooting

- **Port in use** — change `-p` mappings or environment variables.
- **MCP not responding** — check the URL uses the correct host and **published** port (often **18081**, not 8081).
- **Empty UI** — the API must return JSON; HTML from a proxy will not fill the table.

---

## License

MIT
