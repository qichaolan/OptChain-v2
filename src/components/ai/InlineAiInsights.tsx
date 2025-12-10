'use client';

/**
 * Inline AI Insights Component - Chatless Generative UI
 *
 * Renders AI insights directly inline within the application UI.
 * This is the core component for chatless generative UI - no conversation,
 * just native UI elements that feel like built-in product features.
 *
 * Key traits:
 * - No chat surface
 * - App decides when and where generative UI appears
 * - Feels like a built-in product feature
 * - Ideal for dashboards, suggestions, and autonomous task helpers
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAiExplainer } from '@/hooks';
import { useOptionChain } from '@/contexts';
import { AiExplainerContent, KeyInsight, Scenario } from '@/types/ai-response';
import { sanitizeAiResponse } from '@/lib/sanitize';
import { MicroActionsGroup } from './MicroAiAction';
import type { MicroActionType } from './MicroAiAction';
import { HoverAI } from './HoverAI';
import { BattleModeComparison } from './BattleModeComparison';

// ============================================================================
// InfoTooltip Component - Reusable tooltip with (?) icon
// Uses React Portal for proper rendering outside overflow:hidden containers
// ============================================================================

interface InfoTooltipProps {
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

// Helper function to calculate tooltip position
function calculateTooltipPosition(
  rect: DOMRect,
  position: 'top' | 'bottom' | 'left' | 'right',
  tooltipWidth: number,
  tooltipHeight: number
): { top: number; left: number; actualPosition: string } {
  const gap = 8;
  const viewportPadding = 16;
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  let top = 0;
  let left = 0;
  let actualPosition = position;

  // Calculate initial position based on preferred position
  switch (position) {
    case 'top':
      top = rect.top + scrollY - tooltipHeight - gap;
      left = rect.left + scrollX + rect.width / 2 - tooltipWidth / 2;
      break;
    case 'bottom':
      top = rect.bottom + scrollY + gap;
      left = rect.left + scrollX + rect.width / 2 - tooltipWidth / 2;
      break;
    case 'left':
      top = rect.top + scrollY + rect.height / 2 - tooltipHeight / 2;
      left = rect.left + scrollX - tooltipWidth - gap;
      break;
    case 'right':
      top = rect.top + scrollY + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + scrollX + gap;
      break;
  }

  // Flip position if going off screen
  if (position === 'top' && rect.top - tooltipHeight - gap < viewportPadding) {
    top = rect.bottom + scrollY + gap;
    actualPosition = 'bottom';
  }
  if (position === 'bottom' && rect.bottom + tooltipHeight + gap > window.innerHeight - viewportPadding) {
    top = rect.top + scrollY - tooltipHeight - gap;
    actualPosition = 'top';
  }
  if (position === 'left' && rect.left - tooltipWidth - gap < viewportPadding) {
    left = rect.right + scrollX + gap;
    actualPosition = 'right';
  }
  if (position === 'right' && rect.right + tooltipWidth + gap > window.innerWidth - viewportPadding) {
    left = rect.left + scrollX - tooltipWidth - gap;
    actualPosition = 'left';
  }

  // Clamp horizontal position to viewport
  left = Math.max(
    viewportPadding + scrollX,
    Math.min(left, window.innerWidth - tooltipWidth - viewportPadding + scrollX)
  );

  // Clamp vertical position to viewport
  top = Math.max(
    viewportPadding + scrollY,
    Math.min(top, window.innerHeight - tooltipHeight - viewportPadding + scrollY)
  );

  return { top, left, actualPosition };
}

function InfoTooltip({ content, position = 'top', className = '' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure we're on client-side for Portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Clear any pending hide timeout
  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  // Calculate position and show tooltip
  const handleMouseEnter = () => {
    clearHideTimeout();

    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const tooltipWidth = 280;
      const tooltipHeight = 200; // max-height

      const { top, left } = calculateTooltipPosition(rect, position, tooltipWidth, tooltipHeight);
      setCoords({ top, left });
    }

    setIsVisible(true);
  };

  // Hide tooltip after a small delay (allows moving to tooltip)
  const handleMouseLeave = () => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setCoords(null);
    }, 150);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearHideTimeout();
  }, []);

  // Tooltip content rendered via Portal
  const tooltipContent = isVisible && coords && isMounted && (
    createPortal(
      <div
        ref={tooltipRef}
        className="fixed z-[99999] w-[280px] max-h-[200px] overflow-y-auto px-3 py-2.5 text-xs leading-relaxed text-white bg-gray-800 rounded-lg shadow-2xl border border-gray-600 animate-fade-in"
        style={{
          top: coords.top,
          left: coords.left,
          pointerEvents: 'auto',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </div>,
      document.body
    )
  );

  return (
    <>
      <span className={`relative inline-flex items-center ${className}`}>
        <span
          ref={iconRef}
          className="cursor-help text-gray-400 hover:text-blue-500 transition-colors ml-0.5"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </span>
      {tooltipContent}
    </>
  );
}

// Tooltip content definitions
const TOOLTIP_CONTENT = {
  delta: (isCall: boolean) => (
    <>
      <p className="mb-1.5">
        <strong>Delta</strong> represents the rate of change in the option&apos;s price relative to changes in the underlying asset&apos;s price. A Delta of 0.5 means the option price will change by 50% of the underlying&apos;s price movement.
      </p>
      <p className="text-gray-300">
        {isCall
          ? 'Delta is positive for calls, meaning the option price increases as the underlying price increases.'
          : 'Delta is negative for puts, meaning the option price decreases as the underlying price increases.'}
      </p>
    </>
  ),
  gamma: (
    <>
      <p className="mb-1.5">
        <strong>Gamma</strong> measures the rate of change in Delta as the underlying asset&apos;s price changes. It helps assess how stable Delta is over time.
      </p>
      <p className="text-gray-300">
        High Gamma indicates that Delta is more sensitive to price changes. Gamma is most important for traders managing options with shorter time to expiration, as it determines how quickly Delta will change.
      </p>
    </>
  ),
  theta: (
    <>
      <p className="mb-1.5">
        <strong>Theta</strong> represents the rate of decline in the option&apos;s price due to time decay. As expiration approaches, options lose value at a faster rate.
      </p>
      <p className="text-gray-300">
        A high Theta indicates the option will lose value quickly as expiration nears, particularly for out-of-the-money options.
      </p>
    </>
  ),
  vega: (
    <>
      <p className="mb-1.5">
        <strong>Vega</strong> represents the sensitivity of the option&apos;s price to changes in volatility.
      </p>
      <p className="text-gray-300">
        A high Vega means the option&apos;s price is more affected by changes in implied volatility. Increases in volatility lead to higher option premiums, while decreases lower them.
      </p>
    </>
  ),
  iv: (
    <>
      <p className="mb-1.5">
        <strong>Implied Volatility (IV)</strong> reflects the market&apos;s expectation of how much the underlying asset&apos;s price will move in the future.
      </p>
      <p className="text-gray-300">
        High IV suggests larger expected price movements. IV is a key factor in option pricing—higher IV increases option prices, and lower IV decreases them.
      </p>
    </>
  ),
  breakeven: (isCall: boolean) => (
    <>
      <p className="mb-1.5">
        <strong>Breakeven</strong> is the price at which the option&apos;s value will cover the cost of the premium.
      </p>
      <p className="text-gray-300">
        {isCall
          ? 'For calls, breakeven = strike price + premium paid.'
          : 'For puts, breakeven = strike price - premium paid.'}
      </p>
    </>
  ),
  maxLoss: (
    <>
      <p className="mb-1.5">
        <strong>Max Loss</strong> is the maximum amount you can lose on this options trade.
      </p>
      <p className="text-gray-300">
        For buying options, this is the premium paid. For selling options, it can be much higher depending on the position.
      </p>
    </>
  ),
  openInterest: (
    <>
      <p className="mb-1.5">
        <strong>Open Interest (Open Int)</strong> refers to the total number of outstanding contracts (calls or puts) that have not been settled or closed. It reflects the liquidity and market activity of the option.
      </p>
      <p className="text-gray-300">
        A high open interest indicates a more liquid option, making it easier to enter and exit positions. Conversely, a low open interest might signal a less liquid market with higher spreads and potential difficulties in executing trades.
      </p>
    </>
  ),
  totalCallPremium: (
    <>
      <p className="mb-1.5">
        <strong>Total Call Premium</strong> represents the total notional value of all open call option contracts for this expiration.
      </p>
      <p className="text-gray-300">
        Calculated as the sum of (Open Interest x Mid Price x 100) across all call strikes. Higher total premium indicates more capital committed to call positions.
      </p>
    </>
  ),
  totalPutPremium: (
    <>
      <p className="mb-1.5">
        <strong>Total Put Premium</strong> represents the total notional value of all open put option contracts for this expiration.
      </p>
      <p className="text-gray-300">
        Calculated as the sum of (Open Interest x Mid Price x 100) across all put strikes. Higher total premium indicates more capital committed to put positions.
      </p>
    </>
  ),
};

// ============================================================================
// Page-specific Micro Actions
// ============================================================================

const LEAPS_ACTIONS: MicroActionType[] = [
  'leaps.explain_breakeven',
  'leaps.explain_leverage',
  'leaps.highlight_risks',
  'leaps.compare_contracts',
];

const CREDIT_SPREAD_ACTIONS: MicroActionType[] = [
  'credit_spread.analyze_probability_of_touch',
  'credit_spread.analyze_roi_risk_tradeoff',
  'credit_spread.explain_delta',
  'credit_spread.explain_theta',
];

const IRON_CONDOR_ACTIONS: MicroActionType[] = [
  'iron_condor.explain_profit_zone',
  'iron_condor.explain_regions',
  'iron_condor.analyze_skew',
  'iron_condor.analyze_wing_balance',
];

// ============================================================================
// Types
// ============================================================================

type InsightSize = 'compact' | 'standard' | 'detailed';

interface InlineAiInsightsProps {
  /** Size variant for the insights display */
  size?: InsightSize;
  /** Auto-trigger analysis when metadata changes */
  autoAnalyze?: boolean;
  /** Custom className */
  className?: string;
  /** Show only specific sections */
  sections?: ('summary' | 'metrics' | 'insights' | 'scenarios' | 'risks' | 'watchItems')[];
}

