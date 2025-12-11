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
  | 'speculative_screener'
  | 'chain_analysis';

export type ContextType =
  | 'roi_simulator'
  | 'spread_simulator'
  | 'options_analysis'
  | 'chain_analysis';

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
  premium: number;
  cost: number;
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
  breakeven: number;
  maxLoss: number;
  daysToExpiration?: number;
  /** Array of available contracts for Battle Mode comparison */
  availableContracts: LeapsContract[];
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
  // Spread dimensions
  width: number; // Width of each spread wing (e.g., $3)
  // Metrics (all in dollars per contract)
  netCredit: number; // Total credit received (dollars per contract)
  maxLoss: number;   // Maximum loss (dollars per contract)
  maxGain: number;   // Maximum gain (dollars per contract)
  lowerBreakeven: number;
  upperBreakeven: number;
  profitZoneWidth: number;
  // Risk/Reward
  ror?: number; // Return on Risk (ROR) percentage (0-1)
  riskRewardRatio?: number; // Risk to reward ratio (e.g., 3.9 for 1:3.9)
  // Probability
  probProfit?: number;
  probLoss?: number;
  // Greeks
  shortPutDelta?: number;
  shortCallDelta?: number;
  netTheta?: number; // Combined theta (daily time decay in $)
  netVega?: number; // Combined vega
  // IV metrics
  iv?: number;
  ivp?: number;
  // Distance metrics (percentage from underlying, positive = OTM)
  distToShortPut?: number;
  distToShortCall?: number;
  distToLowerBE?: number;
  distToUpperBE?: number;
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
// Chain Analysis Metadata
// ============================================================================

export interface OptionContract {
  contractSymbol: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
}

// Strike Open Interest data point for histogram
export interface StrikeOiData {
  strike: number;
  openInterest: number;
}

export interface ChainAnalysisMetadata {
  symbol: string;
  underlyingPrice: number;
  expiration: string;
  dte: number;
  selectedOption?: OptionContract;
  optionType?: 'call' | 'put';
  // Calculated metrics for selected option
  breakeven: number;
  maxLoss: number;
  leverage?: number;
  stockEquivalent?: number;
  hurdleRate?: number;
  distToBreakeven: number;
  // Total premium across all strikes (OI * mid price * 100)
  totalCallPremium: number;
  totalPutPremium: number;
  // Open Interest data for histogram
  callOiData: StrikeOiData[];
  putOiData: StrikeOiData[];
  /** Array of available options for Battle Mode comparison */
  availableOptions: OptionContract[];
}

// ============================================================================
// Union Type for All Metadata
// ============================================================================

export type PageMetadata =
  | LeapsMetadata
  | CreditSpreadMetadata
  | IronCondorMetadata
  | SpeculativeMetadata
  | ChainAnalysisMetadata;

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

/**
 * Create Chain Analysis context envelope
 */
export function createChainAnalysisContext(
  metadata: ChainAnalysisMetadata,
  settings?: Partial<UserSettings>
): ContextEnvelope<ChainAnalysisMetadata> {
  return createContextEnvelope('chain_analysis', 'chain_analysis', metadata, settings);
}
