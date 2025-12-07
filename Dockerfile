# OptChain v2 Dockerfile for Cloud Run
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy node_modules for GCS client (all required dependencies)
COPY --from=deps /app/node_modules/@google-cloud ./node_modules/@google-cloud
COPY --from=deps /app/node_modules/google-auth-library ./node_modules/google-auth-library
COPY --from=deps /app/node_modules/gaxios ./node_modules/gaxios
COPY --from=deps /app/node_modules/gcp-metadata ./node_modules/gcp-metadata
COPY --from=deps /app/node_modules/abort-controller ./node_modules/abort-controller
COPY --from=deps /app/node_modules/async-retry ./node_modules/async-retry
COPY --from=deps /app/node_modules/duplexify ./node_modules/duplexify
COPY --from=deps /app/node_modules/ent ./node_modules/ent
COPY --from=deps /app/node_modules/fast-xml-parser ./node_modules/fast-xml-parser
COPY --from=deps /app/node_modules/mime ./node_modules/mime
COPY --from=deps /app/node_modules/p-limit ./node_modules/p-limit
COPY --from=deps /app/node_modules/retry-request ./node_modules/retry-request
COPY --from=deps /app/node_modules/teeny-request ./node_modules/teeny-request
COPY --from=deps /app/node_modules/uuid ./node_modules/uuid
COPY --from=deps /app/node_modules/extend ./node_modules/extend
COPY --from=deps /app/node_modules/is-stream ./node_modules/is-stream
COPY --from=deps /app/node_modules/node-fetch ./node_modules/node-fetch
COPY --from=deps /app/node_modules/stream-events ./node_modules/stream-events
COPY --from=deps /app/node_modules/stubs ./node_modules/stubs
COPY --from=deps /app/node_modules/retry ./node_modules/retry
COPY --from=deps /app/node_modules/yocto-queue ./node_modules/yocto-queue
COPY --from=deps /app/node_modules/strnum ./node_modules/strnum
COPY --from=deps /app/node_modules/jws ./node_modules/jws
COPY --from=deps /app/node_modules/jwa ./node_modules/jwa
COPY --from=deps /app/node_modules/buffer-equal-constant-time ./node_modules/buffer-equal-constant-time
COPY --from=deps /app/node_modules/ecdsa-sig-formatter ./node_modules/ecdsa-sig-formatter
COPY --from=deps /app/node_modules/safe-buffer ./node_modules/safe-buffer
COPY --from=deps /app/node_modules/lru-cache ./node_modules/lru-cache
COPY --from=deps /app/node_modules/https-proxy-agent ./node_modules/https-proxy-agent
COPY --from=deps /app/node_modules/agent-base ./node_modules/agent-base

# Copy prompt download script
COPY scripts/download-prompts.js /app/scripts/download-prompts.js

# Create prompts directory
RUN mkdir -p /app/prompts && chown nextjs:nodejs /app/prompts

# Copy entrypoint script and make executable (without BuildKit)
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV PROMPTS_DIR="/app/prompts"
# GCS_PROMPTS_PATH must be set at deployment time
# Do not hardcode bucket paths in open-source code
ENV GCS_PROMPTS_PATH=""

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