// ============================================================================
// Sub-components
// ============================================================================

function InlineLoadingState({ size }: { size: InsightSize }) {
  if (size === 'compact') {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
        <span>Analyzing...</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-4 border border-primary-100">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <div>
          <p className="text-sm font-medium text-gray-700">AI Analysis in Progress</p>
          <p className="text-xs text-gray-500">Evaluating your strategy...</p>
        </div>
      </div>
    </div>
  );
}

// Map insight titles to action types for HoverAI
// Includes both exact matches and keywords for partial matching
const INSIGHT_ACTION_MAP: Record<string, MicroActionType> = {
  // LEAPS-specific insights
  'Breakeven Hurdle': 'leaps.explain_breakeven',
  'Breakeven Analysis': 'leaps.explain_breakeven',
  'Breakeven': 'leaps.explain_breakeven',
  'Leverage Cost': 'leaps.explain_leverage',
  'Leverage Profile': 'leaps.explain_leverage',
  'Leverage': 'leaps.explain_leverage',
  'Liquidity Assessment': 'generic.explain_section',
  'Liquidity': 'generic.explain_section',
  'Dividend Opportunity Cost': 'generic.explain_section',
  'Dividend': 'generic.explain_section',
  // Greeks and metrics
  'Delta': 'credit_spread.explain_delta',
  'Theta': 'credit_spread.explain_theta',
  'IV': 'metric.explain_iv',
  'Implied Volatility': 'metric.explain_iv',
  'Score': 'metric.explain_score',
  'ROI': 'roi.analyze_value',
  'Return': 'roi.analyze_value',
  // Iron condor
  'Skew': 'iron_condor.analyze_skew',
  // Generic
  'Risk': 'leaps.highlight_risks',
  'Risk/Reward': 'leaps.highlight_risks',
};

function getActionForInsight(title: string): MicroActionType | null {
  // Check exact match first
  if (INSIGHT_ACTION_MAP[title]) {
    return INSIGHT_ACTION_MAP[title];
  }
  // Check partial match
  for (const [key, action] of Object.entries(INSIGHT_ACTION_MAP)) {
    if (title.toLowerCase().includes(key.toLowerCase())) {
      return action;
    }
  }
  return null;
}

