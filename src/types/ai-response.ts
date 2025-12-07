/**
 * AI Response Types
 *
 * Type definitions for structured AI responses from CopilotKit/Gemini.
 * These mirror the existing AiExplainer models from the FastAPI backend.
 */

// ============================================================================
// Common Types
// ============================================================================

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Severity = 'low' | 'medium' | 'high';

// ============================================================================
// Key Insight
// ============================================================================

export interface KeyInsight {
  title: string;
  description: string;
  sentiment: Sentiment;
}

// ============================================================================
// Risk Item
// ============================================================================

export interface RiskItem {
  risk: string;
  severity: Severity;
}

// ============================================================================
// Watch Item
// ============================================================================

export interface WatchItem {
  item: string;
  trigger?: string;
}

// ============================================================================
// Scenario Analysis (LEAPS)
// ============================================================================

export interface Scenario {
  minAnnualReturn: string;
  projectedPriceTarget: string;
  payoffRealism: string;
  optionPayoff: string;
}

export interface Scenarios {
  mediumIncrease?: Scenario;
  strongIncrease?: Scenario;
}

// ============================================================================
// Trade Mechanics (Credit Spreads / Iron Condors)
// ============================================================================

export interface TradeMechanics {
  structure: string;
  creditReceived: string;
  marginRequirement: string;
  breakeven?: string;
  breakevens?: string;
}

// ============================================================================
// Key Metrics
// ============================================================================

export interface MetricValue {
  value: string;
  condition?: string;
}

export interface KeyMetrics {
  maxProfit?: MetricValue;
  maxLoss?: MetricValue;
  riskRewardRatio?: string;
  probabilityOfProfit?: string;
}

// ============================================================================
// Visualization (Profit/Loss Zones)
// ============================================================================

export interface Visualization {
  profitZone?: string;
  lossZone?: string;
  lowerLossZone?: string;
  upperLossZone?: string;
  transitionZone?: string;
  transitionZones?: string;
}

// ============================================================================
// Strategy Outcome
// ============================================================================

export interface StrategyOutcome {
  scenario: string;
  result: string;
  sentiment: Sentiment;
}

export interface StrategyAnalysis {
  bullishOutcome?: StrategyOutcome;
  neutralOutcome?: StrategyOutcome;
  bearishOutcome?: StrategyOutcome;
  extremeMoveOutcome?: StrategyOutcome;
}

// ============================================================================
// Risk Management
// ============================================================================

export interface RiskManagement {
  earlyExitTrigger?: string;
  adjustmentOptions?: string;
  worstCase?: string;
}

// ============================================================================
// AI Explainer Content
// ============================================================================

export interface AiExplainerContent {
  // Common fields (all pages)
  summary: string;
  keyInsights: KeyInsight[];
  risks: RiskItem[];
  watchItems: WatchItem[];
  disclaimer: string;

  // LEAPS-specific
  scenarios?: Scenarios;

  // Credit Spread / Iron Condor specific
  strategyName?: string;
  tradeMechanics?: TradeMechanics;
  keyMetrics?: KeyMetrics;
  visualization?: Visualization;
  strategyAnalysis?: StrategyAnalysis;
  riskManagement?: RiskManagement;
}

// ============================================================================
// AI Explainer Response
// ============================================================================

export interface AiExplainerResponse {
  success: boolean;
  pageId: string;
  contextType: string;
  content?: AiExplainerContent;
  cached: boolean;
  cachedAt?: string;
  error?: string;
  timestamp: string;
}

// ============================================================================
// CopilotKit Action Result
// ============================================================================

export interface CopilotActionResult {
  success: boolean;
  data?: AiExplainerContent;
  error?: string;
  fromCache?: boolean;
}
