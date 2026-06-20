# Changelog

All notable changes to this project are documented here.

## [2.2.0] — 2026-06-20

### Added

- **Structured logging** — `tracing` + `tracing-subscriber`; configure with `RUST_LOG` (default `info`). Startup, HTTP (non-static), Modbus, simulation engine, and MCP events are logged with levels.
- **Address map** — named Modbus variables in `conf/var-map.json`; types include `uint16`, `int16`, `int32`, `float32`, and **`bit`** (bits 0–15 in a register word). Web UI **Address map** tab; REST `/api/v1/var-map`; MCP `var_map_get`, `var_map_save`, `var_map_import`.
- **JavaScript simulation** — QuickJS engine loads `script/*.js`; `modbus.onWrite`, `modbus.setInterval`, typed read/write, and **`map.*`** API bound to the address map. REST `/api/v1/sim-scripts`; MCP `sim_scripts_*` tools.
- **Combined export/import** — scripts + address map in one bundle (`/api/v1/simulation/export|import`, MCP `simulation_export|import`).
- **Unified HTTP front door** — Axum on the public port proxies to Rocket (REST/Swagger/UI) and serves MCP at `/mcp` on the same port.
- **Web UI panels** — Scripts editor, address map editor, export/import, script syntax highlighting.

### Changed

- Docker Compose and Dockerfile default `RUST_LOG=info`.
- Package version aligned with Docker image tag: **2.2.0**.

## [2.1.1]

- CI: Docker release tag without leading `v` (image `2.1.1`, git tag `v2.1.1`).
- Multi-arch Docker on release tags (`linux/amd64` + `linux/arm64`).

## [2.1.0]

- HTTP Modbus limits from env (`MB_MAX_ADDRESS`, `MB_MAX_READ_COUNT`).
- MCP over Streamable HTTP on the web port.
- PWA installable web UI.

[2.2.0]: https://github.com/Allexd1992/modbus-tcp-simulation/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/Allexd1992/modbus-tcp-simulation/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/Allexd1992/modbus-tcp-simulation/releases/tag/v2.1.0
