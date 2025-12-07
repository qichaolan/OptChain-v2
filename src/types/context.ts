/**
 * Context Envelope Types for CopilotKit Integration
 *
 * Standard context envelope that wraps page-specific metadata
 * for AI analysis across all OptionChain pages.
 */

// ============================================================================
// Page Types
// ============================================================================

export type PageId =
  | 'leaps_ranker'
  | 'credit_spread_screener'
  | 'iron_condor_screener'
  | 'speculative_screener';

export type ContextType =
  | 'roi_simulator'
  | 'spread_simulator'
  | 'options_analysis';

// ============================================================================
// Device & Theme Settings
// ============================================================================

export interface UserSettings {
  theme: 'light' | 'dark';
  device: 'mobile' | 'desktop';
  locale?: string;
}

// ============================================================================
// LEAPS Metadata
// ============================================================================

export interface LeapsContract {
  contractSymbol: string;
  expiration: string;
  strike: number;
  premium: float;
  cost: float;
  impliedVolatility?: number;
  openInterest?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface LeapsRoiResult {
  targetPrice: number;
  priceChangePct: number;
  intrinsicValue: number;
  payoff: number;
  profit: number;
  roiPct: number;
}

export interface LeapsMetadata {
  symbol: string;
  underlyingPrice: number;
  targetPrice: number;
  targetPct: number;
  mode: 'high_prob' | 'high_convexity';
  contract: LeapsContract;
  roiResults: LeapsRoiResult[];
  breakeven?: number;
  maxLoss?: number;
  daysToExpiration?: number;
}

// ============================================================================
// Credit Spread Metadata
// ============================================================================

export interface CreditSpreadMetadata {
  symbol: string;
  underlyingPrice: number;
  spreadType: 'PCS' | 'CCS'; // Put Credit Spread or Call Credit Spread
  expiration: string;
  dte: number;
  shortStrike: number;
  longStrike: number;
  width: number;
  netCredit: number;
  maxLoss: number;
  maxGain: number;
  breakeven: number;
  breakevenPct: number;
  shortDelta?: number;
  probProfit?: number;
  iv?: number;
  ivp?: number;
}

// ============================================================================
// Iron Condor Metadata
// ============================================================================

export interface IronCondorMetadata {
  symbol: string;
  underlyingPrice: number;
  expiration: string;
  dte: number;
  // Put spread (lower side)
  shortPutStrike: number;
  longPutStrike: number;
  // Call spread (upper side)
  shortCallStrike: number;
  longCallStrike: number;
  // Metrics
  netCredit: number;
  maxLoss: number;
  maxGain: number;
  lowerBreakeven: number;
  upperBreakeven: number;
  profitZoneWidth: number;
  probProfit?: number;
  iv?: number;
  ivp?: number;
}

// ============================================================================
// Speculative Screener Metadata (future)
// ============================================================================

export interface SpeculativeMetadata {
  symbol: string;
  underlyingPrice: number;
  strategyType: string;
  // Add more fields as needed
}

// ============================================================================
// Union Type for All Metadata
// ============================================================================

export type PageMetadata =
  | LeapsMetadata
  | CreditSpreadMetadata
  | IronCondorMetadata
  | SpeculativeMetadata;

// ============================================================================
// Context Envelope - The Standard Wrapper
// ============================================================================

/**
 * Context Envelope
 *
 * This is the standard format for passing context to CopilotKit.
 * All page wrappers must construct this envelope before invoking AI actions.
 */
export interface ContextEnvelope<T extends PageMetadata = PageMetadata> {
  /** Page identifier */
  page: PageId;

  /** Context type for this request */
  contextType: ContextType;

  /** Page-specific metadata */
  metadata: T;

  /** User settings */
  settings: UserSettings;

  /** Client timestamp (ISO format) */
  timestamp: string;

  /** Optional session ID for tracking */
  sessionId?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a context envelope with default settings
 */
export function createContextEnvelope<T extends PageMetadata>(
  page: PageId,
  contextType: ContextType,
  metadata: T,
  settings?: Partial<UserSettings>
): ContextEnvelope<T> {
  const defaultSettings: UserSettings = {
    theme: typeof window !== 'undefined'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : 'light',
    device: typeof window !== 'undefined'
      ? (window.innerWidth < 768 ? 'mobile' : 'desktop')
      : 'desktop',
    locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
  };

  return {
    page,
    contextType,
    metadata,
    settings: { ...defaultSettings, ...settings },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create LEAPS context envelope
 */
export function createLeapsContext(
  metadata: LeapsMetadata,
  settings?: Partial<UserSettings>
): ContextEnvelope<LeapsMetadata> {
  return createContextEnvelope('leaps_ranker', 'roi_simulator', metadata, settings);
}

/**
 * Create Credit Spread context envelope
 */
export function createCreditSpreadContext(
  metadata: CreditSpreadMetadata,
  settings?: Partial<UserSettings>
): ContextEnvelope<CreditSpreadMetadata> {
  return createContextEnvelope('credit_spread_screener', 'spread_simulator', metadata, settings);
}

/**
 * Create Iron Condor context envelope
 */
export function createIronCondorContext(
  metadata: IronCondorMetadata,
  settings?: Partial<UserSettings>
): ContextEnvelope<IronCondorMetadata> {
  return createContextEnvelope('iron_condor_screener', 'spread_simulator', metadata, settings);
}
