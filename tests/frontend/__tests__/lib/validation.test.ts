/**
 * Unit tests for validation utilities in src/lib/validation.ts
 *
 * Test Scenarios:
 * - Zod schema validation for all metadata types
 * - Request validation functions
 * - Error handling and safe validation
 * - Edge cases and boundary values
 *
 * Coverage Target: ≥95% line and branch coverage
 */

import { describe, it, expect } from 'vitest';

// Import the validation module
import {
  validateExplainRequest,
  safeValidateExplainRequest,
  LeapsMetadataSchema,
  CreditSpreadMetadataSchema,
  IronCondorMetadataSchema,
  ExplainRequestSchema,
  PageIdSchema,
  ContextTypeSchema,
  VALID_PAGE_IDS,
} from '@/lib/validation';

// ============================================================================
// Test LeapsMetadataSchema
// ============================================================================

describe('LeapsMetadataSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid LEAPS metadata', () => {
      const data = {
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

      const result = LeapsMetadataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept uppercase symbol', () => {
      const data = {
        symbol: 'AAPL',
        underlyingPrice: 180.0,
        targetPrice: 200.0,
        targetPct: 0.11,
        mode: 'high_convexity',
        contract: {
          contractSymbol: 'AAPL20251219C00200000',
          expiration: '2025-12-19',
          strike: 200.0,
          premium: 10.0,
          cost: 1000.0,
        },
        roiResults: [],
      };

      const result = LeapsMetadataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject lowercase symbol', () => {
      const data = {
        symbol: 'spy',
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
        roiResults: [],
      };

      const result = LeapsMetadataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative underlying price', () => {
      const data = {
        symbol: 'SPY',
        underlyingPrice: -500.0,
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
        roiResults: [],
      };

      const result = LeapsMetadataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid mode', () => {
      const data = {
        symbol: 'SPY',
        underlyingPrice: 500.0,
        targetPrice: 580.0,
        targetPct: 0.16,
        mode: 'invalid_mode',
        contract: {
          contractSymbol: 'SPY20251219C00550000',
          expiration: '2025-12-19',
          strike: 550.0,
          premium: 30.0,
          cost: 3000.0,
        },
        roiResults: [],
      };

      const result = LeapsMetadataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Test CreditSpreadMetadataSchema
// ============================================================================

describe('CreditSpreadMetadataSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid PCS metadata', () => {
      const data = {
        symbol: 'SPY',
        underlyingPrice: 500.0,
        spreadType: 'PCS',
        expiration: '2025-12-19',
        dte: 30,
        shortStrike: 495.0,
        longStrike: 490.0,
        width: 5.0,
        netCredit: 1.50,
        maxLoss: 3.50,
        maxGain: 1.50,
        breakeven: 493.50,
        breakevenPct: -0.013,
      };

      const result = CreditSpreadMetadataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept valid CCS metadata', () => {
      const data = {
        symbol: 'QQQ',
        underlyingPrice: 450.0,
        spreadType: 'CCS',
        expiration: '2025-12-19',
        dte: 30,
        shortStrike: 460.0,
        longStrike: 465.0,
        width: 5.0,
        netCredit: 1.20,
        maxLoss: 3.80,
        maxGain: 1.20,
        breakeven: 461.20,
        breakevenPct: 0.025,
      };

      const result = CreditSpreadMetadataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject invalid spread type', () => {
      const data = {
        symbol: 'SPY',
        underlyingPrice: 500.0,
        spreadType: 'INVALID',
        expiration: '2025-12-19',
        dte: 30,
        shortStrike: 495.0,
        longStrike: 490.0,
        width: 5.0,
        netCredit: 1.50,
        maxLoss: 3.50,
        maxGain: 1.50,
        breakeven: 493.50,
        breakevenPct: -0.013,
      };

      const result = CreditSpreadMetadataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative DTE', () => {
      const data = {
        symbol: 'SPY',
        underlyingPrice: 500.0,
        spreadType: 'PCS',
        expiration: '2025-12-19',
        dte: -5,
        shortStrike: 495.0,
        longStrike: 490.0,
        width: 5.0,
        netCredit: 1.50,
        maxLoss: 3.50,
        maxGain: 1.50,
        breakeven: 493.50,
        breakevenPct: -0.013,
      };

      const result = CreditSpreadMetadataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Test IronCondorMetadataSchema
// ============================================================================

describe('IronCondorMetadataSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid iron condor metadata', () => {
      const data = {
        symbol: 'SPY',
        underlyingPrice: 500.0,
        expiration: '2025-12-19',
        dte: 30,
        shortPutStrike: 490.0,
        longPutStrike: 485.0,
        shortCallStrike: 510.0,
        longCallStrike: 515.0,
        netCredit: 2.50,
        maxLoss: 2.50,
        maxGain: 2.50,
        lowerBreakeven: 487.50,
        upperBreakeven: 512.50,
        profitZoneWidth: 25.0,
      };

      const result = IronCondorMetadataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject negative profit zone width', () => {
      const data = {
        symbol: 'SPY',
        underlyingPrice: 500.0,
        expiration: '2025-12-19',
        dte: 30,
        shortPutStrike: 490.0,
        longPutStrike: 485.0,
        shortCallStrike: 510.0,
        longCallStrike: 515.0,
        netCredit: 2.50,
        maxLoss: 2.50,
        maxGain: 2.50,
        lowerBreakeven: 487.50,
        upperBreakeven: 512.50,
        profitZoneWidth: -25.0,
      };

      const result = IronCondorMetadataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Test PageIdSchema
// ============================================================================

describe('PageIdSchema', () => {
  it('should accept valid page IDs', () => {
    const validIds = ['leaps_ranker', 'credit_spread_screener', 'iron_condor_screener', 'speculative_screener'];

    for (const id of validIds) {
      const result = PageIdSchema.safeParse(id);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid page IDs', () => {
    const invalidIds = ['invalid_page', 'random', ''];

    for (const id of invalidIds) {
      const result = PageIdSchema.safeParse(id);
      expect(result.success).toBe(false);
    }
  });

  it('should export VALID_PAGE_IDS', () => {
    expect(VALID_PAGE_IDS).toBeDefined();
    expect(VALID_PAGE_IDS.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test ContextTypeSchema
// ============================================================================

describe('ContextTypeSchema', () => {
  it('should accept valid context types', () => {
    const validTypes = ['roi_simulator', 'spread_simulator', 'options_analysis'];

    for (const type of validTypes) {
      const result = ContextTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid context types', () => {
    const invalidTypes = ['invalid_context', 'random', ''];

    for (const type of invalidTypes) {
      const result = ContextTypeSchema.safeParse(type);
      expect(result.success).toBe(false);
    }
  });
});

// ============================================================================
// Test ExplainRequestSchema
// ============================================================================

describe('ExplainRequestSchema', () => {
  it('should accept valid LEAPS request', () => {
    const data = {
      pageId: 'leaps_ranker',
      contextType: 'roi_simulator',
      metadata: {
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
        roiResults: [],
      },
    };

    const result = ExplainRequestSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing pageId', () => {
    const data = {
      contextType: 'roi_simulator',
      metadata: {
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
        roiResults: [],
      },
    };

    const result = ExplainRequestSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Test validateExplainRequest
// ============================================================================

describe('validateExplainRequest', () => {
  it('should return validated data for valid input', () => {
    const data = {
      pageId: 'leaps_ranker',
      contextType: 'roi_simulator',
      metadata: {
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
        roiResults: [],
      },
    };

    const result = validateExplainRequest(data);
    expect(result.pageId).toBe('leaps_ranker');
    expect(result.contextType).toBe('roi_simulator');
  });

  it('should throw for invalid input', () => {
    const data = {
      pageId: 'invalid',
      contextType: 'roi_simulator',
      metadata: {},
    };

    expect(() => validateExplainRequest(data)).toThrow();
  });
});

// ============================================================================
// Test safeValidateExplainRequest
// ============================================================================

describe('safeValidateExplainRequest', () => {
  it('should return success true for valid input', () => {
    const data = {
      pageId: 'leaps_ranker',
      contextType: 'roi_simulator',
      metadata: {
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
        roiResults: [],
      },
    };

    const result = safeValidateExplainRequest(data);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should return success false with error for invalid input', () => {
    const data = {
      pageId: 'invalid_page',
      contextType: 'roi_simulator',
      metadata: {},
    };

    const result = safeValidateExplainRequest(data);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should include error details in error message', () => {
    const data = {
      pageId: 'invalid_page',
    };

    const result = safeValidateExplainRequest(data);
    expect(result.success).toBe(false);
    expect(result.error).toContain('pageId');
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe('Edge cases', () => {
  it('should handle null input', () => {
    const result = safeValidateExplainRequest(null);
    expect(result.success).toBe(false);
  });

  it('should handle undefined input', () => {
    const result = safeValidateExplainRequest(undefined);
    expect(result.success).toBe(false);
  });

  it('should handle empty object', () => {
    const result = safeValidateExplainRequest({});
    expect(result.success).toBe(false);
  });

  it('should handle symbol at max length', () => {
    const data = {
      symbol: 'ABCDEFGHIJ', // 10 chars - max allowed
      underlyingPrice: 100.0,
      targetPrice: 120.0,
      targetPct: 0.20,
      mode: 'high_prob',
      contract: {
        contractSymbol: 'TEST',
        expiration: '2025-12-19',
        strike: 110.0,
        premium: 5.0,
        cost: 500.0,
      },
      roiResults: [],
    };

    const result = LeapsMetadataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject symbol over max length', () => {
    const data = {
      symbol: 'ABCDEFGHIJK', // 11 chars - over max
      underlyingPrice: 100.0,
      targetPrice: 120.0,
      targetPct: 0.20,
      mode: 'high_prob',
      contract: {
        contractSymbol: 'TEST',
        expiration: '2025-12-19',
        strike: 110.0,
        premium: 5.0,
        cost: 500.0,
      },
      roiResults: [],
    };

    const result = LeapsMetadataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
