# Stage 1: build the Vite client
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
ARG GOC_BUILD_REVISION=local
ENV GOC_BUILD_REVISION=$GOC_BUILD_REVISION
# Build client
RUN npm run build
# Generate self-signed TLS cert for HTTPS on port 5443
RUN mkdir -p .sovereign/certs && \
    openssl req -x509 -newkey rsa:2048 \
      -keyout .sovereign/certs/sovereign-local.key.pem \
      -out .sovereign/certs/sovereign-local.cert.pem \
      -days 365 -nodes \
      -subj "/CN=sovereign" 2>/dev/null

# Stage 2: production image
FROM node:22-bookworm-slim
WORKDIR /app

# Install all deps (vite is used in production mode by scripts/dev.mjs)
COPY package*.json ./
RUN npm ci

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.sovereign/certs ./.sovereign/certs
COPY server/ ./server/
COPY shared/ ./shared/
COPY scripts/ ./scripts/

EXPOSE 5443

CMD ["node", "scripts/dev.mjs", "--production"]
