'use client';

/**
 * Credit Spreads Page - Native UI with Direct API Calls
 *
 * Allows users to screen for credit spread opportunities (PCS/CCS)
 * with customizable parameters and AI-powered analysis.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useOptionChain } from '@/contexts';
import { Navigation } from '@/components';
import { InlineAiInsights } from '@/components/ai';
import {
  CreditSpreadMetadata,
  createCreditSpreadContext,
} from '@/types';

// =============================================================================
// Types
// =============================================================================

interface CreditSpreadResult {
  symbol: string;
  spread_type: 'PCS' | 'CCS';
  expiration: string;
  dte: number;
  short_strike: number;
  long_strike: number;
  width: number;
  credit: number;
  max_loss: number;
  roc: number;
  short_delta: number;
  delta_estimated: boolean;
  prob_profit: number;
  iv: number;
  ivp: number;
  underlying_price: number;
  break_even: number;
  break_even_distance_pct: number;
  liquidity_score: number;
  slippage_score: number;
  total_score: number;
}

interface CreditSpreadResponse {
  symbol: string;
  underlying_price: number;
  ivp: number;
  spread_type_filter: string;
  total_pcs: number;
  total_ccs: number;
  spreads: CreditSpreadResult[];
  timestamp: string;
}

type SpreadTypeFilter = 'ALL' | 'PCS' | 'CCS';

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (val: number | undefined) =>
  val !== undefined
    ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '-';

const formatPercent = (val: number | undefined, decimals = 1) =>
  val !== undefined ? `${(val * 100).toFixed(decimals)}%` : '-';

const formatNumber = (val: number | undefined, decimals = 2) =>
  val !== undefined ? val.toFixed(decimals) : '-';

const formatTimestamp = (isoString: string) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

// =============================================================================
// Components
// =============================================================================

// Tooltip Component
function Tooltip({ text, position = 'below' }: { text: string; position?: 'above' | 'below' }) {
  const isBelow = position === 'below';
  return (
    <div className="group relative inline-block ml-1">
      <span className="cursor-help text-gray-400 hover:text-gray-600 text-xs">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 inline"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <div className={`invisible group-hover:visible absolute z-50 w-64 p-2 text-xs text-white bg-gray-800 rounded-md shadow-lg -left-28 ${isBelow ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
        {text}
        <div className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent ${isBelow ? 'bottom-full border-b-4 border-b-gray-800' : 'top-full border-t-4 border-t-gray-800'}`}></div>
      </div>
    </div>
  );
}

// Ticker Dropdown Component
function TickerDropdown({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  const tickers = ['SPY', 'QQQ'];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">Ticker</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 px-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {tickers.map((ticker) => (
          <option key={ticker} value={ticker}>{ticker}</option>
        ))}
      </select>
    </div>
  );
}

// Compact Range Input Component
function CompactRangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  min,
  max,
  step = 1,
  tooltip,
}: {
  label: string;
  minValue: number;
  maxValue: number;
  onMinChange: (val: number) => void;
  onMaxChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center h-4">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">{label}</label>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={minValue}
          onChange={(e) => onMinChange(Number(e.target.value))}
          min={min}
          max={maxValue - step}
          step={step}
          className="w-14 h-9 px-1 border border-gray-300 rounded-md text-sm text-center"
        />
        <span className="text-gray-400 text-xs">-</span>
        <input
          type="number"
          value={maxValue}
          onChange={(e) => onMaxChange(Number(e.target.value))}
          min={minValue + step}
          max={max}
          step={step}
          className="w-14 h-9 px-1 border border-gray-300 rounded-md text-sm text-center"
        />
      </div>
    </div>
  );
}

// Compact Single Value Input Component
function CompactValueInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center h-4">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">{label}</label>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-16 h-9 px-2 border border-gray-300 rounded-md text-sm text-center"
        />
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

// Spread Type Dropdown Component
function SpreadTypeDropdown({
  value,
  onChange,
  pcsCount,
  ccsCount,
}: {
  value: SpreadTypeFilter;
  onChange: (val: SpreadTypeFilter) => void;
  pcsCount: number;
  ccsCount: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">Spread Type</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SpreadTypeFilter)}
        className="h-9 px-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="PCS">Put Credit ({pcsCount})</option>
        <option value="CCS">Call Credit ({ccsCount})</option>
        <option value="ALL">All Spreads</option>
      </select>
    </div>
  );
}

// Spreads Table Component
function SpreadsTable({
  spreads,
  selectedSpread,
  onSelectSpread,
  isMobile,
}: {
  spreads: CreditSpreadResult[];
  selectedSpread?: CreditSpreadResult;
  onSelectSpread: (spread: CreditSpreadResult) => void;
  isMobile: boolean;
}) {
  const isSelected = (spread: CreditSpreadResult) =>
    selectedSpread &&
    spread.short_strike === selectedSpread.short_strike &&
    spread.long_strike === selectedSpread.long_strike &&
    spread.expiration === selectedSpread.expiration &&
    spread.spread_type === selectedSpread.spread_type;

  const getRowClass = (spread: CreditSpreadResult) => {
    const base = 'cursor-pointer transition-colors border-b';
    const isPCS = spread.spread_type === 'PCS';
    const selected = isSelected(spread);

    if (selected) {
      return `${base} ${isPCS ? 'bg-green-100' : 'bg-red-100'}`;
    }
    return `${base} hover:bg-gray-50`;
  };

  const getTypeColor = (type: 'PCS' | 'CCS') =>
    type === 'PCS' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50';

  // Mobile view - card-based layout
  if (isMobile) {
    return (
      <div className="max-h-[500px] overflow-y-auto px-2 py-2 space-y-2">
        {spreads.map((spread, idx) => {
          const isPCS = spread.spread_type === 'PCS';
          return (
            <div
              key={`${spread.expiration}-${spread.short_strike}-${spread.long_strike}-${idx}`}
              className={`p-3 rounded-lg border transition-all ${
                isSelected(spread)
                  ? isPCS ? 'bg-green-50 border-green-300 shadow-md' : 'bg-red-50 border-red-300 shadow-md'
                  : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
              }`}
              onClick={() => onSelectSpread(spread)}
            >
              {/* Header row: Type badge + Score */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getTypeColor(spread.spread_type)}`}>
                    {spread.spread_type}
                  </span>
                  <span className="text-sm text-gray-500">{spread.dte}d</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  spread.total_score >= 0.7 ? 'bg-green-100 text-green-700' :
                  spread.total_score >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  Score: {formatNumber(spread.total_score, 2)}
                </span>
              </div>
              {/* Strikes row */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-gray-900">
                  ${spread.short_strike} / ${spread.long_strike}
                </span>
                <span className="text-sm text-gray-500">Width: ${spread.width}</span>
              </div>
              {/* Credit & ROC row */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Credit:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(spread.credit)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">ROC:</span>
                  <span className="font-medium">{formatPercent(spread.roc)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">P(Profit):</span>
                  <span className="font-medium">{formatPercent(spread.prob_profit)}</span>
                </div>
              </div>
              {/* Expiration row */}
              <div className="mt-1.5 text-xs text-gray-500">
                Exp: {spread.expiration}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop view - full columns
  return (
    <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Expiration</th>
            <th className="px-3 py-2 text-right">DTE</th>
            <th className="px-3 py-2 text-right">Short</th>
            <th className="px-3 py-2 text-right">Long</th>
            <th className="px-3 py-2 text-right">Width</th>
            <th className="px-3 py-2 text-right">Credit</th>
            <th className="px-3 py-2 text-right">Max Loss</th>
            <th className="px-3 py-2 text-right">ROC</th>
            <th className="px-3 py-2 text-right">Delta</th>
            <th className="px-3 py-2 text-right">P(Profit)</th>
            <th className="px-3 py-2 text-right">BE Dist</th>
            <th className="px-3 py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {spreads.map((spread, idx) => (
            <tr
              key={`${spread.expiration}-${spread.short_strike}-${spread.long_strike}-${idx}`}
              className={getRowClass(spread)}
              onClick={() => onSelectSpread(spread)}
            >
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(spread.spread_type)}`}>
                  {spread.spread_type}
                </span>
              </td>
              <td className="px-3 py-2">{spread.expiration}</td>
              <td className="px-3 py-2 text-right">{spread.dte}</td>
              <td className="px-3 py-2 text-right font-medium">{formatCurrency(spread.short_strike)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(spread.long_strike)}</td>
              <td className="px-3 py-2 text-right">${spread.width}</td>
              <td className="px-3 py-2 text-right font-medium text-green-600">{formatCurrency(spread.credit)}</td>
              <td className="px-3 py-2 text-right text-red-600">{formatCurrency(spread.max_loss)}</td>
              <td className="px-3 py-2 text-right font-medium">{formatPercent(spread.roc)}</td>
              <td className="px-3 py-2 text-right">
                {formatNumber(spread.short_delta, 2)}
                {spread.delta_estimated && <span className="text-gray-400">*</span>}
              </td>
              <td className="px-3 py-2 text-right">{formatPercent(spread.prob_profit)}</td>
              <td className="px-3 py-2 text-right">{formatPercent(spread.break_even_distance_pct / 100)}</td>
              <td className="px-3 py-2 text-right">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  spread.total_score >= 0.7 ? 'bg-green-100 text-green-700' :
                  spread.total_score >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {formatNumber(spread.total_score, 2)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function CreditSpreadsPage() {
  // Filter state
  const [ticker, setTicker] = useState<string>('SPY');
  const [minDte, setMinDte] = useState(14);
  const [maxDte, setMaxDte] = useState(45);
  const [minDelta, setMinDelta] = useState(0.08);
  const [maxDelta, setMaxDelta] = useState(0.35);
  const [maxWidth, setMaxWidth] = useState(10);
  const [minRoc, setMinRoc] = useState(0.15);
  const [spreadTypeFilter, setSpreadTypeFilter] = useState<SpreadTypeFilter>('PCS');
  const [limit, setLimit] = useState(20);

  // Data state
  const [spreads, setSpreads] = useState<CreditSpreadResult[]>([]);
  const [underlyingPrice, setUnderlyingPrice] = useState(0);
  const [ivp, setIvp] = useState(0);
  const [totalPcs, setTotalPcs] = useState(0);
  const [totalCcs, setTotalCcs] = useState(0);
  const [timestamp, setTimestamp] = useState('');
  const [selectedSpread, setSelectedSpread] = useState<CreditSpreadResult | undefined>();
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Context
  const { setCurrentContext, clearContext, currentMetadata } = useOptionChain();

  // Responsive detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter spreads by type on client side and apply limit
  const filteredSpreads = useMemo(() => {
    const filtered = spreadTypeFilter === 'ALL' ? spreads : spreads.filter((s) => s.spread_type === spreadTypeFilter);
    return filtered.slice(0, limit);
  }, [spreads, spreadTypeFilter, limit]);

  // Fetch spreads from API
  const fetchSpreads = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    setSpreads([]);
    setSelectedSpread(undefined);
    clearContext();

    try {
      const response = await fetch('/api/credit-spreads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: ticker,
          min_dte: minDte,
          max_dte: maxDte,
          min_delta: minDelta,
          max_delta: maxDelta,
          max_width: maxWidth,
          min_roc: minRoc,
          spread_type: 'ALL', // Always fetch all, filter client-side
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch spreads');
      }

      const data: CreditSpreadResponse = await response.json();
      setSpreads(data.spreads);
      setUnderlyingPrice(data.underlying_price);
      setIvp(data.ivp);
      setTotalPcs(data.total_pcs);
      setTotalCcs(data.total_ccs);
      setTimestamp(data.timestamp);

      if (data.spreads.length === 0) {
        setError('No spreads found matching your criteria. Try adjusting filters.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch spreads');
    } finally {
      setIsLoading(false);
    }
  }, [ticker, minDte, maxDte, minDelta, maxDelta, maxWidth, minRoc, clearContext]);

  // Auto-fetch on mount with default parameters
  useEffect(() => {
    fetchSpreads();
  }, []); // Only on mount

  // Update context when spread is selected
  useEffect(() => {
    if (selectedSpread && underlyingPrice) {
      const metadata: CreditSpreadMetadata = {
        symbol: selectedSpread.symbol,
        underlyingPrice: underlyingPrice,
        spreadType: selectedSpread.spread_type,
        expiration: selectedSpread.expiration,
        dte: selectedSpread.dte,
        shortStrike: selectedSpread.short_strike,
        longStrike: selectedSpread.long_strike,
        width: selectedSpread.width,
        netCredit: selectedSpread.credit,
        maxLoss: selectedSpread.max_loss,
        maxGain: selectedSpread.credit * 100,
        breakeven: selectedSpread.break_even,
        breakevenPct: selectedSpread.break_even_distance_pct,
        shortDelta: selectedSpread.short_delta,
        probProfit: selectedSpread.prob_profit,
        iv: selectedSpread.iv,
        ivp: selectedSpread.ivp,
      };

      const context = createCreditSpreadContext(metadata);
      setCurrentContext(context.page, context.contextType, metadata);
      setShowAiPanel(true);
    }
  }, [selectedSpread, underlyingPrice, setCurrentContext]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <Navigation subtitle="Credit Spreads" />

      {/* Spacer using CSS variable for consistent header offset */}
      <div className="flex-shrink-0" style={{ height: 'var(--app-header-height)' }} />

      {/* Main layout wrapper - flex for side-by-side content and AI panel */}
      <div
        className="flex flex-1 min-h-0"
        style={{ height: 'calc(100vh - var(--app-header-height))' }}
      >
        {/* Main Content - shrinks when AI panel opens */}
        <div className={`h-full transition-all duration-300 ease-out overflow-auto min-w-0 ${showAiPanel && currentMetadata ? 'flex-1' : 'w-full'}`}>
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Controls Section - Single Row */}
            <div className="bg-white rounded-lg border shadow-sm p-3 mb-4">
              <div className="flex flex-wrap items-end gap-3">
                {/* Ticker Dropdown */}
                <TickerDropdown
                  value={ticker}
                  onChange={setTicker}
                  disabled={isLoading}
                />

                {/* Spread Type Dropdown */}
                <SpreadTypeDropdown
                  value={spreadTypeFilter}
                  onChange={setSpreadTypeFilter}
                  pcsCount={totalPcs}
                  ccsCount={totalCcs}
                />

                {/* DTE Range */}
                <CompactRangeInput
                  label="DTE"
                  minValue={minDte}
                  maxValue={maxDte}
                  onMinChange={setMinDte}
                  onMaxChange={setMaxDte}
                  min={7}
                  max={90}
                  tooltip="Days to Expiration. Shorter DTE means faster time decay (theta) but less time for the trade to work. Longer DTE gives more time but slower decay."
                />

                {/* Delta Range */}
                <CompactRangeInput
                  label="Delta"
                  minValue={minDelta}
                  maxValue={maxDelta}
                  onMinChange={setMinDelta}
                  onMaxChange={setMaxDelta}
                  min={0.05}
                  max={0.50}
                  step={0.01}
                  tooltip="Short strike delta filter. Lower delta = further OTM, higher probability of profit but lower credit. Higher delta = closer to ATM, more credit but higher risk."
                />

                {/* Max Width */}
                <CompactValueInput
                  label="Width"
                  value={maxWidth}
                  onChange={setMaxWidth}
                  min={1}
                  max={50}
                  step={1}
                  suffix="$"
                  tooltip="Maximum spread width (distance between strikes). Wider spreads have higher max loss but also higher credit received."
                />

                {/* Min ROC */}
                <CompactValueInput
                  label="Min ROC"
                  value={minRoc}
                  onChange={setMinRoc}
                  min={0.05}
                  tooltip="Minimum Return on Capital (as a decimal). The credit received divided by max loss. E.g., 0.15 = 15% potential return."
                  max={1}
                  step={0.01}
                  suffix="%"
                />

                {/* Top N */}
                <CompactValueInput
                  label="Top N"
                  value={limit}
                  onChange={setLimit}
                  min={1}
                  max={100}
                  step={1}
                  tooltip="Maximum number of credit spread candidates to display, sorted by score."
                />

                {/* Search Button */}
                <button
                  onClick={fetchSpreads}
                  disabled={isLoading}
                  className="h-9 px-4 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Screening...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Screen</span>
                    </>
                  )}
                </button>

                {/* Summary Stats */}
                {underlyingPrice > 0 && (
                  <div className="flex items-center gap-2 ml-auto text-sm">
                    <span className="font-semibold text-gray-900">{ticker}</span>
                    <span className="font-bold text-blue-600">{formatCurrency(underlyingPrice)}</span>
                    {ivp > 0 && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ivp >= 50 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        IVP {ivp.toFixed(0)}%
                      </span>
                    )}
                    <span className="text-gray-500">
                      {filteredSpreads.length} found
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Results Table */}
            {filteredSpreads.length > 0 && (
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">Credit Spread Opportunities</h2>
                    {timestamp && (
                      <span className="text-sm text-gray-500">
                        Updated: {formatTimestamp(timestamp)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    Click a row to analyze with AI
                  </span>
                </div>

                <SpreadsTable
                  spreads={filteredSpreads}
                  selectedSpread={selectedSpread}
                  onSelectSpread={setSelectedSpread}
                  isMobile={isMobile}
                />
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <svg className="animate-spin h-8 w-8 mx-auto text-blue-600 mb-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-600">Screening credit spreads...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && filteredSpreads.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                {error}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredSpreads.length === 0 && !error && spreads.length === 0 && (
              <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Screen for Credit Spreads</h3>
                <p className="text-gray-600">
                  Adjust the filters above and click "Screen Spreads" to find opportunities.
                </p>
              </div>
            )}

            {/* Footer */}
            <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm space-y-2">
              <p>
                <Link href="/about" className="text-blue-600 hover:underline font-medium">
                  About OptChain
                </Link>
                {' '}&middot;{' '}
                <a
                  href="https://github.com/qichaolan/OptChain-v2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  GitHub
                </a>
                {' '}&middot;{' '}
                <a
                  href="mailto:info@optchain.app"
                  className="text-blue-600 hover:underline"
                >
                  Contact
                </a>
              </p>
              <p className="text-xs text-gray-400">
                Educational use only. Not financial advice.
              </p>
            </footer>
          </div>
        </div>

        {/* AI Insights Panel - sits next to content */}
        {currentMetadata && showAiPanel && (
          <div
            className={`
              hidden md:flex h-full w-[380px] flex-shrink-0
              bg-gray-50 border-l border-gray-200
              flex-col overflow-hidden pt-6 pr-4
            `}
          >
            {/* Header - Blue/Indigo gradient for AI panel, aligned with controls */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg">
                  <span className="text-xl">🤖</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">AI Insights</h4>
                  <p className="text-blue-100 text-xs">Credit Spread Analysis</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiPanel(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                aria-label="Close panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Inline AI Insights - Chatless Generative UI */}
            <div className="flex-1 overflow-y-auto p-4 bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-md">
              <InlineAiInsights size="detailed" autoAnalyze={true} />
            </div>
          </div>
        )}

        {/* Toggle button when panel is hidden */}
        {currentMetadata && !showAiPanel && (
          <button
            onClick={() => setShowAiPanel(true)}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            <span className="text-xl">🤖</span>
            <span className="hidden sm:inline">AI Insights</span>
          </button>
        )}

        {/* Mobile AI Panel - Bottom Sheet */}
        {currentMetadata && showAiPanel && (
          <div className="md:hidden fixed inset-0 z-[70]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowAiPanel(false)}
            />
            {/* Bottom Sheet */}
            <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-2xl shadow-2xl flex flex-col animate-slide-up">
              {/* Handle bar */}
              <div className="flex justify-center py-2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-green-600 to-emerald-600">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <h4 className="font-bold text-white">AI Insights</h4>
                </div>
                <button
                  onClick={() => setShowAiPanel(false)}
                  className="p-2 hover:bg-white/20 rounded-lg text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <InlineAiInsights size="detailed" autoAnalyze={true} />
              </div>
            </div>
          </div>
        )}

        {/* CSS for mobile animation */}
        <style jsx>{`
          @keyframes slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.3s ease-out;
          }
        `}</style>
      </div>
    </div>
  );
}
