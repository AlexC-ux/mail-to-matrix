FROM node:22.22.0 AS builder
WORKDIR /app/mail-to-matrix
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.22.0 AS builder-modules
WORKDIR /app/mail-to-matrix
COPY package*.json .
RUN npm ci --omit-dev


# Этап запуска (финальный образ)
FROM node:22.22.0-alpine
COPY --from=builder /app/mail-to-matrix/dist /app/dist
COPY --from=builder-modules /app/mail-to-matrix/node_modules /app/node_modules
ENTRYPOINT ["node", "/app/dist/main.js"]

