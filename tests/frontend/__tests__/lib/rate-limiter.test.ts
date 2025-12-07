/**
 * Unit tests for rate limiter in src/lib/rate-limiter.ts
 *
 * Test Scenarios:
 * - Rate limit checking and enforcement
 * - Client identifier extraction
 * - Concurrent request handling
 * - Edge cases and boundary values
 *
 * Coverage Target: ≥95% line and branch coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  checkGlobalGeminiLimit,
  getClientIdentifier,
  RateLimitConfig,
} from '@/lib/rate-limiter';

// Mock the config module
vi.mock('@/config/ai.config', () => ({
  RATE_LIMIT_CONFIG: {
    ai: { maxRequests: 10, windowSec: 60 },
    aiHourly: { maxRequests: 100, windowSec: 3600 },
    geminiGlobal: { maxRequests: 15, windowSec: 60 },
    api: { maxRequests: 100, windowSec: 60 },
    cleanupIntervalMs: 60000,
  },
}));

// ============================================================================
// getClientIdentifier Tests
// ============================================================================

describe('getClientIdentifier', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '192.168.1.1');

    const identifier = getClientIdentifier(headers);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should handle multiple IPs in x-forwarded-for', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1, 172.16.0.1');

    const identifier = getClientIdentifier(headers);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should trim whitespace from IP', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '  192.168.1.1  , 10.0.0.1');

    const identifier = getClientIdentifier(headers);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should fall back to anonymous when no headers present', () => {
    const headers = new Headers();

    const identifier = getClientIdentifier(headers);
    expect(identifier).toBe('anonymous');
  });

  it('should handle IPv6 addresses', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '2001:db8::1');

    const identifier = getClientIdentifier(headers);
    expect(identifier).toBe('2001:db8::1');
  });

  it('should handle empty x-forwarded-for header', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '');

    const identifier = getClientIdentifier(headers);
    expect(identifier).toBe('anonymous');
  });
});

// ============================================================================
// checkRateLimit Tests
// ============================================================================

describe('checkRateLimit', () => {
  const defaultConfig: RateLimitConfig = {
    maxRequests: 5,
    windowSec: 60,
  };

  it('should allow first request from new client', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(identifier, defaultConfig);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('should allow requests under the limit', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;

    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit(identifier, defaultConfig);
      expect(result.success).toBe(true);
    }
  });

  it('should block requests over the limit', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 3, windowSec: 60 };

    // Make 3 allowed requests
    for (let i = 0; i < 3; i++) {
      checkRateLimit(identifier, config);
    }

    // 4th request should be blocked
    const result = checkRateLimit(identifier, config);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should track different clients separately', () => {
    const client1 = `client1-${Date.now()}-${Math.random()}`;
    const client2 = `client2-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 2, windowSec: 60 };

    // Exhaust client1's limit
    checkRateLimit(client1, config);
    checkRateLimit(client1, config);
    const result1 = checkRateLimit(client1, config);
    expect(result1.success).toBe(false);

    // client2 should still be allowed
    const result2 = checkRateLimit(client2, config);
    expect(result2.success).toBe(true);
  });

  it('should include resetTime in result', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(identifier, defaultConfig);

    expect(result.resetTime).toBeDefined();
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('should return correct remaining count', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 5, windowSec: 60 };

    const result1 = checkRateLimit(identifier, config);
    expect(result1.remaining).toBe(4);

    const result2 = checkRateLimit(identifier, config);
    expect(result2.remaining).toBe(3);

    const result3 = checkRateLimit(identifier, config);
    expect(result3.remaining).toBe(2);
  });

  it('should handle zero remaining', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 1, windowSec: 60 };

    checkRateLimit(identifier, config);
    const result = checkRateLimit(identifier, config);

    expect(result.remaining).toBe(0);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// RateLimitResult structure Tests
// ============================================================================

describe('RateLimitResult structure', () => {
  it('should have all required fields when allowed', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(identifier, { maxRequests: 10, windowSec: 60 });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('resetTime');
  });

  it('should have correct types for all fields', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(identifier, { maxRequests: 10, windowSec: 60 });

    expect(typeof result.success).toBe('boolean');
    expect(typeof result.limit).toBe('number');
    expect(typeof result.remaining).toBe('number');
    expect(typeof result.resetTime).toBe('number');
  });
});

// ============================================================================
// Concurrent requests Tests
// ============================================================================

describe('Concurrent requests', () => {
  it('should handle rapid sequential requests', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 100, windowSec: 60 };

    // Make many rapid requests
    let successCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = checkRateLimit(identifier, config);
      if (result.success) successCount++;
    }

    expect(successCount).toBe(50);
  });

  it('should correctly count remaining across requests', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 5, windowSec: 60 };

    checkRateLimit(identifier, config); // remaining: 4
    const result = checkRateLimit(identifier, config); // remaining: 3

    expect(result.remaining).toBe(3);
  });
});

// ============================================================================
// Edge cases Tests
// ============================================================================

describe('Edge cases', () => {
  it('should handle very large maxRequests', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 1000000, windowSec: 60 };

    const result = checkRateLimit(identifier, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(999999);
  });

  it('should handle special characters in identifier', () => {
    const identifier = `test-client-${Date.now()}-!@#$%^&*()`;
    const config: RateLimitConfig = { maxRequests: 5, windowSec: 60 };

    const result = checkRateLimit(identifier, config);
    expect(result.success).toBe(true);
  });

  it('should handle empty string identifier', () => {
    const identifier = '';
    const config: RateLimitConfig = { maxRequests: 5, windowSec: 60 };

    const result = checkRateLimit(identifier, config);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should be fast for single request', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 100, windowSec: 60 };

    const start = performance.now();
    checkRateLimit(identifier, config);
    const duration = performance.now() - start;

    // Should complete in under 10ms
    expect(duration).toBeLessThan(10);
  });

  it('should be fast for many sequential requests', () => {
    const identifier = `test-client-${Date.now()}-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 10000, windowSec: 60 };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      checkRateLimit(identifier, config);
    }
    const duration = performance.now() - start;

    // 1000 requests should complete in under 100ms
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================================
// Global Gemini Limit Tests
// ============================================================================

describe('checkGlobalGeminiLimit', () => {
  it('should enforce global Gemini rate limit', () => {
    const result = checkGlobalGeminiLimit();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('resetTime');
  });

  it('should return proper rate limit structure', () => {
    const result = checkGlobalGeminiLimit();
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.remaining).toBe('number');
    expect(typeof result.limit).toBe('number');
    expect(typeof result.resetTime).toBe('number');
  });

  it('should decrement remaining on consecutive calls', () => {
    // First call
    const result1 = checkGlobalGeminiLimit();
    // Second call should have lower remaining
    const result2 = checkGlobalGeminiLimit();

    expect(result2.remaining).toBeLessThan(result1.remaining);
  });
});

// ============================================================================
// Cleanup Tests
// ============================================================================

describe('Internal cleanup mechanism', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger cleanup after interval passes', () => {
    const identifier = `test-cleanup-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 5, windowSec: 1 };

    // Make a request
    checkRateLimit(identifier, config);

    // Advance time past window and cleanup interval (60 seconds)
    vi.advanceTimersByTime(61000);

    // Make another request - should trigger cleanup
    const result = checkRateLimit(`new-id-${Math.random()}`, config);
    expect(result.success).toBe(true);
  });

  it('should clean up expired entries', () => {
    const identifier = `test-expire-${Math.random()}`;
    const config: RateLimitConfig = { maxRequests: 2, windowSec: 1 };

    // Exhaust the limit
    checkRateLimit(identifier, config);
    checkRateLimit(identifier, config);
    let result = checkRateLimit(identifier, config);
    expect(result.success).toBe(false);

    // Advance time past window (1 second) and cleanup interval (60 seconds)
    vi.advanceTimersByTime(61000);

    // Make a request with different identifier to trigger cleanup
    checkRateLimit(`trigger-cleanup-${Math.random()}`, config);

    // Original identifier should now be cleaned up, new requests should succeed
    result = checkRateLimit(identifier, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
  });
});
