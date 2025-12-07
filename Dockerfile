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

# Install Google Cloud SDK for downloading prompts from GCS
RUN apk add --no-cache python3 py3-pip curl bash
RUN curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir=/opt
ENV PATH="/opt/google-cloud-sdk/bin:${PATH}"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create prompts directory
RUN mkdir -p /app/prompts && chown nextjs:nodejs /app/prompts

# Copy entrypoint script
COPY --chmod=755 entrypoint.sh /app/entrypoint.sh

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV GCS_PROMPTS_PATH="gs://optchainv2/prompts/v2"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
