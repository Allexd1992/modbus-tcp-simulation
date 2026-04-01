
FROM rust:latest as builder
WORKDIR /app
COPY Cargo.toml /app
COPY src/ /app/src/
RUN cargo build --release 

FROM debian:bookworm-slim
ENV WEB_SERVER_PORT="8080"
ENV MB_SERVER_PORT="502"
COPY --from=builder /app/target/release/modbus_tcp_server_rust /usr/local/bin/modbus_tcp_server_rust
EXPOSE 8080
EXPOSE 502
CMD ["modbus_tcp_server_rust"]
