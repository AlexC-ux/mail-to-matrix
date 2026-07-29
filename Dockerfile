FROM node:22.22.0 AS builder
WORKDIR /app/mail-to-matrix
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
RUN rm -rf node_modules
RUN npm ci --omit-dev


# Этап запуска (финальный образ)
FROM node:22.22.0-alpine
COPY --from=builder /app/mail-to-matrix/dist /dist
ENTRYPOINT ["node", "/dist/main.js"]

