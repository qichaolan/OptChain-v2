/**
 * Input Validation Schemas
 *
 * Zod schemas for validating API inputs.
 * Prevents prompt injection and ensures type safety.
 */

import { z } from 'zod';

// ============================================================================
// Page IDs
// ============================================================================

export const PageIdSchema = z.enum([
  'leaps_ranker',
  'credit_spread_screener',
  'iron_condor_screener',
  'speculative_screener',
]);

export type PageId = z.infer<typeof PageIdSchema>;

export const VALID_PAGE_IDS = PageIdSchema.options;

// ============================================================================
// Context Types
// ============================================================================

export const ContextTypeSchema = z.enum([
  'roi_simulator',
  'spread_simulator',
  'options_analysis',
]);

export type ContextType = z.infer<typeof ContextTypeSchema>;

// ============================================================================
// LEAPS Metadata
// ============================================================================

export const LeapsContractSchema = z.object({
  contractSymbol: z.string().max(50),
  expiration: z.string().max(20),
  strike: z.number().positive(),
  premium: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  impliedVolatility: z.number().nonnegative().optional(),
  openInterest: z.number().nonnegative().optional(),
  delta: z.number().min(-1).max(1).optional(),
  gamma: z.number().optional(),
  theta: z.number().optional(),
  vega: z.number().optional(),
});

export const LeapsRoiResultSchema = z.object({
  targetPrice: z.number().positive(),
  priceChangePct: z.number(),
  intrinsicValue: z.number(),
  payoff: z.number(),
  profit: z.number(),
  roiPct: z.number(),
});

export const LeapsMetadataSchema = z.object({
  symbol: z.string().max(10).regex(/^[A-Z]+$/),
  underlyingPrice: z.number().positive(),
  targetPrice: z.number().positive(),
  targetPct: z.number(),
  mode: z.enum(['high_prob', 'high_convexity']),
  contract: LeapsContractSchema,
  roiResults: z.array(LeapsRoiResultSchema).max(20),
  breakeven: z.number().optional(),
  maxLoss: z.number().optional(),
  daysToExpiration: z.number().nonnegative().optional(),
});

// ============================================================================
// Credit Spread Metadata
// ============================================================================

