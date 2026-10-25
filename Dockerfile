# Stage 1: build the Vite client
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
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

# Playwright Chromium + Vite runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxcb1 libxkbcommon0 \
    libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install all deps (vite is used in production mode by scripts/dev.mjs)
COPY package*.json ./
RUN npm ci
RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.sovereign/certs ./.sovereign/certs
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY board/ ./board/

EXPOSE 5443

CMD ["node", "scripts/dev.mjs", "--production"]
