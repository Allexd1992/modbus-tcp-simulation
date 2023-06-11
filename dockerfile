# Используем образ с установленным Rust
FROM rust:latest as builder

# Создаем директорию приложения внутри образа
WORKDIR /app

# Копируем файлы Cargo.toml и Cargo.lock для ускорения сборки зависимостей
COPY Cargo.toml /app

# Копируем исходный код приложения
COPY src/ /app/src/

# Заново собираем проект с исходным кодом
RUN cargo build --release 



# Отдельный этап для создания минимального образа
FROM debian:buster-slim


ENV WEB_SERVER_PORT="8080"
ENV MB_SERVER_PORT="502"
COPY --from=builder /app/target/release/modbus_tcp_server_rust /usr/local/bin/modbus_tcp_server_rust

# Expose the desired port (replace 8080 with your application's port)
EXPOSE 8080
EXPOSE 502
# Установка зависимостей для исполняемого файла
# RUN apt-get update && apt-get install -y \
#   libssl-dev

# Specify the command to run the application
CMD ["modbus_tcp_server_rust"]
