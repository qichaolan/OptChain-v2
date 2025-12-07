/**
 * Security Utilities
 *
 * API key validation, request logging, and other security helpers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, RateLimitConfig } from './rate-limiter';

// ============================================================================
// API Key Validation
// ============================================================================

/**
 * Validate API key from request headers.
 * For internal API calls (from CopilotKit actions), validates against INTERNAL_API_KEY.
 * Returns null if valid, error response if invalid.
 */
export function validateApiKey(req: NextRequest): NextResponse | null {
  const apiKey = process.env.INTERNAL_API_KEY;

  // If no API key is configured, allow all requests (development mode)
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('INTERNAL_API_KEY not set in production - API is unprotected');
    }
    return null;
  }

  const authHeader = req.headers.get('authorization');
  const headerApiKey = req.headers.get('x-api-key');

  // Check Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === apiKey) {
      return null; // Valid
    }
  }

  // Check X-API-Key header
  if (headerApiKey === apiKey) {
    return null; // Valid
  }

  // For browser requests, check if it's a same-origin request
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    const originHost = new URL(origin).host;
    if (originHost === host) {
      return null; // Same-origin request, allow
    }
  }

  // Check referer for same-origin (fallback)
  const referer = req.headers.get('referer');
  if (referer && host) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host) {
        return null; // Same-origin request, allow
      }
    } catch {
      // Invalid referer URL
    }
  }

  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

export interface RateLimitOptions {
  config?: RateLimitConfig;
}

/**
 * Check rate limit for a request.
 * Returns null if allowed, error response if rate limited.
 */
export function checkRequestRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): NextResponse | null {
  const config = options.config || RATE_LIMITS.ai;
  const identifier = getClientIdentifier(req.headers);

  const result = checkRateLimit(identifier, config);

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.ai
): NextResponse {
  const result = checkRateLimit(identifier, config);

  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));

  return response;
}

// ============================================================================
// Request Logging
// ============================================================================

export interface RequestLogEntry {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  clientIp: string;
  userAgent: string | null;
  statusCode?: number;
  durationMs?: number;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Log an API request (for security auditing)
 */
export function logRequest(
  req: NextRequest,
  requestId: string,
  statusCode?: number,
  startTime?: number
): void {
  const entry: RequestLogEntry = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: new URL(req.url).pathname,
    clientIp: getClientIdentifier(req.headers),
    userAgent: req.headers.get('user-agent'),
    statusCode,
    durationMs: startTime ? Date.now() - startTime : undefined,
  };

  // Structured logging (JSON format for Cloud Logging)
  console.log(JSON.stringify({
    severity: statusCode && statusCode >= 400 ? 'WARNING' : 'INFO',
    ...entry,
  }));
}

// ============================================================================
// API Key Lazy Getter (avoids module-level exposure)
// ============================================================================

/**
 * Get Gemini API key lazily (avoids exposing in stack traces)
 */
export function getGeminiApiKey(): string {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('AI service not configured');
  }
  return key;
}
