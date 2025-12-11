/**
 * Unit tests for context types and factory functions in src/types/context.ts
 *
 * Test Scenarios:
 * - Context envelope creation
 * - Factory functions for different page types
 * - Default settings handling
 * - Edge cases and boundary conditions
 *
 * Coverage Target: ≥95% line and branch coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createContextEnvelope,
  createLeapsContext,
  createCreditSpreadContext,
  createIronCondorContext,
  createChainAnalysisContext,
  type LeapsMetadata,
  type CreditSpreadMetadata,
  type IronCondorMetadata,
  type ChainAnalysisMetadata,
  type UserSettings,
} from '@/types/context';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockLeapsMetadata: LeapsMetadata = {
  symbol: 'AAPL',
  underlyingPrice: 180.50,
  targetPrice: 200.00,
  targetPct: 0.108,
  mode: 'high_prob',
  contract: {
    contractSymbol: 'AAPL20251219C00200000',
    expiration: '2025-12-19',
    strike: 200.0,
    premium: 15.50,
    cost: 1550.0,
    impliedVolatility: 0.25,
    openInterest: 5000,
    delta: 0.45,
    gamma: 0.02,
    theta: -0.05,
    vega: 0.35,
  },
  roiResults: [
    {
      targetPrice: 200.0,
      priceChangePct: 0.108,
      intrinsicValue: 0,
      payoff: 0,
      profit: -1550,
      roiPct: -1.0,
    },
    {
      targetPrice: 220.0,
      priceChangePct: 0.219,
      intrinsicValue: 20,
      payoff: 2000,
      profit: 450,
      roiPct: 0.29,
    },
  ],
  breakeven: 215.50,
  maxLoss: 1550.0,
  daysToExpiration: 365,
};

const mockCreditSpreadMetadata: CreditSpreadMetadata = {
  symbol: 'SPY',
  underlyingPrice: 500.0,
  spreadType: 'PCS',
  expiration: '2025-03-21',
  dte: 45,
  shortStrike: 495.0,
  longStrike: 490.0,
  width: 5.0,
  netCredit: 1.50,
  maxLoss: 3.50,
  maxGain: 1.50,
  breakeven: 493.50,
  breakevenPct: -0.013,
  shortDelta: -0.30,
  probProfit: 70.0,
  iv: 0.18,
  ivp: 45.0,
};

const mockIronCondorMetadata: IronCondorMetadata = {
  symbol: 'QQQ',
  underlyingPrice: 450.0,
  expiration: '2025-03-21',
  dte: 30,
  shortPutStrike: 430.0,
  longPutStrike: 425.0,
  shortCallStrike: 470.0,
  longCallStrike: 475.0,
  netCredit: 2.00,
  maxLoss: 3.00,
  maxGain: 2.00,
  lowerBreakeven: 428.0,
  upperBreakeven: 472.0,
  profitZoneWidth: 44.0,
  probProfit: 65.0,
  iv: 0.20,
  ivp: 50.0,
};

const mockChainAnalysisMetadata: ChainAnalysisMetadata = {
  symbol: 'NVDA',
  underlyingPrice: 750.0,
  expiration: '2025-03-21',
  dte: 30,
  selectedOption: {
    contractSymbol: 'NVDA20250321C00800000',
    optionType: 'call',
    strike: 800.0,
    expiration: '2025-03-21',
    lastPrice: 25.50,
    bid: 25.00,
    ask: 26.00,
    volume: 1500,
    openInterest: 10000,
    impliedVolatility: 0.45,
    delta: 0.35,
    gamma: 0.01,
    theta: -0.50,
    vega: 0.80,
    rho: 0.15,
  },
  optionType: 'call',
  breakeven: 825.50,
  maxLoss: 2550.0,
  leverage: 30.0,
  stockEquivalent: 35,
  hurdleRate: 10.1,
  distToBreakeven: 10.1,
};

const mockUserSettings: UserSettings = {
  theme: 'dark',
  device: 'desktop',
  locale: 'en-US',
};

// ============================================================================
// Test createContextEnvelope
// ============================================================================

describe('createContextEnvelope', () => {
  // Mock window and navigator for browser environment
  const originalWindow = global.window;
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1920,
      },
      writable: true,
    });

    // Mock navigator.language
    Object.defineProperty(global, 'navigator', {
      value: {
        language: 'en-US',
      },
      writable: true,
    });
  });

  afterEach(() => {
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  it('should create envelope with all required fields', () => {
    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.page).toBe('leaps_ranker');
    expect(envelope.contextType).toBe('roi_simulator');
    expect(envelope.metadata).toEqual(mockLeapsMetadata);
    expect(envelope.settings).toBeDefined();
    expect(envelope.timestamp).toBeDefined();
  });

  it('should use provided settings', () => {
    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata,
      mockUserSettings
    );

    expect(envelope.settings.theme).toBe('dark');
    expect(envelope.settings.device).toBe('desktop');
    expect(envelope.settings.locale).toBe('en-US');
  });

  it('should merge partial settings with defaults', () => {
    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata,
      { theme: 'dark' }
    );

    expect(envelope.settings.theme).toBe('dark');
    expect(envelope.settings.device).toBeDefined();
    expect(envelope.settings.locale).toBeDefined();
  });

  it('should generate ISO timestamp', () => {
    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    // Should be valid ISO date string
    const date = new Date(envelope.timestamp);
    expect(date.toISOString()).toBe(envelope.timestamp);
  });

  it('should detect dark theme from matchMedia', () => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        innerWidth: 1920,
      },
      writable: true,
    });

    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.settings.theme).toBe('dark');
  });

  it('should detect mobile device from innerWidth', () => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 600, // < 768
      },
      writable: true,
    });

    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.settings.device).toBe('mobile');
  });

  it('should detect desktop device from innerWidth', () => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1024, // >= 768
      },
      writable: true,
    });

    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.settings.device).toBe('desktop');
  });

  it('should use navigator.language for locale', () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        language: 'fr-FR',
      },
      writable: true,
    });

    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.settings.locale).toBe('fr-FR');
  });
});

// ============================================================================
// Test createLeapsContext
// ============================================================================

describe('createLeapsContext', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1920,
      },
      writable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
    });
  });

  it('should create LEAPS context with correct page and contextType', () => {
    const context = createLeapsContext(mockLeapsMetadata);

    expect(context.page).toBe('leaps_ranker');
    expect(context.contextType).toBe('roi_simulator');
  });

  it('should include LEAPS metadata', () => {
    const context = createLeapsContext(mockLeapsMetadata);

    expect(context.metadata.symbol).toBe('AAPL');
    expect(context.metadata.underlyingPrice).toBe(180.50);
    expect(context.metadata.mode).toBe('high_prob');
  });

  it('should include contract details', () => {
    const context = createLeapsContext(mockLeapsMetadata);

    expect(context.metadata.contract.strike).toBe(200.0);
    expect(context.metadata.contract.delta).toBe(0.45);
  });

  it('should include ROI results', () => {
    const context = createLeapsContext(mockLeapsMetadata);

    expect(context.metadata.roiResults.length).toBe(2);
    expect(context.metadata.roiResults[1].targetPrice).toBe(220.0);
  });

  it('should accept custom settings', () => {
    const context = createLeapsContext(mockLeapsMetadata, mockUserSettings);

    expect(context.settings.theme).toBe('dark');
  });
});

// ============================================================================
// Test createCreditSpreadContext
// ============================================================================

describe('createCreditSpreadContext', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1920,
      },
      writable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
    });
  });

  it('should create credit spread context with correct page and contextType', () => {
    const context = createCreditSpreadContext(mockCreditSpreadMetadata);

    expect(context.page).toBe('credit_spread_screener');
    expect(context.contextType).toBe('spread_simulator');
  });

  it('should include spread metadata', () => {
    const context = createCreditSpreadContext(mockCreditSpreadMetadata);

    expect(context.metadata.symbol).toBe('SPY');
    expect(context.metadata.spreadType).toBe('PCS');
    expect(context.metadata.shortStrike).toBe(495.0);
    expect(context.metadata.longStrike).toBe(490.0);
  });

  it('should include risk/reward metrics', () => {
    const context = createCreditSpreadContext(mockCreditSpreadMetadata);

    expect(context.metadata.netCredit).toBe(1.50);
    expect(context.metadata.maxLoss).toBe(3.50);
    expect(context.metadata.breakeven).toBe(493.50);
  });

  it('should include probability metrics', () => {
    const context = createCreditSpreadContext(mockCreditSpreadMetadata);

    expect(context.metadata.probProfit).toBe(70.0);
    expect(context.metadata.shortDelta).toBe(-0.30);
  });

  it('should accept custom settings', () => {
    const context = createCreditSpreadContext(mockCreditSpreadMetadata, { theme: 'light' });

    expect(context.settings.theme).toBe('light');
  });
});

// ============================================================================
// Test createIronCondorContext
// ============================================================================

describe('createIronCondorContext', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1920,
      },
      writable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
    });
  });

  it('should create iron condor context with correct page and contextType', () => {
    const context = createIronCondorContext(mockIronCondorMetadata);

    expect(context.page).toBe('iron_condor_screener');
    expect(context.contextType).toBe('spread_simulator');
  });

  it('should include all four strikes', () => {
    const context = createIronCondorContext(mockIronCondorMetadata);

    expect(context.metadata.shortPutStrike).toBe(430.0);
    expect(context.metadata.longPutStrike).toBe(425.0);
    expect(context.metadata.shortCallStrike).toBe(470.0);
    expect(context.metadata.longCallStrike).toBe(475.0);
  });

  it('should include breakeven points', () => {
    const context = createIronCondorContext(mockIronCondorMetadata);

    expect(context.metadata.lowerBreakeven).toBe(428.0);
    expect(context.metadata.upperBreakeven).toBe(472.0);
    expect(context.metadata.profitZoneWidth).toBe(44.0);
  });

  it('should include risk/reward metrics', () => {
    const context = createIronCondorContext(mockIronCondorMetadata);

    expect(context.metadata.netCredit).toBe(2.00);
    expect(context.metadata.maxLoss).toBe(3.00);
    expect(context.metadata.maxGain).toBe(2.00);
  });

  it('should accept custom settings', () => {
    const context = createIronCondorContext(mockIronCondorMetadata, mockUserSettings);

    expect(context.settings.device).toBe('desktop');
  });
});

// ============================================================================
// Test createChainAnalysisContext
// ============================================================================

describe('createChainAnalysisContext', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1920,
      },
      writable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
    });
  });

  it('should create chain analysis context with correct page and contextType', () => {
    const context = createChainAnalysisContext(mockChainAnalysisMetadata);

    expect(context.page).toBe('chain_analysis');
    expect(context.contextType).toBe('chain_analysis');
  });

  it('should include selected option details', () => {
    const context = createChainAnalysisContext(mockChainAnalysisMetadata);

    expect(context.metadata.selectedOption?.strike).toBe(800.0);
    expect(context.metadata.selectedOption?.optionType).toBe('call');
    expect(context.metadata.selectedOption?.delta).toBe(0.35);
  });

  it('should include calculated metrics', () => {
    const context = createChainAnalysisContext(mockChainAnalysisMetadata);

    expect(context.metadata.breakeven).toBe(825.50);
    expect(context.metadata.leverage).toBe(30.0);
    expect(context.metadata.stockEquivalent).toBe(35);
  });

  it('should accept custom settings', () => {
    const context = createChainAnalysisContext(mockChainAnalysisMetadata, { locale: 'de-DE' });

    expect(context.settings.locale).toBe('de-DE');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        innerWidth: 1920,
      },
      writable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
    });
  });

  it('should handle metadata with optional fields missing', () => {
    const minimalLeaps: LeapsMetadata = {
      symbol: 'TEST',
      underlyingPrice: 100,
      targetPrice: 110,
      targetPct: 0.1,
      mode: 'high_convexity',
      contract: {
        contractSymbol: 'TEST',
        expiration: '2025-12-31',
        strike: 100,
        premium: 5,
        cost: 500,
      },
      roiResults: [],
    };

    const context = createLeapsContext(minimalLeaps);

    expect(context.metadata.breakeven).toBeUndefined();
    expect(context.metadata.maxLoss).toBeUndefined();
    expect(context.metadata.daysToExpiration).toBeUndefined();
  });

  it('should handle empty roiResults array', () => {
    const metadataWithEmptyResults: LeapsMetadata = {
      ...mockLeapsMetadata,
      roiResults: [],
    };

    const context = createLeapsContext(metadataWithEmptyResults);

    expect(context.metadata.roiResults).toEqual([]);
  });

  it('should handle chain analysis without selected option', () => {
    const metadataWithoutOption: ChainAnalysisMetadata = {
      symbol: 'TEST',
      underlyingPrice: 100,
      expiration: '2025-12-31',
      dte: 30,
    };

    const context = createChainAnalysisContext(metadataWithoutOption);

    expect(context.metadata.selectedOption).toBeUndefined();
  });

  it('should handle very large numbers in metadata', () => {
    const metadataWithLargeNumbers: LeapsMetadata = {
      ...mockLeapsMetadata,
      underlyingPrice: 1000000.99,
      targetPrice: 2000000.99,
    };

    const context = createLeapsContext(metadataWithLargeNumbers);

    expect(context.metadata.underlyingPrice).toBe(1000000.99);
    expect(context.metadata.targetPrice).toBe(2000000.99);
  });

  it('should handle negative profit values', () => {
    const metadataWithNegativeProfit: LeapsMetadata = {
      ...mockLeapsMetadata,
      roiResults: [
        {
          targetPrice: 180,
          priceChangePct: -0.1,
          intrinsicValue: 0,
          payoff: 0,
          profit: -1550,
          roiPct: -1.0,
        },
      ],
    };

    const context = createLeapsContext(metadataWithNegativeProfit);

    expect(context.metadata.roiResults[0].profit).toBe(-1550);
    expect(context.metadata.roiResults[0].roiPct).toBe(-1.0);
  });

  it('should handle CCS spread type', () => {
    const ccsMetadata: CreditSpreadMetadata = {
      ...mockCreditSpreadMetadata,
      spreadType: 'CCS',
      shortStrike: 510.0,
      longStrike: 515.0,
    };

    const context = createCreditSpreadContext(ccsMetadata);

    expect(context.metadata.spreadType).toBe('CCS');
    expect(context.metadata.shortStrike).toBe(510.0);
    expect(context.metadata.longStrike).toBe(515.0);
  });
});

// ============================================================================
// SSR Handling (window/navigator undefined)
// ============================================================================

describe('SSR Handling', () => {
  it('should use default light theme when window is undefined', () => {
    const originalWindow = global.window;
    // @ts-expect-error - intentionally setting to undefined for SSR test
    global.window = undefined;

    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.settings.theme).toBe('light');
    global.window = originalWindow;
  });

  it('should use desktop as default device when window is undefined', () => {
    const originalWindow = global.window;
    // @ts-expect-error - intentionally setting to undefined for SSR test
    global.window = undefined;

    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.settings.device).toBe('desktop');
    global.window = originalWindow;
  });

  it('should use en-US as default locale when navigator is undefined', () => {
    const originalNavigator = global.navigator;
    const originalWindow = global.window;

    // Mock window with matchMedia but without navigator
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      innerWidth: 1024,
    });
    // @ts-expect-error - intentionally setting to undefined for SSR test
    global.navigator = undefined;

    const envelope = createContextEnvelope(
      'leaps_ranker',
      'roi_simulator',
      mockLeapsMetadata
    );

    expect(envelope.settings.locale).toBe('en-US');

    global.navigator = originalNavigator;
    global.window = originalWindow;
    vi.unstubAllGlobals();
  });
});
