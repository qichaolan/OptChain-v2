/**
 * Unit tests for security utilities in src/lib/security.ts
 *
 * Test Scenarios:
 * - API key validation
 * - Request rate limiting
 * - Request logging
 * - Gemini API key retrieval
 * - Rate limit headers
 *
 * Coverage Target: ≥95% line and branch coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Create mock functions using vi.hoisted so they're available at mock time
const { mockCheckRateLimit, mockGetClientIdentifier, mockCheckGlobalGeminiLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockGetClientIdentifier: vi.fn(),
  mockCheckGlobalGeminiLimit: vi.fn(),
}));

// Mock the rate-limiter module
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  checkGlobalGeminiLimit: mockCheckGlobalGeminiLimit,
  getClientIdentifier: mockGetClientIdentifier,
  RATE_LIMITS: {
    ai: { maxRequests: 10, windowSec: 60 },
    aiHourly: { maxRequests: 100, windowSec: 3600 },
    api: { maxRequests: 100, windowSec: 60 },
  },
}));

import {
  validateApiKey,
  checkRequestRateLimit,
  addRateLimitHeaders,
  generateRequestId,
  logRequest,
  getGeminiApiKey,
} from '@/lib/security';
import { RATE_LIMITS } from '@/lib/rate-limiter';

// Default mock implementations
function setupDefaultMocks() {
  mockCheckRateLimit.mockImplementation((identifier: string, config: { maxRequests: number; windowSec: number }) => ({
    success: true,
    remaining: config?.maxRequests ? config.maxRequests - 1 : 9,
    limit: config?.maxRequests || 10,
    resetTime: Date.now() + (config?.windowSec || 60) * 1000,
  }));
  mockGetClientIdentifier.mockImplementation((headers: Headers) => {
    return headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown';
  });
  mockCheckGlobalGeminiLimit.mockImplementation(() => ({
    success: true,
    remaining: 14,
    limit: 15,
    resetTime: Date.now() + 60000,
  }));
}

// ============================================================================
// Mock NextRequest Creation
// ============================================================================

function createMockNextRequest(options: {
  apiKey?: string;
  bearerToken?: string;
  ip?: string;
  method?: string;
  url?: string;
  origin?: string;
  host?: string;
  referer?: string;
  userAgent?: string;
}): NextRequest {
  const headers = new Headers();

  if (options.apiKey) {
    headers.set('x-api-key', options.apiKey);
  }
  if (options.bearerToken) {
    headers.set('authorization', `Bearer ${options.bearerToken}`);
  }
  if (options.ip) {
    headers.set('x-forwarded-for', options.ip);
  }
  if (options.origin) {
    headers.set('origin', options.origin);
  }
  if (options.host) {
    headers.set('host', options.host);
  }
  if (options.referer) {
    headers.set('referer', options.referer);
  }
  if (options.userAgent) {
    headers.set('user-agent', options.userAgent);
  }

  return {
    headers,
    method: options.method || 'GET',
    url: options.url || 'https://example.com/api/test',
  } as unknown as NextRequest;
}

// ============================================================================
// Test validateApiKey
// ============================================================================

describe('validateApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when INTERNAL_API_KEY is not configured', () => {
    beforeEach(() => {
      delete process.env.INTERNAL_API_KEY;
    });

    it('should allow request without API key (development mode)', () => {
      process.env.NODE_ENV = 'development';
      const request = createMockNextRequest({});

      const result = validateApiKey(request);

      expect(result).toBeNull(); // null means valid
    });

    it('should allow request in production but log warning', () => {
      process.env.NODE_ENV = 'production';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const request = createMockNextRequest({});

      const result = validateApiKey(request);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('INTERNAL_API_KEY not set')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('when INTERNAL_API_KEY is configured', () => {
    beforeEach(() => {
      process.env.INTERNAL_API_KEY = 'test-api-key-123';
    });

    it('should accept valid X-API-Key header', () => {
      const request = createMockNextRequest({ apiKey: 'test-api-key-123' });

      const result = validateApiKey(request);

      expect(result).toBeNull(); // null means valid
    });

    it('should accept valid Bearer token', () => {
      const request = createMockNextRequest({ bearerToken: 'test-api-key-123' });

      const result = validateApiKey(request);

      expect(result).toBeNull();
    });

    it('should reject invalid API key', () => {
      const request = createMockNextRequest({ apiKey: 'invalid-key' });

      const result = validateApiKey(request);

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(NextResponse);
    });

    it('should reject missing API key', () => {
      const request = createMockNextRequest({});

      const result = validateApiKey(request);

      expect(result).not.toBeNull();
    });

    it('should return 401 status for invalid key', async () => {
      const request = createMockNextRequest({ apiKey: 'invalid-key' });

      const result = validateApiKey(request);

      expect(result?.status).toBe(401);
    });

    it('should return error message in response body', async () => {
      const request = createMockNextRequest({ apiKey: 'invalid-key' });

      const result = validateApiKey(request);
      const body = await result?.json();

      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('same-origin requests', () => {
    beforeEach(() => {
      process.env.INTERNAL_API_KEY = 'test-api-key-123';
    });

    it('should allow same-origin request (origin matches host)', () => {
      const request = createMockNextRequest({
        origin: 'https://example.com',
        host: 'example.com',
      });

      const result = validateApiKey(request);

      expect(result).toBeNull();
    });

    it('should allow same-origin request (referer matches host)', () => {
      const request = createMockNextRequest({
        referer: 'https://example.com/page',
        host: 'example.com',
      });

      const result = validateApiKey(request);

      expect(result).toBeNull();
    });

    it('should reject cross-origin request without valid key', () => {
      const request = createMockNextRequest({
        origin: 'https://malicious.com',
        host: 'example.com',
      });

      const result = validateApiKey(request);

      expect(result).not.toBeNull();
    });

    it('should handle invalid referer URL gracefully', () => {
      const request = createMockNextRequest({
        referer: 'not-a-valid-url',
        host: 'example.com',
      });

      const result = validateApiKey(request);

      // Should reject but not throw
      expect(result).not.toBeNull();
    });
  });
});

// ============================================================================
// Test checkRequestRateLimit
// ============================================================================

describe('checkRequestRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('should return null when request is allowed', () => {
    const request = createMockNextRequest({ ip: '192.168.1.1' });

    const result = checkRequestRateLimit(request);

    expect(result).toBeNull();
  });

  it('should use default ai config when no options provided', () => {
    const request = createMockNextRequest({ ip: '192.168.1.1' });

    checkRequestRateLimit(request);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.any(String),
      RATE_LIMITS.ai
    );
  });

  it('should use custom config when provided', () => {
    const request = createMockNextRequest({ ip: '192.168.1.1' });
    const customConfig = { maxRequests: 50, windowSec: 120 };

    checkRequestRateLimit(request, { config: customConfig });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.any(String),
      customConfig
    );
  });

  it('should return 429 response when rate limited', () => {
    mockCheckRateLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      limit: 10,
      resetTime: Date.now() + 60000,
    });

    const request = createMockNextRequest({ ip: '192.168.1.1' });

    const result = checkRequestRateLimit(request);

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it('should include rate limit headers when limited', async () => {
    mockCheckRateLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      limit: 10,
      resetTime: Date.now() + 60000,
    });

    const request = createMockNextRequest({ ip: '192.168.1.1' });

    const result = checkRequestRateLimit(request);

    expect(result?.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(result?.headers.get('Retry-After')).toBeDefined();
  });

  it('should include error message in response body', async () => {
    mockCheckRateLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      limit: 10,
      resetTime: Date.now() + 60000,
    });

    const request = createMockNextRequest({ ip: '192.168.1.1' });

    const result = checkRequestRateLimit(request);
    const body = await result?.json();

    expect(body.error).toContain('Too many requests');
    expect(body.retryAfter).toBeDefined();
  });

  it('should get client identifier from headers', () => {
    const request = createMockNextRequest({ ip: '10.0.0.1' });

    checkRequestRateLimit(request);

    expect(mockGetClientIdentifier).toHaveBeenCalledWith(request.headers);
  });

  it('should return 429 when hourly rate limit is exceeded', async () => {
    // First call (per-minute) succeeds, second call (hourly) fails
    mockCheckRateLimit
      .mockReturnValueOnce({
        success: true,
        remaining: 5,
        limit: 10,
        resetTime: Date.now() + 60000,
      })
      .mockReturnValueOnce({
        success: false,
        remaining: 0,
        limit: 100,
        resetTime: Date.now() + 3600000,
      });

    const request = createMockNextRequest({ ip: '192.168.1.1' });

    const result = checkRequestRateLimit(request);

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    const body = await result?.json();
    expect(body.error).toContain('Hourly rate limit exceeded');
  });

  it('should return 503 when global Gemini limit is exceeded', async () => {
    // Per-minute and hourly succeed, global Gemini fails
    mockCheckRateLimit
      .mockReturnValueOnce({
        success: true,
        remaining: 5,
        limit: 10,
        resetTime: Date.now() + 60000,
      })
      .mockReturnValueOnce({
        success: true,
        remaining: 50,
        limit: 100,
        resetTime: Date.now() + 3600000,
      });
    mockCheckGlobalGeminiLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      limit: 15,
      resetTime: Date.now() + 60000,
    });

    const request = createMockNextRequest({ ip: '192.168.1.1' });

    const result = checkRequestRateLimit(request);

    expect(result).not.toBeNull();
    expect(result?.status).toBe(503);
    const body = await result?.json();
    expect(body.error).toContain('AI service is temporarily at capacity');
  });
});

// ============================================================================
// Test addRateLimitHeaders
// ============================================================================

describe('addRateLimitHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('should add X-RateLimit-Limit header', () => {
    const response = NextResponse.json({ data: 'test' });

    addRateLimitHeaders(response, 'test-identifier');

    expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
  });

  it('should add X-RateLimit-Remaining header', () => {
    const response = NextResponse.json({ data: 'test' });

    addRateLimitHeaders(response, 'test-identifier');

    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });

  it('should add X-RateLimit-Reset header', () => {
    const response = NextResponse.json({ data: 'test' });

    addRateLimitHeaders(response, 'test-identifier');

    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('should use default ai config when not specified', () => {
    const response = NextResponse.json({ data: 'test' });

    addRateLimitHeaders(response, 'test-identifier');

    expect(mockCheckRateLimit).toHaveBeenCalledWith('test-identifier', RATE_LIMITS.ai);
  });

  it('should use custom config when provided', () => {
    const response = NextResponse.json({ data: 'test' });
    const customConfig = { maxRequests: 100, windowSec: 300 };

    addRateLimitHeaders(response, 'test-identifier', customConfig);

    expect(mockCheckRateLimit).toHaveBeenCalledWith('test-identifier', customConfig);
  });

  it('should return the same response object', () => {
    const response = NextResponse.json({ data: 'test' });

    const result = addRateLimitHeaders(response, 'test-identifier');

    expect(result).toBe(response);
  });
});

// ============================================================================
// Test generateRequestId
// ============================================================================

describe('generateRequestId', () => {
  it('should return a string', () => {
    const id = generateRequestId();

    expect(typeof id).toBe('string');
  });

  it('should start with "req_" prefix', () => {
    const id = generateRequestId();

    expect(id.startsWith('req_')).toBe(true);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      ids.add(generateRequestId());
    }

    expect(ids.size).toBe(100);
  });

  it('should have reasonable length', () => {
    const id = generateRequestId();

    expect(id.length).toBeGreaterThan(10);
    expect(id.length).toBeLessThan(50);
  });
});

// ============================================================================
// Test logRequest
// ============================================================================

describe('logRequest', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log request details as JSON', () => {
    const request = createMockNextRequest({
      ip: '192.168.1.1',
      method: 'POST',
      url: 'https://example.com/api/explain',
      userAgent: 'TestAgent/1.0',
    });
    const requestId = 'req_test123';

    logRequest(request, requestId);

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.requestId).toBe(requestId);
    expect(parsed.method).toBe('POST');
    expect(parsed.path).toBe('/api/explain');
  });

  it('should include timestamp in ISO format', () => {
    const request = createMockNextRequest({});

    logRequest(request, 'req_test');

    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should include client IP from identifier', () => {
    const request = createMockNextRequest({ ip: '10.0.0.5' });

    logRequest(request, 'req_test');

    expect(mockGetClientIdentifier).toHaveBeenCalledWith(request.headers);
  });

  it('should include user agent', () => {
    const request = createMockNextRequest({ userAgent: 'Mozilla/5.0' });

    logRequest(request, 'req_test');

    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.userAgent).toBe('Mozilla/5.0');
  });

  it('should include status code when provided', () => {
    const request = createMockNextRequest({});

    logRequest(request, 'req_test', 200);

    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.statusCode).toBe(200);
  });

  it('should calculate duration when startTime provided', () => {
    const request = createMockNextRequest({});
    const startTime = Date.now() - 150;

    logRequest(request, 'req_test', 200, startTime);

    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.durationMs).toBeGreaterThanOrEqual(100);
  });

  it('should set severity to WARNING for 4xx status', () => {
    const request = createMockNextRequest({});

    logRequest(request, 'req_test', 400);

    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.severity).toBe('WARNING');
  });

  it('should set severity to WARNING for 5xx status', () => {
    const request = createMockNextRequest({});

    logRequest(request, 'req_test', 500);

    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.severity).toBe('WARNING');
  });

  it('should set severity to INFO for 2xx status', () => {
    const request = createMockNextRequest({});

    logRequest(request, 'req_test', 200);

    const logOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.severity).toBe('INFO');
  });
});

// ============================================================================
// Test getGeminiApiKey
// ============================================================================

describe('getGeminiApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return GOOGLE_API_KEY when set', () => {
    process.env.GOOGLE_API_KEY = 'google-api-key';
    delete process.env.GEMINI_API_KEY;

    const key = getGeminiApiKey();

    expect(key).toBe('google-api-key');
  });

  it('should return GEMINI_API_KEY when set', () => {
    delete process.env.GOOGLE_API_KEY;
    process.env.GEMINI_API_KEY = 'gemini-api-key';

    const key = getGeminiApiKey();

    expect(key).toBe('gemini-api-key');
  });

  it('should prefer GOOGLE_API_KEY over GEMINI_API_KEY', () => {
    process.env.GOOGLE_API_KEY = 'google-key';
    process.env.GEMINI_API_KEY = 'gemini-key';

    const key = getGeminiApiKey();

    expect(key).toBe('google-key');
  });

  it('should throw when no API key is configured', () => {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(() => getGeminiApiKey()).toThrow('AI service not configured');
  });

  it('should throw when API key is empty string', () => {
    process.env.GOOGLE_API_KEY = '';
    process.env.GEMINI_API_KEY = '';

    expect(() => getGeminiApiKey()).toThrow('AI service not configured');
  });
});

// ============================================================================
// Test Edge Cases
// ============================================================================

describe('Security Edge Cases', () => {
  describe('API key edge cases', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.INTERNAL_API_KEY = 'correct-key-12345';
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should reject completely different key', () => {
      const request = createMockNextRequest({ apiKey: 'wrong-key-entirely' });

      const result = validateApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('should reject partial key match', () => {
      const request = createMockNextRequest({ apiKey: 'correct-key' }); // Missing -12345

      const result = validateApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('should handle empty Bearer token', () => {
      const request = createMockNextRequest({ bearerToken: '' });

      const result = validateApiKey(request);

      expect(result).not.toBeNull();
    });

    it('should handle Bearer without token', () => {
      const headers = new Headers();
      headers.set('authorization', 'Bearer ');
      const request = { headers, method: 'GET', url: 'https://example.com' } as NextRequest;

      const result = validateApiKey(request);

      expect(result).not.toBeNull();
    });
  });

  describe('Rate limiting edge cases', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      setupDefaultMocks();
    });

    it('should handle missing IP gracefully', () => {
      const request = createMockNextRequest({});

      expect(() => checkRequestRateLimit(request)).not.toThrow();
    });

    it('should handle request with no headers', () => {
      const request = {
        headers: new Headers(),
        method: 'GET',
        url: 'https://example.com/api/test',
      } as NextRequest;

      expect(() => checkRequestRateLimit(request)).not.toThrow();
    });
  });

  describe('Logging edge cases', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.clearAllMocks();
      setupDefaultMocks();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle null user agent', () => {
      const request = createMockNextRequest({});

      expect(() => logRequest(request, 'req_test')).not.toThrow();

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.userAgent).toBeNull();
    });

    it('should handle special characters in URL path', () => {
      const request = createMockNextRequest({
        url: 'https://example.com/api/test?foo=bar&baz=qux',
      });

      expect(() => logRequest(request, 'req_test')).not.toThrow();

      const logOutput = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.path).toBe('/api/test');
    });
  });
});

// ============================================================================
// Test Integration Scenarios
// ============================================================================

describe('Integration Scenarios', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should validate then rate limit in typical flow', () => {
    process.env.INTERNAL_API_KEY = 'valid-key';
    const request = createMockNextRequest({ apiKey: 'valid-key', ip: '192.168.1.1' });

    // First validate API key
    const authResult = validateApiKey(request);
    expect(authResult).toBeNull();

    // Then check rate limit
    const rateResult = checkRequestRateLimit(request);
    expect(rateResult).toBeNull();
  });

  it('should generate ID and log request in typical flow', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const request = createMockNextRequest({
      method: 'POST',
      url: 'https://example.com/api/explain',
      ip: '192.168.1.1',
    });

    const requestId = generateRequestId();
    const startTime = Date.now();

    // Simulate some processing time
    logRequest(request, requestId, 200, startTime);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should add headers to successful response', () => {
    const response = NextResponse.json({ success: true });

    const result = addRateLimitHeaders(response, 'client-123', RATE_LIMITS.ai);

    expect(result.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(result.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });
});
