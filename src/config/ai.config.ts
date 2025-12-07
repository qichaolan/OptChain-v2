/**
 * AI Configuration
 *
 * Centralized configuration for AI services, rate limits, and related settings.
 * Environment variables can override these defaults.
 */

// ============================================================================
// Gemini Model Configuration
// ============================================================================

export const GEMINI_CONFIG = {
  /** Model name - can be overridden by GEMINI_MODEL env var */
  modelName: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  /** Generation parameters */
  generation: {
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.2'),
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '10000', 10),
    topP: parseFloat(process.env.GEMINI_TOP_P || '0.8'),
    topK: parseInt(process.env.GEMINI_TOP_K || '40', 10),
  },
} as const;

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

export const RATE_LIMIT_CONFIG = {
  /** AI endpoints - more restrictive to prevent abuse */
  ai: {
    maxRequests: parseInt(process.env.RATE_LIMIT_AI_MAX || '10', 10),
    windowSec: parseInt(process.env.RATE_LIMIT_AI_WINDOW || '60', 10),
  },

  /** AI endpoints - hourly limit */
  aiHourly: {
    maxRequests: parseInt(process.env.RATE_LIMIT_AI_HOURLY_MAX || '60', 10),
    windowSec: parseInt(process.env.RATE_LIMIT_AI_HOURLY_WINDOW || '3600', 10),
  },

  /** Global Gemini API limit (across all users) */
  geminiGlobal: {
    maxRequests: parseInt(process.env.GEMINI_GLOBAL_HOURLY_LIMIT || '1000', 10),
    windowSec: 3600,
  },

  /** General API endpoints - less restrictive */
  api: {
    maxRequests: parseInt(process.env.RATE_LIMIT_API_MAX || '100', 10),
    windowSec: parseInt(process.env.RATE_LIMIT_API_WINDOW || '60', 10),
  },

  /** Cleanup interval for expired entries (in milliseconds) */
  cleanupIntervalMs: parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL || '60000', 10),
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

export const CACHE_CONFIG = {
  /** Prompt cache TTL in milliseconds (default: 5 minutes) */
  promptTtlMs: parseInt(process.env.CACHE_PROMPT_TTL || '300000', 10),

  /** AI response cache TTL in milliseconds (default: 10 minutes) */
  responseTtlMs: parseInt(process.env.CACHE_RESPONSE_TTL || '600000', 10),
} as const;

// ============================================================================
// Security Configuration
// ============================================================================

export const SECURITY_CONFIG = {
  /** Whether to require API key authentication (default: true in production) */
  requireApiKey: process.env.REQUIRE_API_KEY === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.REQUIRE_API_KEY !== 'false'),

  /** Allowed origins for CORS (comma-separated) */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),

  /** Whether to log requests (default: true) */
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type GeminiConfig = typeof GEMINI_CONFIG;
export type RateLimitConfig = typeof RATE_LIMIT_CONFIG;
export type CacheConfig = typeof CACHE_CONFIG;
export type SecurityConfig = typeof SECURITY_CONFIG;