function QuickInsightBadge({ insight }: { insight: KeyInsight }) {
  const sentimentStyles = {
    positive: 'bg-green-100 text-green-800 border-green-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    negative: 'bg-red-100 text-red-800 border-red-200',
  };

  const icons = {
    positive: '↑',
    neutral: '→',
    negative: '↓',
  };

  const action = getActionForInsight(insight.title);

  const badge = (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${sentimentStyles[insight.sentiment]}`}>
      <span>{icons[insight.sentiment]}</span>
      <span>{insight.title}</span>
    </span>
  );

  // Wrap with HoverAI if we have an action for this insight
  if (action) {
    return (
      <HoverAI
        action={action}
        metadata={{ insightTitle: insight.title, insightDescription: insight.description }}
      >
        {badge}
      </HoverAI>
    );
  }

  return badge;
}

function MetricCard({
  label,
  value,
  subtext,
  variant = 'neutral',
}: {
  label: string;
  value: string;
  subtext?: string;
  variant?: 'positive' | 'negative' | 'neutral';
}) {
  const variantStyles = {
    positive: 'bg-green-50 border-green-200',
    negative: 'bg-red-50 border-red-200',
    neutral: 'bg-gray-50 border-gray-200',
  };

  const valueStyles = {
    positive: 'text-green-700',
    negative: 'text-red-700',
    neutral: 'text-gray-900',
  };

  return (
    <div className={`rounded-lg border p-3 ${variantStyles[variant]}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${valueStyles[variant]}`}>{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

function ScenarioCard({ title, scenario }: { title: string; scenario: Scenario }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="font-medium text-blue-800 mb-2">{title}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Annual Return:</span>
          <span className="font-medium">{scenario.minAnnualReturn}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Price Target:</span>
          <span className="font-medium">{scenario.projectedPriceTarget}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Payoff:</span>
          <span className="font-medium text-green-700">{scenario.optionPayoff}</span>
        </div>
        {scenario.payoffRealism && (
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-blue-200">
            {scenario.payoffRealism}
          </div>
        )}
      </div>
    </div>
  );
}

// Contract Summary - displays key contract info at the top of AI panel
interface ContractSummaryProps {
  metadata: Record<string, unknown>;
}

// Shared currency formatter
const formatCurrency = (val: number | undefined) =>
  val !== undefined ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

const formatExpirationDate = (dateStr: string) => {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BLACK-SCHOLES DELTA ESTIMATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard normal cumulative distribution function (CDF)
 * Approximation using Abramowitz and Stegun formula
 */
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Estimate call option delta using Black-Scholes formula
 *
 * @param underlyingPrice - Current price of underlying (S)
 * @param strike - Strike price (K)
 * @param dte - Days to expiration
 * @param iv - Implied volatility (as decimal, e.g., 0.30 for 30%)
 * @param riskFreeRate - Risk-free rate (default 5%)
 * @param dividendYield - Continuous dividend yield (default 1.3% for SPY)
 * @returns Estimated delta (0 to 1 for calls)
 */
function estimateCallDelta(
  underlyingPrice: number,
  strike: number,
  dte: number,
  iv?: number,
  riskFreeRate: number = 0.05,
  dividendYield: number = 0.013
): number | undefined {
  // Validate inputs
  if (!underlyingPrice || underlyingPrice <= 0 ||
      !strike || strike <= 0 ||
      !dte || dte <= 0) {
    return undefined;
  }

  // Default IV if not provided (30% is typical for index options like SPY)
  const sigma = iv !== undefined ? (iv < 1 ? iv : iv / 100) : 0.30;

  const S = underlyingPrice;
  const K = strike;
  const T = dte / 365;
  const r = riskFreeRate;
  const q = dividendYield;

  // Black-Scholes d1 calculation
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);

  // Delta for call = e^(-qT) * N(d1)
  const delta = Math.exp(-q * T) * normalCDF(d1);

  // Clamp to reasonable bounds
  return Math.max(0.01, Math.min(0.99, delta));
}

// LEAPS Summary - displays comprehensive LEAPS call info matching Credit Spread/Iron Condor style
function LeapsSummary({ metadata }: ContractSummaryProps) {
  // Extract contract info from metadata (handle both flat and nested structures)
  const contract = (metadata.contract as Record<string, unknown>) || metadata;
  const symbol = metadata.symbol as string || '-';
  const underlyingPrice = metadata.underlyingPrice as number;
  const strike = contract.strike as number;
  const expiration = contract.expiration as string || '-';
  const premium = contract.premium as number; // Per-share premium (e.g., $168.37)
  const cost = contract.cost as number; // Total cost = premium * 100 (e.g., $16,837)
  const providedDelta = contract.delta as number | undefined;
  const rawIV = contract.impliedVolatility as number | undefined;

  // ═══════════════════════════════════════════════════════════════════════
  // CALCULATED FIELDS
  // ═══════════════════════════════════════════════════════════════════════

  // DTE: Calculate from expiration date if not provided
  const providedDTE = metadata.daysToExpiration as number | undefined;
  const calculatedDTE = (() => {
    if (providedDTE !== undefined) return providedDTE;
    if (!expiration || expiration === '-') return undefined;
    try {
      const expDate = new Date(expiration);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expDate.setHours(0, 0, 0, 0);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch {
      return undefined;
    }
  })();

  // Implied Volatility: Detect if decimal (0.185) or percentage (18.5)
  // If IV < 1, it's a decimal and needs no conversion for display
  // If IV >= 1, it's already a percentage
  const ivNormalized = rawIV !== undefined ? (rawIV < 1 ? rawIV : rawIV / 100) : undefined;
  const ivDisplay = rawIV !== undefined
    ? (rawIV < 1 ? (rawIV * 100).toFixed(1) : rawIV.toFixed(1))
    : undefined;

  // ═══════════════════════════════════════════════════════════════════════
  // DELTA ESTIMATION (Black-Scholes when not provided)
  // ═══════════════════════════════════════════════════════════════════════
  const estimatedDelta = calculatedDTE
    ? estimateCallDelta(underlyingPrice, strike, calculatedDTE, ivNormalized)
    : undefined;
  const effectiveDelta = providedDelta ?? estimatedDelta;
  const isDeltaEstimated = providedDelta === undefined && estimatedDelta !== undefined;

  // Breakeven: Strike + Premium (per-share)
  // If not provided, calculate it
  const providedBreakeven = metadata.breakeven as number | undefined;
  const calculatedBreakeven = providedBreakeven ?? (strike && premium ? strike + premium : undefined);

  // Distance to Breakeven: (breakeven - underlying) / underlying * 100
  const distToBreakeven = calculatedBreakeven && underlyingPrice
    ? ((calculatedBreakeven - underlyingPrice) / underlyingPrice) * 100
    : undefined;

  // Intrinsic value (for ITM calls): max(0, underlying - strike)
  const intrinsicValue = underlyingPrice && strike ? Math.max(0, underlyingPrice - strike) : 0;

  // Extrinsic value ("rent" or time value): premium - intrinsic
  const extrinsicValue = premium ? Math.max(0, premium - intrinsicValue) : 0;

  // Stock equivalent value = delta * 100 * underlying price
  const stockEquivalent = effectiveDelta && underlyingPrice
    ? effectiveDelta * 100 * underlyingPrice
    : undefined;

  // Leverage = Stock Equivalent / Net Debit = (delta * 100 * underlying) / cost
  // This shows how much stock exposure you get per dollar invested
  const leverage = stockEquivalent && cost && cost > 0
    ? stockEquivalent / cost
    : undefined;

  // ═══════════════════════════════════════════════════════════════════════
  // HURDLE RATE: Annualized return (CAGR) needed for stock to reach breakeven
  // Formula: (1 + totalReturn)^(1/years) - 1
  // Where totalReturn = (breakeven - underlying) / underlying
  // This tells you the compound annual growth rate needed to break even
  // ═══════════════════════════════════════════════════════════════════════
  const hurdleRate = (() => {
    if (!calculatedBreakeven || !underlyingPrice || !calculatedDTE || calculatedDTE <= 0) {
      return undefined;
    }
    // Total return needed to reach breakeven
    const totalReturn = (calculatedBreakeven - underlyingPrice) / underlyingPrice;
    // If already above breakeven (shouldn't happen for calls), return 0
    if (totalReturn <= 0) return 0;
    // Years to expiration
    const yearsToExp = calculatedDTE / 365;
    // CAGR formula: (1 + totalReturn)^(1/years) - 1
    const cagr = Math.pow(1 + totalReturn, 1 / yearsToExp) - 1;
    // Return as percentage
    return cagr * 100;
  })();

  // Determine moneyness for badge
  const getMoneynessBadge = () => {
    if (!underlyingPrice || !strike) return { label: '-', color: 'bg-gray-100 text-gray-600' };
    const moneyness = ((underlyingPrice - strike) / strike) * 100;
    if (moneyness > 15) return { label: 'Deep ITM', color: 'bg-emerald-100 text-emerald-700' };
    if (moneyness > 5) return { label: 'ITM', color: 'bg-green-100 text-green-700' };
    if (moneyness > -5) return { label: 'ATM', color: 'bg-yellow-100 text-yellow-700' };
    if (moneyness > -15) return { label: 'OTM', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Deep OTM', color: 'bg-red-100 text-red-700' };
  };
  const moneyness = getMoneynessBadge();

  return (
    <div className="bg-white rounded-lg border border-gray-300 shadow-sm mb-4 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER: Symbol + LEAPS Badge + Underlying Price
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">{symbol}</span>
            <span className="text-[11px] bg-emerald-600 text-white px-2.5 py-1 rounded-full font-semibold tracking-wide">
              LEAPS Call
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Underlying</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(underlyingPrice)}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SUB-HEADER BAR: Exp | DTE | Strike
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Exp</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{expiration}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">DTE</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{calculatedDTE ?? '-'}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Strike</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{formatCurrency(strike)}</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LEG: Single Leg Display with Moneyness Badge
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-gray-200 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-[11px] text-green-600 font-semibold uppercase">BUY</span>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(strike)} Call</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${moneyness.color}`}>
            {moneyness.label}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW: EFFICIENCY | COST PROFILE (Compact)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200">
        {/* EFFICIENCY SIDE */}
        <div className="bg-green-50 px-2.5 py-2">
          <div className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-green-200">
            Efficiency
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Leverage:</span>
              <span className="text-lg font-bold text-green-700">{leverage !== undefined ? `${leverage.toFixed(1)}x` : '-'}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Delta{isDeltaEstimated ? ' (est)' : ''}:</span>
              <span className="text-sm font-bold text-green-700">{effectiveDelta !== undefined ? effectiveDelta.toFixed(2) : '-'}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Stock Equiv:</span>
              <span className="text-sm font-semibold text-green-700">{stockEquivalent !== undefined ? formatCurrency(stockEquivalent) : '-'}</span>
            </div>
          </div>
        </div>
        {/* COST PROFILE SIDE */}
        <div className="bg-red-50 px-2.5 py-2">
          <div className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-red-200">
            Cost Profile
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Cost:</span>
              <span className="text-lg font-bold text-red-700">{formatCurrency(cost)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Extrinsic:</span>
              <span className="text-sm font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">{formatCurrency(extrinsicValue * 100)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Implied Vol:</span>
              <span className="text-sm font-semibold text-red-700">{ivDisplay !== undefined ? `${ivDisplay}%` : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ANALYSIS ZONE: Breakeven + Hurdle Rate
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-2.5 py-2 bg-blue-50">
        <div className="space-y-1">
          {/* Row 1: Breakeven & Distance */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-600">Breakeven: <span className="font-semibold text-blue-700">{calculatedBreakeven ? formatCurrency(calculatedBreakeven) : '-'}</span></span>
            <span className="text-gray-600">Dist to BE: <span className={`font-semibold ${(distToBreakeven ?? 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>{distToBreakeven !== undefined ? `${distToBreakeven >= 0 ? '+' : ''}${distToBreakeven.toFixed(1)}%` : '-'}</span></span>
          </div>
          {/* Row 2: Hurdle Rate (Key Metric) */}
          <div className="flex items-center justify-center pt-1 border-t border-blue-200">
            <span className="text-[11px] text-gray-600">Hurdle Rate: </span>
            <span className="text-sm font-bold text-blue-700 ml-1.5">{hurdleRate !== undefined ? `+${hurdleRate.toFixed(1)}% Annually` : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Credit Spread Summary - displays comprehensive credit spread info at the top of AI panel
function CreditSpreadSummary({ metadata }: ContractSummaryProps) {
  // Extract all available metadata
  const symbol = metadata.symbol as string || '-';
  const spreadType = metadata.spreadType as string || '-';
  const expiration = metadata.expiration as string || '-';
  const dte = metadata.dte as number;
  const shortStrike = metadata.shortStrike as number;
  const longStrike = metadata.longStrike as number;
  const netCredit = metadata.netCredit as number;
  // Note: maxGain/maxLoss from API are per-contract (x100), we calculate from per-share values instead
  const breakeven = metadata.breakeven as number;
  const underlyingPrice = metadata.underlyingPrice as number;
  const width = metadata.width as number || Math.abs((shortStrike || 0) - (longStrike || 0));

  // Additional investor metrics
  const probProfit = metadata.probProfit as number; // POP
  const shortDelta = metadata.shortDelta as number;
  const ivp = metadata.ivp as number; // IV Percentile
  const netTheta = metadata.netTheta as number; // Net theta for the spread

  // Calculate derived values using per-share values for correct ratios
  // netCredit is per-share (e.g., $0.61), maxGain/maxLoss are per-contract (x100)
  const creditPerShare = netCredit || 0;
  // Calculate max loss per-share using width (which is per-share): loss = width - credit
  const lossPerShare = width > 0 ? (width - creditPerShare) : 0;

  // For display: use per-contract values (x100) for dollar amounts
  const creditDisplay = creditPerShare * 100;  // Per-contract credit
  const lossDisplay = lossPerShare * 100;      // Per-contract max loss

  // ROR and Risk:Reward use per-share values (ratio is same regardless of multiplier)
  // ROR = Credit / MaxLoss as percentage (e.g., $0.61 / $2.39 = 25.5%)
  const rorPct = lossPerShare > 0 ? ((creditPerShare / lossPerShare) * 100) : 0;
  // Risk:Reward ratio (e.g., 1:3.9 means risking $3.90 to make $1)
  const riskRewardRatio = creditPerShare > 0 ? (lossPerShare / creditPerShare).toFixed(1) : '-';

  // Expected Value (EV) = POP × Max Profit − (1 − POP) × Max Loss
  // Uses per-contract values for display
  const expectedValue = probProfit
    ? (probProfit * creditDisplay) - ((1 - probProfit) * lossDisplay)
    : null;

  // Distance calculations
  const distToShortPct = underlyingPrice && shortStrike
    ? (((underlyingPrice - shortStrike) / underlyingPrice) * 100)
    : null;
  const spreadBadgeColor = spreadType === 'PCS'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';

  const spreadLabel = spreadType === 'PCS' ? 'Put Credit Spread' : 'Call Credit Spread';

  // For PCS: distance is positive when underlying > strike (safe)
  // For CCS: distance is positive when strike > underlying (safe)
  // Display: PCS shows negative (downside risk), CCS shows positive (upside risk)
  const distToShortDisplay = spreadType === 'PCS'
    ? (distToShortPct !== null ? -Math.abs(distToShortPct) : null)  // Always negative for PCS (downside)
    : (distToShortPct !== null ? Math.abs(distToShortPct) : null);  // Always positive for CCS (upside)


  return (
    <div className="bg-white rounded-lg border border-gray-300 shadow-sm mb-4 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER: Symbol + Strategy Badge + Underlying Price
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-100 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">{symbol}</span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold tracking-wide ${spreadBadgeColor}`}>
              {spreadLabel}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Underlying</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(underlyingPrice)}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SUB-HEADER BAR: Exp | DTE | Width
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Exp</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{expiration}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">DTE</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{dte ?? '-'}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Width</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">${width}</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LEGS: Compact Horizontal Layout
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-gray-500 font-semibold uppercase">{spreadType === 'PCS' ? 'Puts' : 'Calls'}:</span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span className="text-[10px] text-red-600 font-medium">SELL</span>
            <span className="text-xs font-semibold text-gray-900">{formatCurrency(shortStrike)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span className="text-[10px] text-green-600 font-medium">BUY</span>
            <span className="text-xs font-semibold text-gray-900">{formatCurrency(longStrike)}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW: PROFIT SIDE | RISK SIDE (Compact)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200">
        {/* PROFIT SIDE */}
        <div className="bg-green-50 px-2.5 py-2">
          <div className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-green-200">
            Profit Side
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Credit:</span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(creditDisplay)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">ROR:</span>
              <span className="text-sm font-bold text-green-700">{rorPct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">POP:</span>
              <span className="text-sm font-semibold text-green-700">{probProfit ? `${(probProfit * 100).toFixed(0)}%` : '-'}</span>
            </div>
          </div>
        </div>
        {/* RISK SIDE */}
        <div className="bg-red-50 px-2.5 py-2">
          <div className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-red-200">
            Risk Side
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Max Risk:</span>
              <span className="text-lg font-bold text-red-700">{formatCurrency(lossDisplay)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">R:R:</span>
              <span className="text-sm font-bold text-red-700">{riskRewardRatio}:1</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Loss:</span>
              <span className="text-sm font-semibold text-red-700">{probProfit ? `${((1 - probProfit) * 100).toFixed(0)}%` : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ANALYSIS ZONE: Compact Single Row (Breakeven + Distances)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-gray-200 px-2.5 py-1.5 bg-blue-50">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-600">BE: <span className="font-semibold text-blue-700">{formatCurrency(breakeven)}</span></span>
          {expectedValue !== null && (
            <span className="text-gray-600">EV: <span className={`font-semibold ${expectedValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>{expectedValue >= 0 ? '+' : ''}{formatCurrency(expectedValue)}</span></span>
          )}
          <span className="text-gray-600">Dist: <span className={`font-semibold ${(distToShortDisplay ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{distToShortDisplay !== null ? `${distToShortDisplay >= 0 ? '+' : ''}${distToShortDisplay.toFixed(1)}%` : '-'}</span></span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER: Greeks (Compact)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-2.5 py-1.5 bg-gray-50">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            {ivp !== undefined && <span className="text-gray-500">IV: <span className="font-semibold text-gray-800">{ivp.toFixed(0)}%</span></span>}
            {shortDelta !== undefined && <span className="text-gray-500">Delta: <span className="font-semibold text-gray-800">{shortDelta.toFixed(2)}</span></span>}
            {netTheta !== undefined && netTheta !== 0 && (
              <span className="text-gray-500">Theta: <span className={`font-semibold ${netTheta > 0 ? 'text-green-600' : 'text-red-600'}`}>{netTheta > 0 ? '+' : ''}${(netTheta * 100).toFixed(0)}/d</span></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Chain Analysis Summary - displays selected option info from chain analysis page
function ChainAnalysisSummary({ metadata }: ContractSummaryProps) {
  // Extract data from metadata
  const symbol = metadata.symbol as string || '-';
  const underlyingPrice = metadata.underlyingPrice as number;
  const expiration = metadata.expiration as string || '-';
  const dte = metadata.dte as number;
  const selectedOption = metadata.selectedOption as Record<string, unknown> | undefined;
  const optionType = metadata.optionType as string || selectedOption?.optionType as string || '-';
  const breakeven = metadata.breakeven as number | undefined;
  const maxLoss = metadata.maxLoss as number | undefined;
  const totalCallPremium = metadata.totalCallPremium as number | undefined;
  const totalPutPremium = metadata.totalPutPremium as number | undefined;
  const callOiData = metadata.callOiData as Array<{ strike: number; openInterest: number }> | undefined;
  const putOiData = metadata.putOiData as Array<{ strike: number; openInterest: number }> | undefined;

  // Extract option-specific data
  const strike = selectedOption?.strike as number | undefined;
  const lastPrice = selectedOption?.lastPrice as number | undefined;
  const bid = selectedOption?.bid as number | undefined;
  const ask = selectedOption?.ask as number | undefined;
  const volume = selectedOption?.volume as number | undefined;
  const openInterest = selectedOption?.openInterest as number | undefined;
  const impliedVolatility = selectedOption?.impliedVolatility as number | undefined;
  const delta = selectedOption?.delta as number | undefined;
  const gamma = selectedOption?.gamma as number | undefined;
  const theta = selectedOption?.theta as number | undefined;
  const vega = selectedOption?.vega as number | undefined;

  // Format IV for display (handle decimal vs percentage)
  const ivDisplay = impliedVolatility !== undefined
    ? (impliedVolatility < 1 ? (impliedVolatility * 100).toFixed(1) : impliedVolatility.toFixed(1))
    : undefined;

  // Determine badge styling based on option type
  const isCall = optionType === 'call';
  const badgeColor = isCall ? 'bg-green-600' : 'bg-red-600';
  const badgeLabel = isCall ? 'Call Option' : 'Put Option';
  const gradientFrom = isCall ? 'from-green-50' : 'from-red-50';
  const gradientTo = isCall ? 'to-emerald-50' : 'to-rose-50';

  // Determine moneyness
  const getMoneynessBadge = () => {
    if (!underlyingPrice || !strike) return { label: '-', color: 'bg-gray-100 text-gray-600' };
    const moneyness = isCall
      ? ((underlyingPrice - strike) / strike) * 100
      : ((strike - underlyingPrice) / strike) * 100;
    if (moneyness > 15) return { label: 'Deep ITM', color: 'bg-emerald-100 text-emerald-700' };
    if (moneyness > 5) return { label: 'ITM', color: 'bg-green-100 text-green-700' };
    if (moneyness > -5) return { label: 'ATM', color: 'bg-yellow-100 text-yellow-700' };
    if (moneyness > -15) return { label: 'OTM', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Deep OTM', color: 'bg-red-100 text-red-700' };
  };
  const moneyness = getMoneynessBadge();

  if (!selectedOption) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 shadow-sm mb-4 p-4 text-center">
        <p className="text-gray-500">Select an option from the chain to view details</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-300 shadow-sm mb-4 overflow-hidden">
      {/* HEADER: Symbol + Option Type Badge + Underlying Price */}
      <div className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} px-4 py-3 border-b border-gray-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">{symbol}</span>
            <span className={`text-[11px] ${badgeColor} text-white px-2.5 py-1 rounded-full font-semibold tracking-wide`}>
              {badgeLabel}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Underlying</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(underlyingPrice)}</div>
          </div>
        </div>
      </div>

      {/* SUB-HEADER BAR: Exp | DTE | Strike */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Exp</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{expiration}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">DTE</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{dte ?? '-'}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Strike</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{formatCurrency(strike)}</div>
        </div>
      </div>

      {/* OPTION INFO: Strike + Moneyness + Breakeven */}
      <div className="border-b border-gray-200 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isCall ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className={`text-[11px] ${isCall ? 'text-green-600' : 'text-red-600'} font-semibold uppercase`}>
              {isCall ? 'CALL' : 'PUT'}
            </span>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(strike)} {isCall ? 'C' : 'P'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${moneyness.color}`}>
              {moneyness.label}
            </span>
          </div>
          <div className="flex items-center text-[11px] text-gray-600">
            <span>BE:</span>
            <InfoTooltip content={TOOLTIP_CONTENT.breakeven(isCall)} position="left" />
            <span className="font-semibold text-amber-700 ml-0.5">{breakeven ? formatCurrency(breakeven) : '-'}</span>
          </div>
        </div>
      </div>

      {/* PRICING & VOLUME */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200">
        {/* PRICING SIDE */}
        <div className={`${isCall ? 'bg-green-50' : 'bg-red-50'} px-2.5 py-2`}>
          <div className={`text-[10px] ${isCall ? 'text-green-700' : 'text-red-700'} font-bold uppercase tracking-wide mb-1.5 pb-1 border-b ${isCall ? 'border-green-200' : 'border-red-200'}`}>
            Option Pricing
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Last:</span>
              <span className={`text-lg font-bold ${isCall ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(lastPrice)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Bid:</span>
              <span className="text-sm font-semibold text-gray-700">{formatCurrency(bid)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Ask:</span>
              <span className="text-sm font-semibold text-gray-700">{formatCurrency(ask)}</span>
            </div>
          </div>
        </div>
        {/* VOLUME SIDE */}
        <div className="bg-blue-50 px-2.5 py-2">
          <div className="text-[10px] text-blue-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-blue-200">
            Activity
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Volume:</span>
              <span className="text-lg font-bold text-blue-700">{volume?.toLocaleString() ?? '-'}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600 flex items-center">
                Open Int:
                <InfoTooltip content={TOOLTIP_CONTENT.openInterest} position="left" />
              </span>
              <span className="text-sm font-bold text-blue-700">{openInterest?.toLocaleString() ?? '-'}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600 flex items-center">
                IV:
                <InfoTooltip content={TOOLTIP_CONTENT.iv} position="left" />
              </span>
              <span className="text-sm font-semibold text-blue-700">{ivDisplay !== undefined ? `${ivDisplay}%` : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GREEKS */}
      <div className="border-b border-gray-200 px-2.5 py-2 bg-purple-50">
        <div className="text-[10px] text-purple-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-purple-200">
          Greeks
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-[10px] text-gray-500 flex items-center justify-center">
              Delta
              <InfoTooltip content={TOOLTIP_CONTENT.delta(isCall)} position="top" />
            </div>
            <div className="text-sm font-bold text-purple-700">{delta?.toFixed(3) ?? '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-gray-500 flex items-center justify-center">
              Gamma
              <InfoTooltip content={TOOLTIP_CONTENT.gamma} position="top" />
            </div>
            <div className="text-sm font-bold text-purple-700">{gamma?.toFixed(4) ?? '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-gray-500 flex items-center justify-center">
              Theta
              <InfoTooltip content={TOOLTIP_CONTENT.theta} position="top" />
            </div>
            <div className="text-sm font-bold text-purple-700">{theta?.toFixed(4) ?? '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-gray-500 flex items-center justify-center">
              Vega
              <InfoTooltip content={TOOLTIP_CONTENT.vega} position="top" />
            </div>
            <div className="text-sm font-bold text-purple-700">{vega?.toFixed(4) ?? '-'}</div>
          </div>
        </div>
      </div>

      {/* PREMIUM & OPEN INTEREST ANALYSIS - Unified Section */}
      {(() => {
        const oiData = isCall ? callOiData : putOiData;
        const maxOi = oiData && oiData.length > 0 ? Math.max(...oiData.map(d => d.openInterest)) : 0;
        const selectedStrike = strike;
        const barColor = isCall ? '#22c55e' : '#ef4444';
        const selectedBarColor = isCall ? '#15803d' : '#b91c1c';
        const histogramHeight = oiData ? Math.min(Math.max(oiData.length * 10, 70), 160) : 0;

        // Find selected strike's OI for enhanced tooltip
        const selectedOi = oiData?.find(d => d.strike === selectedStrike)?.openInterest || 0;
        const selectedOiRank = oiData ? oiData.filter(d => d.openInterest > selectedOi).length + 1 : 0;

        return (
          <div className="bg-gradient-to-b from-slate-50 to-indigo-50/50">
            {/* Section Header */}
            <div className="px-2.5 pt-2 pb-1">
              <div className="text-[10px] text-slate-700 font-bold uppercase tracking-wide">
                Market Activity - {symbol} {formatExpirationDate(expiration)}
              </div>
            </div>

            {/* Premium Data Row */}
            <div className="px-2.5 py-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-600 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                  Call:
                  <InfoTooltip content={TOOLTIP_CONTENT.totalCallPremium} position="right" />
                  <span className="font-semibold text-green-600 ml-1">{totalCallPremium ? formatCurrency(totalCallPremium) : '-'}</span>
                </span>
                <span className="text-gray-600 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1"></span>
                  Put:
                  <InfoTooltip content={TOOLTIP_CONTENT.totalPutPremium} position="left" />
                  <span className="font-semibold text-red-600 ml-1">{totalPutPremium ? formatCurrency(totalPutPremium) : '-'}</span>
                </span>
              </div>

              {/* Compact Premium Comparison */}
              {totalCallPremium !== undefined && totalPutPremium !== undefined && (totalCallPremium > 0 || totalPutPremium > 0) && (
                <div className="mt-1 text-[10px] text-center">
                  {totalCallPremium > totalPutPremium ? (
                    <span className="text-green-600">
                      Calls +{formatCurrency(totalCallPremium - totalPutPremium)} ({((totalCallPremium - totalPutPremium) / totalPutPremium * 100).toFixed(0)}% higher)
                    </span>
                  ) : totalPutPremium > totalCallPremium ? (
                    <span className="text-red-600">
                      Puts +{formatCurrency(totalPutPremium - totalCallPremium)} ({((totalPutPremium - totalCallPremium) / totalCallPremium * 100).toFixed(0)}% higher)
                    </span>
                  ) : (
                    <span className="text-gray-500">Premiums equal</span>
                  )}
                </div>
              )}
            </div>

            {/* OI Histogram */}
            {oiData && oiData.length > 0 && (
              <>
                {/* Histogram Label with Max OI */}
                <div className="px-2.5 pt-1 flex items-center justify-between">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">
                    {isCall ? 'Call' : 'Put'} OI Distribution
                  </span>
                  <span className="text-[9px] text-gray-500">
                    Max: <span className="font-semibold text-gray-700">{maxOi.toLocaleString()}</span>
                  </span>
                </div>

                {/* Histogram */}
                <div className="px-2.5 py-1">
                  <div className="relative overflow-x-auto rounded" style={{ height: `${histogramHeight}px` }}>
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 400 ${histogramHeight}`}
                      preserveAspectRatio="none"
                      className="block"
                    >
                      {/* Background grid lines */}
                      {[0.25, 0.5, 0.75].map(pct => (
                        <line
                          key={pct}
                          x1="0"
                          y1={histogramHeight - 16 - (histogramHeight - 24) * pct}
                          x2="400"
                          y2={histogramHeight - 16 - (histogramHeight - 24) * pct}
                          stroke="#e5e7eb"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                        />
                      ))}

                      {oiData.map((item, index) => {
                        const barHeight = maxOi > 0 ? (item.openInterest / maxOi) * (histogramHeight - 24) : 0;
                        const barWidth = Math.max(400 / oiData.length - 1.5, 3);
                        const x = (index / oiData.length) * 400 + 0.75;
                        const y = histogramHeight - 16 - barHeight;
                        const isSelected = selectedStrike === item.strike;
                        const oiPctOfMax = maxOi > 0 ? ((item.openInterest / maxOi) * 100).toFixed(1) : 0;

                        return (
                          <g key={item.strike}>
                            {/* Selection highlight background */}
                            {isSelected && (
                              <rect
                                x={x - 1}
                                y={0}
                                width={barWidth + 2}
                                height={histogramHeight}
                                fill={isCall ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
                              />
                            )}
                            {/* Bar */}
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={Math.max(barHeight, 1)}
                              fill={isSelected ? selectedBarColor : barColor}
                              opacity={isSelected ? 1 : 0.65}
                              rx={0.5}
                              className="transition-all duration-150 hover:opacity-100 cursor-pointer"
                            >
                              <title>{`Strike: $${item.strike.toLocaleString()}\nOpen Interest: ${item.openInterest.toLocaleString()}\n${oiPctOfMax}% of max OI${isSelected ? '\n★ Currently Selected' : ''}`}</title>
                            </rect>
                            {/* Strike label */}
                            {(index % Math.ceil(oiData.length / 7) === 0 || isSelected) && (
                              <text
                                x={x + barWidth / 2}
                                y={histogramHeight - 3}
                                textAnchor="middle"
                                fontSize="7"
                                fontWeight={isSelected ? 'bold' : 'normal'}
                                fill={isSelected ? selectedBarColor : '#9ca3af'}
                              >
                                {item.strike}
                              </text>
                            )}
                            {/* Selected indicator dot */}
                            {isSelected && barHeight > 8 && (
                              <circle
                                cx={x + barWidth / 2}
                                cy={y - 4}
                                r={2.5}
                                fill={selectedBarColor}
                                stroke="white"
                                strokeWidth="1"
                              />
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Compact Legend & Selected Info */}
                <div className="px-2.5 pb-2 flex items-center justify-between text-[9px] text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-sm ${isCall ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      OI
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-sm ${isCall ? 'bg-green-800' : 'bg-red-800'}`}></span>
                      Selected
                    </span>
                  </div>
                  {selectedStrike && (
                    <span className="text-gray-600">
                      ${selectedStrike}: <span className="font-semibold">{selectedOi.toLocaleString()}</span> OI
                      {selectedOiRank <= 3 && <span className="ml-1 text-amber-600">(#{selectedOiRank})</span>}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// Iron Condor Summary - displays iron condor info at the top of AI panel
function IronCondorSummary({ metadata }: ContractSummaryProps) {
  const symbol = metadata.symbol as string || '-';
  const underlyingPrice = metadata.underlyingPrice as number;
  const expiration = metadata.expiration as string || '-';
  const dte = metadata.dte as number;
  const width = metadata.width as number;
  const shortPutStrike = metadata.shortPutStrike as number;
  const longPutStrike = metadata.longPutStrike as number;
  const shortCallStrike = metadata.shortCallStrike as number;
  const longCallStrike = metadata.longCallStrike as number;
  const netCredit = metadata.netCredit as number;
  const maxLoss = metadata.maxLoss as number;
  const lowerBreakeven = metadata.lowerBreakeven as number;
  const upperBreakeven = metadata.upperBreakeven as number;
  // Risk/Reward metrics
  const ror = metadata.ror as number | undefined;
  // Risk/Reward = MaxLoss / Credit (e.g., $239 / $61 = 3.9 : 1)
  const riskRewardRatio = netCredit > 0 ? maxLoss / netCredit : undefined;
  const probProfit = metadata.probProfit as number | undefined;
  const probLoss = metadata.probLoss as number | undefined;
  // Greeks
  const shortPutDelta = metadata.shortPutDelta as number | undefined;
  const shortCallDelta = metadata.shortCallDelta as number | undefined;
  // IV metrics
  const ivp = metadata.ivp as number | undefined;
  // Distance metrics
  const distToShortPut = metadata.distToShortPut as number | undefined;
  const distToShortCall = metadata.distToShortCall as number | undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-300 shadow-sm mb-4 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER: Symbol + Iron Condor Badge
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">{symbol}</span>
            <span className="text-[11px] bg-purple-600 text-white px-2.5 py-1 rounded-full font-semibold tracking-wide">
              Iron Condor
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Underlying</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(underlyingPrice)}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 1: Exp | DTE | Width
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Exp</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{expiration}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">DTE</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">{dte ?? '-'}</div>
        </div>
        <div className="px-4 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Width</div>
          <div className="text-sm font-semibold text-gray-800 mt-0.5">${width?.toFixed(0) || '-'}</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LEGS: Clean Two-Column Text Layout
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200">
        {/* Put Spread */}
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Put Spread</div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-red-600 font-medium">Sell</span>
              <span className="font-semibold text-gray-900">{formatCurrency(shortPutStrike)} P</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green-600 font-medium">Buy</span>
              <span className="font-semibold text-gray-900">{formatCurrency(longPutStrike)} P</span>
            </div>
          </div>
        </div>
        {/* Call Spread */}
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Call Spread</div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-red-600 font-medium">Sell</span>
              <span className="font-semibold text-gray-900">{formatCurrency(shortCallStrike)} C</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green-600 font-medium">Buy</span>
              <span className="font-semibold text-gray-900">{formatCurrency(longCallStrike)} C</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW: PROFIT SIDE | RISK SIDE (Compact)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200">
        {/* PROFIT SIDE */}
        <div className="bg-green-50 px-2.5 py-2">
          <div className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-green-200">
            Profit Side
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Credit:</span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(netCredit)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">ROR:</span>
              <span className="text-sm font-bold text-green-700">{ror !== undefined ? `${(ror * 100).toFixed(1)}%` : '-'}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">POP:</span>
              <span className="text-sm font-semibold text-green-700">{probProfit !== undefined ? `${(probProfit * 100).toFixed(0)}%` : '-'}</span>
            </div>
          </div>
        </div>
        {/* RISK SIDE */}
        <div className="bg-red-50 px-2.5 py-2">
          <div className="text-[10px] text-red-700 font-bold uppercase tracking-wide mb-1.5 pb-1 border-b border-red-200">
            Risk Side
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Max Risk:</span>
              <span className="text-lg font-bold text-red-700">{formatCurrency(maxLoss)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Risk/Reward:</span>
              <span className="text-sm font-bold text-red-700">{riskRewardRatio !== undefined ? `${riskRewardRatio.toFixed(1)}:1` : '-'}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-gray-600">Loss Prob:</span>
              <span className="text-sm font-semibold text-red-700">{probLoss !== undefined ? `${(probLoss * 100).toFixed(0)}%` : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ANALYSIS ZONE: Compact Single Row (Breakevens + Distances)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-gray-200 px-2.5 py-1.5 bg-blue-50">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-600">BE: <span className="font-semibold text-blue-700">{formatCurrency(lowerBreakeven)}</span> / <span className="font-semibold text-blue-700">{formatCurrency(upperBreakeven)}</span></span>
          <span className="text-gray-600">Dist: <span className="font-semibold text-red-600">{distToShortPut !== undefined ? `-${(Math.abs(distToShortPut) * 100).toFixed(1)}%` : '-'}</span> / <span className="font-semibold text-green-600">{distToShortCall !== undefined ? `+${(Math.abs(distToShortCall) * 100).toFixed(1)}%` : '-'}</span></span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER: Greeks (Compact)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-2.5 py-1.5 bg-gray-50">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            {ivp !== undefined && <span className="text-gray-500">IV: <span className="font-semibold text-gray-800">{ivp.toFixed(0)}%</span></span>}
            {shortPutDelta !== undefined && <span className="text-gray-500">Δp: <span className="font-semibold text-gray-800">{shortPutDelta.toFixed(2)}</span></span>}
            {shortCallDelta !== undefined && <span className="text-gray-500">Δc: <span className="font-semibold text-gray-800">{shortCallDelta.toFixed(2)}</span></span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactSummary({ content }: { content: AiExplainerContent }) {
  return (
    <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-3 border border-primary-100">
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">🤖</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 line-clamp-2">{content.summary}</p>
          {content.keyInsights && content.keyInsights.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {content.keyInsights.slice(0, 3).map((insight, i) => (
                <QuickInsightBadge key={i} insight={insight} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StandardInsights({ content }: { content: AiExplainerContent }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Strategy Name */}
        {content.strategyName && (
          <div className="text-sm text-primary-700 font-medium">
            {content.strategyName}
          </div>
        )}
        {/* Summary */}
        <p className="text-sm text-gray-700">{content.summary}</p>

        {/* Key Metrics Grid */}
        {content.keyMetrics && (
          <div className="grid grid-cols-2 gap-3">
            {content.keyMetrics.maxProfit && (
              <MetricCard
                label="Max Profit"
                value={content.keyMetrics.maxProfit.value}
                subtext={content.keyMetrics.maxProfit.condition}
                variant="positive"
              />
            )}
            {content.keyMetrics.maxLoss && (
              <MetricCard
                label="Max Loss"
                value={content.keyMetrics.maxLoss.value}
                subtext={content.keyMetrics.maxLoss.condition}
                variant="negative"
              />
            )}
          </div>
        )}

        {/* Quick Insights */}
        {content.keyInsights && content.keyInsights.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {content.keyInsights.map((insight, i) => (
              <QuickInsightBadge key={i} insight={insight} />
            ))}
          </div>
        )}

        {/* Risk Warning (if high severity) */}
        {content.risks && content.risks.some(r => r.severity === 'high') && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-red-500">⚠️</span>
              <div className="text-sm text-red-800">
                {content.risks.find(r => r.severity === 'high')?.risk}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailedInsights({ content, sections }: { content: AiExplainerContent; sections?: string[] }) {
  const showSection = (name: string) => !sections || sections.includes(name);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 space-y-6">
        {/* Summary Section */}
        {showSection('summary') && (
          <div>
            {content.strategyName && (
              <h3 className="font-bold text-primary-700 mb-2">{content.strategyName}</h3>
            )}
            <p className="text-gray-700">{content.summary}</p>
          </div>
        )}

        {/* Metrics Section */}
        {showSection('metrics') && content.keyMetrics && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              📊 Key Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {content.keyMetrics.maxProfit && (
                <MetricCard
                  label="Max Profit"
                  value={content.keyMetrics.maxProfit.value}
                  subtext={content.keyMetrics.maxProfit.condition}
                  variant="positive"
                />
              )}
              {content.keyMetrics.maxLoss && (
                <MetricCard
                  label="Max Loss"
                  value={content.keyMetrics.maxLoss.value}
                  subtext={content.keyMetrics.maxLoss.condition}
                  variant="negative"
                />
              )}
            </div>
          </div>
        )}

        {/* Trade Mechanics (for spreads) */}
        {content.tradeMechanics && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              📋 Trade Mechanics
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 text-xs">Structure</span>
                <div className="font-medium">{content.tradeMechanics.structure}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 text-xs">Credit</span>
                <div className="font-medium text-green-600">{content.tradeMechanics.creditReceived}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 text-xs">Margin</span>
                <div className="font-medium">{content.tradeMechanics.marginRequirement}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 text-xs">Breakeven</span>
                <div className="font-medium">{content.tradeMechanics.breakeven || content.tradeMechanics.breakevens}</div>
              </div>
            </div>
          </div>
        )}

        {/* Insights Section */}
        {showSection('insights') && content.keyInsights && content.keyInsights.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              💡 Key Insights
            </h4>
            <div className="space-y-2">
              {content.keyInsights.map((insight, i) => {
                const bgColors = {
                  positive: 'bg-green-50 border-l-green-500',
                  neutral: 'bg-gray-50 border-l-gray-400',
                  negative: 'bg-red-50 border-l-red-500',
                };
                const action = getActionForInsight(insight.title);

                const insightCard = (
                  <div className={`border-l-4 p-3 rounded-r-lg ${bgColors[insight.sentiment]} ${action ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {insight.title}
                      {action && <span className="text-xs text-gray-400">🤖</span>}
                    </div>
                    <div className="text-sm text-gray-600">{insight.description}</div>
                  </div>
                );

                // Wrap with HoverAI if we have an action for this insight
                if (action) {
                  return (
                    <HoverAI
                      key={i}
                      action={action}
                      metadata={{ insightTitle: insight.title, insightDescription: insight.description }}
                    >
                      {insightCard}
                    </HoverAI>
                  );
                }

                return <div key={i}>{insightCard}</div>;
              })}
            </div>
          </div>
        )}

        {/* Scenarios Section (LEAPS) */}
        {showSection('scenarios') && content.scenarios && (content.scenarios.mediumIncrease || content.scenarios.strongIncrease) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              📈 Price Scenarios
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {content.scenarios.mediumIncrease && (
                <ScenarioCard title="Medium Growth" scenario={content.scenarios.mediumIncrease} />
              )}
              {content.scenarios.strongIncrease && (
                <ScenarioCard title="Strong Growth" scenario={content.scenarios.strongIncrease} />
              )}
            </div>
          </div>
        )}

        {/* Risks Section (limited to 3) */}
        {showSection('risks') && content.risks && content.risks.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              ⚠️ Risk Factors
            </h4>
            <div className="space-y-2">
              {content.risks.slice(0, 3).map((risk, i) => {
                const severityStyles = {
                  low: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                  medium: 'bg-orange-50 text-orange-800 border-orange-200',
                  high: 'bg-red-50 text-red-800 border-red-200',
                };
                return (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded border ${severityStyles[risk.severity]}`}>
                    <span className="text-xs font-bold uppercase">{risk.severity}</span>
                    <span className="text-sm">{risk.risk}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Watch Items Section */}
        {showSection('watchItems') && content.watchItems && content.watchItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              👁️ Watch Items
            </h4>
            <div className="space-y-2">
              {content.watchItems.map((watchItem, i) => (
                <div key={i} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="font-medium text-sm text-purple-800">{watchItem.item}</div>
                  {watchItem.trigger && (
                    <div className="text-xs text-purple-600 mt-1">Trigger: {watchItem.trigger}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-gray-500 border-t pt-3 mt-4">
          ℹ️ {content.disclaimer}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

type TabId = 'insights' | 'battle';

export function InlineAiInsights({
  size = 'standard',
  autoAnalyze = false,
  className = '',
  sections,
}: InlineAiInsightsProps) {
  const { isLoading, error, result, analyze } = useAiExplainer();
  const { currentMetadata, currentPage } = useOptionChain();
  const lastMetadataRef = useRef<unknown>(null);
  const hasAutoAnalyzed = useRef(false);
  const [activeTab, setActiveTab] = useState<TabId>('insights');

  // Determine which micro-actions to show based on page type
  const getMicroActions = (): MicroActionType[] => {
    switch (currentPage) {
      case 'leaps_ranker':
        return LEAPS_ACTIONS;
      case 'credit_spread_screener':
        return CREDIT_SPREAD_ACTIONS;
      case 'iron_condor_screener':
        return IRON_CONDOR_ACTIONS;
      default:
        return LEAPS_ACTIONS;
    }
  };

  // Auto-analyze when metadata changes (if enabled)
  useEffect(() => {
    if (!autoAnalyze || !currentMetadata) return;

    // Create a simple hash of metadata to detect changes
    const metadataHash = JSON.stringify(currentMetadata);
    if (metadataHash === lastMetadataRef.current) return;
    lastMetadataRef.current = metadataHash;

    // Only auto-analyze once per metadata change, with a small delay
    if (!hasAutoAnalyzed.current) {
      hasAutoAnalyzed.current = true;
      const timer = setTimeout(() => {
        analyze();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoAnalyze, currentMetadata, analyze]);

  // Reset auto-analyze flag when metadata changes significantly
  useEffect(() => {
    hasAutoAnalyzed.current = false;
  }, [currentMetadata]);

  // Don't render if no metadata
  if (!currentMetadata) {
    return null;
  }

  // Sanitize and render result (if available)
  const content = result ? sanitizeAiResponse(result) as AiExplainerContent : null;

  // Check if we're on LEAPS page (battle mode only available for LEAPS)
  const showBattleMode = currentPage === 'leaps_ranker' || !currentPage;

  // Render AI Insights tab content based on state
  const renderInsightsContent = () => {
    // Loading state
    if (isLoading) {
      return <InlineLoadingState size={size} />;
    }

    // Error state
    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <span>⚠️</span>
            <span>AI analysis unavailable</span>
            <button
              onClick={analyze}
              className="ml-auto text-xs text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // No result yet - show micro-actions and analyze prompt
    if (!content) {
      return (
        <div className="space-y-3">
          {/* Smart Tiles Actions Grid (Compact) */}
          <MicroActionsGroup actions={getMicroActions()} />

          {/* ═══════════════════════════════════════════════════════════════════
              CTA FOOTER ZONE: Primary Action Button
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="pt-3 mt-1 border-t border-gray-200/60">
            <button
              onClick={analyze}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl py-3 px-4 transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-center gap-2.5">
                <span className="text-lg animate-pulse">🤖</span>
                <span className="font-semibold tracking-wide">Get Full AI Analysis</span>
              </div>
            </button>
          </div>
        </div>
      );
    }

    // Has result - show full insights
    return (
      <>
        {/* Smart Tiles Actions Grid (Compact) */}
        <MicroActionsGroup actions={getMicroActions()} />

        {/* AI Insight - Generated analysis results */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-primary-50 to-blue-50 border-b border-primary-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">💡</span>
                <span className="text-xs font-medium text-primary-700 uppercase tracking-wide">AI Insight</span>
              </div>
              <button
                onClick={analyze}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
              >
                <span>↻</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>
          <div className="p-3">
            {size === 'compact' && <CompactSummary content={content} />}
            {size === 'standard' && <StandardInsights content={content} />}
            {size === 'detailed' && <DetailedInsights content={content} sections={sections} />}
          </div>
        </div>
      </>
    );
  };

  // Render the appropriate summary component based on page type
  const renderSummary = () => {
    if (!currentMetadata) return null;
    const metadata = currentMetadata as unknown as Record<string, unknown>;

    switch (currentPage) {
      case 'credit_spread_screener':
        return <CreditSpreadSummary metadata={metadata} />;
      case 'iron_condor_screener':
        return <IronCondorSummary metadata={metadata} />;
      case 'chain_analysis':
        return <ChainAnalysisSummary metadata={metadata} />;
      case 'leaps_ranker':
      default:
        return <LeapsSummary metadata={metadata} />;
    }
  };

  return (
    <div className={`${className} space-y-4`}>
      {/* Contract/Trade Summary - shows basic info at top */}
      {currentMetadata && renderSummary()}

      {/* Tab Navigation - only show for LEAPS (battle mode) */}
      {showBattleMode && (
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'insights'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <span>💡</span>
              <span>AI Insights</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('battle')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === 'battle'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <span>⚔️</span>
              <span>Battle Mode</span>
            </span>
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'insights' ? (
        <div className="space-y-4">
          {renderInsightsContent()}
        </div>
      ) : (
        /* Battle Mode - Contract Comparison */
        <BattleModeComparison />
      )}
    </div>
  );
}

export default InlineAiInsights;