export const CreditSpreadMetadataSchema = z.object({
  symbol: z.string().max(10).regex(/^[A-Z]+$/),
  underlyingPrice: z.number().positive(),
  spreadType: z.enum(['PCS', 'CCS']),
  expiration: z.string().max(20),
  dte: z.number().nonnegative(),
  shortStrike: z.number().positive(),
  longStrike: z.number().positive(),
  width: z.number().positive(),
  netCredit: z.number().nonnegative(),
  maxLoss: z.number().nonnegative(),
  maxGain: z.number().nonnegative(),
  breakeven: z.number().positive(),
  breakevenPct: z.number(),
  shortDelta: z.number().min(-1).max(1).optional(),
  probProfit: z.number().min(0).max(100).optional(),
  iv: z.number().nonnegative().optional(),
  ivp: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Iron Condor Metadata
// ============================================================================

export const IronCondorMetadataSchema = z.object({
  symbol: z.string().max(10).regex(/^[A-Z]+$/),
  underlyingPrice: z.number().positive(),
  expiration: z.string().max(20),
  dte: z.number().nonnegative(),
  shortPutStrike: z.number().positive(),
  longPutStrike: z.number().positive(),
  shortCallStrike: z.number().positive(),
  longCallStrike: z.number().positive(),
  netCredit: z.number().nonnegative(),
  maxLoss: z.number().nonnegative(),
  maxGain: z.number().nonnegative(),
  lowerBreakeven: z.number().positive(),
  upperBreakeven: z.number().positive(),
  profitZoneWidth: z.number().positive(),
  probProfit: z.number().min(0).max(100).optional(),
  iv: z.number().nonnegative().optional(),
  ivp: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Combined Metadata (Union)
// ============================================================================

export const MetadataSchema = z.union([
  LeapsMetadataSchema,
  CreditSpreadMetadataSchema,
  IronCondorMetadataSchema,
]);

// ============================================================================
// Micro Action Schema
// ============================================================================

export const MicroActionTypeSchema = z.enum([
  // LEAPS
  'leaps.explain_breakeven',
  'leaps.explain_leverage',
  'leaps.highlight_risks',
  'leaps.compare_contracts',
  // Credit Spreads
  'credit_spread.analyze_probability_of_touch',
  'credit_spread.analyze_roi_risk_tradeoff',
  'credit_spread.explain_delta',
  'credit_spread.explain_theta',
  // Iron Condor
  'iron_condor.explain_regions',
  'iron_condor.explain_profit_zone',
  'iron_condor.analyze_skew',
  'iron_condor.analyze_wing_balance',
  // Metrics
  'metric.explain_iv',
  'metric.explain_score',
  'metric.explain_dte',
  // Scenario simulations
  'scenario.what_if_price_change',
  'scenario.what_if_iv_change',
  'scenario.what_if_time_passes',
  // Generic contextual help
  'generic.summarize_selection',
  'generic.explain_section',
]);

export const MicroActionSchema = z.object({
  type: MicroActionTypeSchema,
  prompt: z.string().max(500),
});

export type MicroAction = z.infer<typeof MicroActionSchema>;

// ============================================================================
// Tooltip Metric Schema
// ============================================================================

export const MetricTypeSchema = z.enum([
  'iv',
  'ivp',
  'delta',
  'score',
  'dte',
  'roc',
  'pop',
  'breakeven',
  'strike',
  'premium',
  'width',
  'credit',
  'max_gain',
  'max_loss',
]);

export const TooltipRequestSchema = z.object({
  metricType: MetricTypeSchema,
  metricValue: z.union([z.string(), z.number()]),
  metricLabel: z.string().max(100).optional(),
});

export type TooltipRequest = z.infer<typeof TooltipRequestSchema>;

// ============================================================================
// API Request Schema
// ============================================================================

// For micro actions and tooltips, we allow more flexible metadata
const FlexibleMetadataSchema = z.record(z.unknown());

// Full analysis requests - use flexible metadata to accept any structure
const FullAnalysisRequestSchema = z.object({
  pageId: PageIdSchema,
  contextType: ContextTypeSchema,
  metadata: FlexibleMetadataSchema,
  timestamp: z.string().datetime().optional(),
  settings: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    device: z.enum(['mobile', 'desktop']).optional(),
    locale: z.string().max(10).optional(),
  }).optional(),
  microAction: z.undefined().optional(),
  tooltipRequest: z.undefined().optional(),
});

// Micro action requests have flexible metadata
const MicroActionRequestSchema = z.object({
  pageId: PageIdSchema.optional(),
  contextType: ContextTypeSchema.optional(),
  metadata: FlexibleMetadataSchema,
  timestamp: z.string().datetime().optional(),
  settings: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    device: z.enum(['mobile', 'desktop']).optional(),
    locale: z.string().max(10).optional(),
  }).optional(),
  microAction: MicroActionSchema,
  tooltipRequest: z.undefined().optional(),
});

// Tooltip requests have flexible metadata
const TooltipExplainRequestSchema = z.object({
  pageId: PageIdSchema.optional(),
  contextType: ContextTypeSchema.optional(),
  metadata: FlexibleMetadataSchema,
  timestamp: z.string().datetime().optional(),
  settings: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    device: z.enum(['mobile', 'desktop']).optional(),
    locale: z.string().max(10).optional(),
  }).optional(),
  microAction: z.undefined().optional(),
  tooltipRequest: TooltipRequestSchema,
});

export const ExplainRequestSchema = z.union([
  MicroActionRequestSchema,
  TooltipExplainRequestSchema,
  FullAnalysisRequestSchema,
]);

export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

// ============================================================================
// Validation Helper
// ============================================================================

export function validateExplainRequest(data: unknown): ExplainRequest {
  return ExplainRequestSchema.parse(data);
}

export function safeValidateExplainRequest(data: unknown): {
  success: boolean;
  data?: ExplainRequest;
  error?: string;
} {
  const result = ExplainRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
  };
}
