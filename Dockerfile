FROM rust:latest AS builder
WORKDIR /app
COPY Cargo.toml /app
COPY src/ /app/src/
COPY static/ /app/static/
COPY script/ /app/script/
COPY conf/ /app/conf/
RUN cargo build --release 

FROM debian:bookworm-slim
ENV WEB_SERVER_PORT="9090"
ENV MB_SERVER_PORT="502"
ENV MCP_SERVER_PORT="1"
# HTTP API: max Modbus address (inclusive) and max words/bits per request
ENV MB_MAX_ADDRESS="65535"
ENV MB_MAX_READ_COUNT="65535"
ENV SIM_SCRIPTS_DIR="/app/script"
ENV VAR_MAP_PATH="/app/conf/var-map.json"
ENV RUST_LOG="info"
WORKDIR /app
COPY --from=builder /app/target/release/modbus_tcp_server_rust /usr/local/bin/modbus_tcp_server_rust
COPY --from=builder /app/static /app/static
COPY --from=builder /app/script /app/script
COPY --from=builder /app/conf /app/conf
EXPOSE 9090
EXPOSE 502
CMD ["modbus_tcp_server_rust"]
