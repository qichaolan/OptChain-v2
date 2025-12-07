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

# Copy node_modules for GCS client (only @google-cloud/storage and deps)
COPY --from=deps /app/node_modules/@google-cloud ./node_modules/@google-cloud
COPY --from=deps /app/node_modules/google-auth-library ./node_modules/google-auth-library
COPY --from=deps /app/node_modules/gaxios ./node_modules/gaxios
COPY --from=deps /app/node_modules/gcp-metadata ./node_modules/gcp-metadata

# Copy prompt download script
COPY scripts/download-prompts.js /app/scripts/download-prompts.js

# Create prompts directory
RUN mkdir -p /app/prompts && chown nextjs:nodejs /app/prompts

# Copy entrypoint script and make executable (without BuildKit)
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV PROMPTS_DIR="/app/prompts"
# GCS_PROMPTS_PATH must be set at deployment time
# Do not hardcode bucket paths in open-source code
ENV GCS_PROMPTS_PATH=""

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
