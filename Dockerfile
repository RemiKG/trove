# Trove — oral-history memory agent (Next.js 15, output: standalone)
#
#   docker build -t trove .
#   docker run -p 3009:3009 -e PORT=3009 -e DASHSCOPE_API_KEY=sk-... trove
#
# Health: GET /api/health  → { ok: true, service: "trove", mode: { brain: "qwen" | "offline", ... } }

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3009 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Owned file store (used when DATABASE_URL is unset) — must be writable by the runtime user.
RUN mkdir -p /app/.trove-data && chown -R node:node /app
USER node
EXPOSE 3009
# Next standalone server honors PORT + HOSTNAME from the environment.
CMD ["node", "server.js"]
