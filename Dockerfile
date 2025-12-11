# OptChain v2 Dockerfile for Cloud Run
# Multi-service: Next.js frontend + FastAPI backend

# ============================================================================
# Stage 1: Node.js dependencies
# ============================================================================
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ============================================================================
# Stage 2: Sharp dependencies (Debian-based for glibc compatibility)
# ============================================================================
FROM node:18-slim AS sharp-deps
WORKDIR /app
RUN npm install sharp

# ============================================================================
# Stage 3: Build Next.js application
# ============================================================================
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Exclude backend from Next.js build
RUN rm -rf backend

RUN npm run build

# ============================================================================
# Stage 4: Python backend preparation
# ============================================================================
FROM python:3.12-slim AS python-deps
WORKDIR /backend

# Install system dependencies for Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ============================================================================
# Stage 5: Final production image
# ============================================================================
FROM python:3.12-slim AS runner
WORKDIR /app

# Install Node.js in the Python image
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# ============================================================================
# Copy Next.js built files
# ============================================================================
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy GCS-related node_modules
COPY --from=deps /app/node_modules/@google-cloud ./node_modules/@google-cloud
COPY --from=deps /app/node_modules/google-auth-library ./node_modules/google-auth-library
COPY --from=deps /app/node_modules/gaxios ./node_modules/gaxios
COPY --from=deps /app/node_modules/gcp-metadata ./node_modules/gcp-metadata
COPY --from=deps /app/node_modules/abort-controller ./node_modules/abort-controller
COPY --from=deps /app/node_modules/event-target-shim ./node_modules/event-target-shim
COPY --from=deps /app/node_modules/node-fetch ./node_modules/node-fetch
COPY --from=deps /app/node_modules/whatwg-url ./node_modules/whatwg-url
COPY --from=deps /app/node_modules/webidl-conversions ./node_modules/webidl-conversions
COPY --from=deps /app/node_modules/tr46 ./node_modules/tr46
COPY --from=deps /app/node_modules/readable-stream ./node_modules/readable-stream
COPY --from=deps /app/node_modules/inherits ./node_modules/inherits
COPY --from=deps /app/node_modules/string_decoder ./node_modules/string_decoder
COPY --from=deps /app/node_modules/util-deprecate ./node_modules/util-deprecate
COPY --from=deps /app/node_modules/safe-buffer ./node_modules/safe-buffer
COPY --from=deps /app/node_modules/duplexify ./node_modules/duplexify
COPY --from=deps /app/node_modules/end-of-stream ./node_modules/end-of-stream
COPY --from=deps /app/node_modules/stream-shift ./node_modules/stream-shift
COPY --from=deps /app/node_modules/stream-events ./node_modules/stream-events
COPY --from=deps /app/node_modules/stubs ./node_modules/stubs
COPY --from=deps /app/node_modules/pump ./node_modules/pump
COPY --from=deps /app/node_modules/async-retry ./node_modules/async-retry
COPY --from=deps /app/node_modules/retry ./node_modules/retry
COPY --from=deps /app/node_modules/retry-request ./node_modules/retry-request
COPY --from=deps /app/node_modules/extend ./node_modules/extend
COPY --from=deps /app/node_modules/p-limit ./node_modules/p-limit
COPY --from=deps /app/node_modules/yocto-queue ./node_modules/yocto-queue
COPY --from=deps /app/node_modules/teeny-request ./node_modules/teeny-request
COPY --from=deps /app/node_modules/https-proxy-agent ./node_modules/https-proxy-agent
COPY --from=deps /app/node_modules/agent-base ./node_modules/agent-base
COPY --from=deps /app/node_modules/form-data ./node_modules/form-data
COPY --from=deps /app/node_modules/combined-stream ./node_modules/combined-stream
COPY --from=deps /app/node_modules/delayed-stream ./node_modules/delayed-stream
COPY --from=deps /app/node_modules/asynckit ./node_modules/asynckit
COPY --from=deps /app/node_modules/mime-types ./node_modules/mime-types
COPY --from=deps /app/node_modules/mime-db ./node_modules/mime-db
COPY --from=deps /app/node_modules/jws ./node_modules/jws
COPY --from=deps /app/node_modules/jwa ./node_modules/jwa
COPY --from=deps /app/node_modules/buffer-equal-constant-time ./node_modules/buffer-equal-constant-time
COPY --from=deps /app/node_modules/ecdsa-sig-formatter ./node_modules/ecdsa-sig-formatter
COPY --from=deps /app/node_modules/lru-cache ./node_modules/lru-cache
COPY --from=deps /app/node_modules/uuid ./node_modules/uuid
COPY --from=deps /app/node_modules/mime ./node_modules/mime
COPY --from=deps /app/node_modules/is-stream ./node_modules/is-stream
COPY --from=deps /app/node_modules/once ./node_modules/once
COPY --from=deps /app/node_modules/wrappy ./node_modules/wrappy
COPY --from=deps /app/node_modules/debug ./node_modules/debug
COPY --from=deps /app/node_modules/ms ./node_modules/ms
COPY --from=deps /app/node_modules/fast-xml-parser ./node_modules/fast-xml-parser
COPY --from=deps /app/node_modules/strnum ./node_modules/strnum

# Copy sharp for Next.js image optimization (from Debian-based stage for glibc)
COPY --from=sharp-deps /app/node_modules/sharp ./node_modules/sharp
COPY --from=sharp-deps /app/node_modules/@img ./node_modules/@img
COPY --from=sharp-deps /app/node_modules/color ./node_modules/color
COPY --from=sharp-deps /app/node_modules/color-convert ./node_modules/color-convert
COPY --from=sharp-deps /app/node_modules/color-name ./node_modules/color-name
COPY --from=sharp-deps /app/node_modules/color-string ./node_modules/color-string
COPY --from=sharp-deps /app/node_modules/simple-swizzle ./node_modules/simple-swizzle
COPY --from=sharp-deps /app/node_modules/is-arrayish ./node_modules/is-arrayish
COPY --from=sharp-deps /app/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=sharp-deps /app/node_modules/semver ./node_modules/semver

# ============================================================================
# Copy Python backend and dependencies
# ============================================================================
COPY --from=python-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-deps /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy backend files
COPY backend/app ./backend/app
COPY backend/config ./backend/config
COPY backend/leaps_ranker.py ./backend/
COPY backend/credit_spread_screener.py ./backend/
COPY backend/iron_condor.py ./backend/
COPY backend/static ./backend/static
COPY backend/templates ./backend/templates
COPY backend/backtest ./backend/backtest

# ============================================================================
# Copy scripts and set permissions
# ============================================================================
COPY scripts/download-prompts.js /app/scripts/download-prompts.js
RUN mkdir -p /app/prompts

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV PROMPTS_DIR="/app/prompts"
ENV GCS_PROMPTS_PATH=""
ENV BACKEND_PORT=8081
ENV OPTCHAIN_BACKEND_URL="http://localhost:8081"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
