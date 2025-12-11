/**
 * Unit tests for AI Explainer Action in src/actions/aiExplainerAction.ts
 *
 * Test Scenarios:
 * - Action configuration constants
 * - handleAiExplainerAction function
 * - getAiExplainerActionDefinition function
 * - Error handling and edge cases
 *
 * Coverage Target: ≥95% line and branch coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AI_EXPLAINER_ACTION,
  handleAiExplainerAction,
  getAiExplainerActionDefinition,
} from '@/actions/aiExplainerAction';
import type { ContextEnvelope, LeapsMetadata } from '@/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockLeapsMetadata: LeapsMetadata = {
  symbol: 'SPY',
  underlyingPrice: 500.0,
  targetPrice: 580.0,
  targetPct: 0.16,
  mode: 'high_prob',
  contract: {
    contractSymbol: 'SPY20251219C00550000',
    expiration: '2025-12-19',
    strike: 550.0,
    premium: 30.0,
    cost: 3000.0,
  },
  roiResults: [
    {
      targetPrice: 580.0,
      priceChangePct: 0.16,
      intrinsicValue: 30.0,
      payoff: 3000.0,
      profit: 0.0,
      roiPct: 0.0,
    },
  ],
};

const mockContextEnvelope: ContextEnvelope<LeapsMetadata> = {
  page: 'leaps_ranker',
  contextType: 'roi_simulator',
  metadata: mockLeapsMetadata,
  settings: {
    theme: 'dark',
    device: 'desktop',
    locale: 'en-US',
  },
  timestamp: '2025-01-15T10:30:00Z',
};

const mockSuccessResponse = {
  success: true,
  content: {
    summary: 'This is a bullish LEAPS strategy on SPY.',
    keyInsights: [
      {
        title: 'High Probability Setup',
        description: 'Strike is well below target price.',
        sentiment: 'positive' as const,
      },
    ],
    risks: [
      {
        risk: 'Time decay will erode option value.',
        severity: 'medium' as const,
      },
    ],
    watchItems: [
      {
        item: 'SPY price movement',
        trigger: 'Below $480',
      },
    ],
    disclaimer: 'This is for educational purposes only.',
  },
  cached: false,
};

// ============================================================================
// Test AI_EXPLAINER_ACTION constant
// ============================================================================

describe('AI_EXPLAINER_ACTION constant', () => {
  it('should have correct name', () => {
    expect(AI_EXPLAINER_ACTION.name).toBe('analyzeOptionsStrategy');
  });

  it('should have description', () => {
    expect(AI_EXPLAINER_ACTION.description).toBeDefined();
    expect(AI_EXPLAINER_ACTION.description.length).toBeGreaterThan(0);
  });

  it('should describe action capabilities', () => {
    expect(AI_EXPLAINER_ACTION.description).toContain('options trading strategy');
    expect(AI_EXPLAINER_ACTION.description).toContain('insights');
  });

  it('should have parameters array', () => {
    expect(AI_EXPLAINER_ACTION.parameters).toBeDefined();
    expect(Array.isArray(AI_EXPLAINER_ACTION.parameters)).toBe(true);
  });

  it('should have context parameter', () => {
    const contextParam = AI_EXPLAINER_ACTION.parameters.find(
      (p) => p.name === 'context'
    );
    expect(contextParam).toBeDefined();
    expect(contextParam?.type).toBe('object');
    expect(contextParam?.required).toBe(true);
  });
});

// ============================================================================
// Test handleAiExplainerAction
// ============================================================================

describe('handleAiExplainerAction', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // --------------------------------------------------------------------------
  // Context validation tests
  // --------------------------------------------------------------------------

  describe('context validation', () => {
    it('should return error for missing page', async () => {
      const invalidContext = {
        ...mockContextEnvelope,
        page: undefined,
      } as unknown as ContextEnvelope<LeapsMetadata>;

      const result = await handleAiExplainerAction(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid context');
    });

    it('should return error for missing contextType', async () => {
      const invalidContext = {
        ...mockContextEnvelope,
        contextType: undefined,
      } as unknown as ContextEnvelope<LeapsMetadata>;

      const result = await handleAiExplainerAction(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid context');
    });

    it('should return error for missing metadata', async () => {
      const invalidContext = {
        ...mockContextEnvelope,
        metadata: undefined,
      } as unknown as ContextEnvelope<LeapsMetadata>;

      const result = await handleAiExplainerAction(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid context');
    });

    it('should return error for null page', async () => {
      const invalidContext = {
        ...mockContextEnvelope,
        page: null,
      } as unknown as ContextEnvelope<LeapsMetadata>;

      const result = await handleAiExplainerAction(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid context');
    });

    it('should return error for empty string page', async () => {
      const invalidContext = {
        ...mockContextEnvelope,
        page: '',
      } as unknown as ContextEnvelope<LeapsMetadata>;

      const result = await handleAiExplainerAction(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid context');
    });
  });

  // --------------------------------------------------------------------------
  // Successful API call tests
  // --------------------------------------------------------------------------

  describe('successful API calls', () => {
    it('should make POST request to correct endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });
      global.fetch = mockFetch;

      await handleAiExplainerAction(mockContextEnvelope);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/copilotkit/explain',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should send correct request body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });
      global.fetch = mockFetch;

      await handleAiExplainerAction(mockContextEnvelope);

      const call = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(call[1].body);

      expect(requestBody.pageId).toBe('leaps_ranker');
      expect(requestBody.contextType).toBe('roi_simulator');
      expect(requestBody.timestamp).toBe('2025-01-15T10:30:00Z');
      expect(requestBody.metadata).toEqual(mockLeapsMetadata);
      expect(requestBody.settings).toEqual(mockContextEnvelope.settings);
    });

    it('should return success result with data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.summary).toBe('This is a bullish LEAPS strategy on SPY.');
    });

    it('should return fromCache flag', async () => {
      const cachedResponse = {
        ...mockSuccessResponse,
        cached: true,
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(cachedResponse),
      });
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
    });

    it('should include signal in fetch request for timeout', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });
      global.fetch = mockFetch;

      await handleAiExplainerAction(mockContextEnvelope);

      const call = mockFetch.mock.calls[0];
      expect(call[1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  // --------------------------------------------------------------------------
  // Error response tests
  // --------------------------------------------------------------------------

  describe('API error responses', () => {
    it('should handle HTTP error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });

    it('should handle HTTP error with status code fallback', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      });
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 503');
    });

    it('should handle JSON parse error on error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 502');
    });

    it('should handle API success false response', async () => {
      const failedResponse = {
        success: false,
        error: 'Rate limit exceeded',
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(failedResponse),
      });
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle API success false without error message', async () => {
      const failedResponse = {
        success: false,
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(failedResponse),
      });
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get AI explanation');
    });
  });

  // --------------------------------------------------------------------------
  // Network and timeout error tests
  // --------------------------------------------------------------------------

  describe('network and timeout errors', () => {
    it('should handle network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle abort error with timeout message', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out. Please try again.');
    });

    it('should handle unknown error (non-Error object)', async () => {
      const mockFetch = vi.fn().mockRejectedValue('String error');
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });

    it('should handle null thrown as error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(null);
      global.fetch = mockFetch;

      const result = await handleAiExplainerAction(mockContextEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });
  });

  // --------------------------------------------------------------------------
  // Console logging tests
  // --------------------------------------------------------------------------

  describe('error logging', () => {
    it('should log error to console for non-abort errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'));
      global.fetch = mockFetch;

      await handleAiExplainerAction(mockContextEnvelope);

      expect(consoleSpy).toHaveBeenCalledWith(
        'AI Explainer Action Error:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should not log abort errors to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      global.fetch = mockFetch;

      await handleAiExplainerAction(mockContextEnvelope);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Test getAiExplainerActionDefinition
// ============================================================================

describe('getAiExplainerActionDefinition', () => {
  it('should return action definition object', () => {
    const definition = getAiExplainerActionDefinition();

    expect(definition).toBeDefined();
    expect(typeof definition).toBe('object');
  });

  it('should include correct name', () => {
    const definition = getAiExplainerActionDefinition();

    expect(definition.name).toBe('analyzeOptionsStrategy');
  });

  it('should include description', () => {
    const definition = getAiExplainerActionDefinition();

    expect(definition.description).toBeDefined();
    expect(definition.description.length).toBeGreaterThan(0);
  });

  it('should include parameters', () => {
    const definition = getAiExplainerActionDefinition();

    expect(definition.parameters).toBeDefined();
    expect(Array.isArray(definition.parameters)).toBe(true);
    expect(definition.parameters.length).toBeGreaterThan(0);
  });

  it('should include handler function', () => {
    const definition = getAiExplainerActionDefinition();

    expect(definition.handler).toBeDefined();
    expect(typeof definition.handler).toBe('function');
  });

  it('should reference handleAiExplainerAction as handler', () => {
    const definition = getAiExplainerActionDefinition();

    expect(definition.handler).toBe(handleAiExplainerAction);
  });
});

// ============================================================================
// Integration-like tests
// ============================================================================

describe('action integration tests', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should handle complete flow with credit spread context', async () => {
    const creditSpreadContext: ContextEnvelope = {
      page: 'credit_spread_screener',
      contextType: 'spread_simulator',
      metadata: {
        symbol: 'QQQ',
        underlyingPrice: 450.0,
        spreadType: 'PCS',
        expiration: '2025-01-17',
        dte: 14,
        shortStrike: 440.0,
        longStrike: 435.0,
        width: 5.0,
        netCredit: 1.50,
        maxLoss: 3.50,
        maxGain: 1.50,
        breakeven: 438.50,
        breakevenPct: -0.0256,
      },
      settings: {
        theme: 'light',
        device: 'mobile',
      },
      timestamp: '2025-01-15T12:00:00Z',
    };

    const spreadResponse = {
      success: true,
      content: {
        summary: 'Put credit spread on QQQ.',
        strategyName: 'Bull Put Spread',
        keyInsights: [],
        risks: [],
        watchItems: [],
        disclaimer: 'Educational only.',
        tradeMechanics: {
          structure: 'Sell 440P, Buy 435P',
          creditReceived: '$1.50',
          marginRequirement: '$500',
        },
      },
      cached: false,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(spreadResponse),
    });
    global.fetch = mockFetch;

    const result = await handleAiExplainerAction(creditSpreadContext);

    expect(result.success).toBe(true);
    expect(result.data?.strategyName).toBe('Bull Put Spread');
    expect(result.data?.tradeMechanics?.structure).toBe('Sell 440P, Buy 435P');
  });

  it('should handle iron condor context', async () => {
    const ironCondorContext: ContextEnvelope = {
      page: 'iron_condor_screener',
      contextType: 'spread_simulator',
      metadata: {
        symbol: 'SPX',
        underlyingPrice: 5000.0,
        expiration: '2025-02-21',
        dte: 30,
        shortPutStrike: 4900.0,
        longPutStrike: 4850.0,
        shortCallStrike: 5100.0,
        longCallStrike: 5150.0,
        width: 50.0,
        netCredit: 8.50,
        maxLoss: 41.50,
        maxGain: 8.50,
        lowerBreakeven: 4891.50,
        upperBreakeven: 5108.50,
        profitZoneWidth: 217.0,
      },
      settings: {
        theme: 'dark',
        device: 'desktop',
      },
      timestamp: '2025-01-15T14:00:00Z',
    };

    const ironCondorResponse = {
      success: true,
      content: {
        summary: 'Iron condor on SPX with defined risk.',
        strategyName: 'Iron Condor',
        keyInsights: [],
        risks: [],
        watchItems: [],
        disclaimer: 'Educational only.',
        visualization: {
          profitZone: '$4,891.50 - $5,108.50',
          lowerLossZone: 'Below $4,850',
          upperLossZone: 'Above $5,150',
        },
      },
      cached: true,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(ironCondorResponse),
    });
    global.fetch = mockFetch;

    const result = await handleAiExplainerAction(ironCondorContext);

    expect(result.success).toBe(true);
    expect(result.fromCache).toBe(true);
    expect(result.data?.visualization?.profitZone).toContain('4,891.50');
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe('edge cases', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should handle context with minimal required fields', async () => {
    const minimalContext: ContextEnvelope = {
      page: 'leaps_ranker',
      contextType: 'roi_simulator',
      metadata: mockLeapsMetadata,
      settings: {
        theme: 'light',
        device: 'desktop',
      },
      timestamp: new Date().toISOString(),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });
    global.fetch = mockFetch;

    const result = await handleAiExplainerAction(minimalContext);

    expect(result.success).toBe(true);
  });

  it('should handle context with optional sessionId', async () => {
    const contextWithSession: ContextEnvelope<LeapsMetadata> = {
      ...mockContextEnvelope,
      sessionId: 'test-session-123',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });
    global.fetch = mockFetch;

    const result = await handleAiExplainerAction(contextWithSession);

    expect(result.success).toBe(true);
  });

  it('should handle very large metadata payload', async () => {
    const largeMetadata: LeapsMetadata = {
      ...mockLeapsMetadata,
      roiResults: Array(100).fill({
        targetPrice: 600.0,
        priceChangePct: 0.20,
        intrinsicValue: 50.0,
        payoff: 5000.0,
        profit: 2000.0,
        roiPct: 0.67,
      }),
    };

    const largeContext: ContextEnvelope<LeapsMetadata> = {
      ...mockContextEnvelope,
      metadata: largeMetadata,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });
    global.fetch = mockFetch;

    const result = await handleAiExplainerAction(largeContext);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle empty roiResults array', async () => {
    const emptyRoiContext: ContextEnvelope<LeapsMetadata> = {
      ...mockContextEnvelope,
      metadata: {
        ...mockLeapsMetadata,
        roiResults: [],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });
    global.fetch = mockFetch;

    const result = await handleAiExplainerAction(emptyRoiContext);

    expect(result.success).toBe(true);
  });
});
