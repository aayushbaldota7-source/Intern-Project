# ── Stage 1: Dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Add a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Set ownership
RUN chown -R appuser:appgroup /app
USER appuser

# Environment defaults (overridden by docker-compose / Kubernetes)
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Healthcheck so Docker knows when the container is ready
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
