/**
 * Rate Limiter
 *
 * Simple in-memory rate limiter for API endpoints.
 * For production with multiple instances, use Redis-based rate limiting.
 */

import { RATE_LIMIT_CONFIG } from '@/config/ai.config';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (configurable)
const CLEANUP_INTERVAL_MS = RATE_LIMIT_CONFIG.cleanupIntervalMs;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  // Use Array.from() for ES5 compatibility
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Check rate limit for a given identifier (IP, user ID, etc.)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const key = `ratelimit:${identifier}`;

  let entry = rateLimitStore.get(key);

  // Create new entry if none exists or window expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Increment count
  entry.count++;

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const success = entry.count <= config.maxRequests;

  return {
    success,
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Default rate limit configurations (from centralized config)
 */
export const RATE_LIMITS = {
  // AI endpoints - more restrictive
  ai: RATE_LIMIT_CONFIG.ai as RateLimitConfig,
  // General API - less restrictive
  api: RATE_LIMIT_CONFIG.api as RateLimitConfig,
} as const;

/**
 * Get client identifier from request headers
 */
export function getClientIdentifier(headers: Headers): string {
  // Use X-Forwarded-For for Cloud Run (behind load balancer)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(',')[0].trim();
  }

  // Fallback to a generic identifier
  return 'anonymous';
}
