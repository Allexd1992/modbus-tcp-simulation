FROM rust:latest AS builder
WORKDIR /app
COPY Cargo.toml /app
COPY src/ /app/src/
COPY static/ /app/static/
RUN cargo build --release 

FROM debian:bookworm-slim
ENV WEB_SERVER_PORT="9090"
ENV MB_SERVER_PORT="502"
ENV MCP_SERVER_PORT="8081"
WORKDIR /app
COPY --from=builder /app/target/release/modbus_tcp_server_rust /usr/local/bin/modbus_tcp_server_rust
COPY --from=builder /app/static /app/static
EXPOSE 9090
EXPOSE 502
EXPOSE 8081
CMD ["modbus_tcp_server_rust"]
