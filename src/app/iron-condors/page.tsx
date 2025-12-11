'use client';

/**
 * Iron Condors Page - Native UI with Direct API Calls
 *
 * Allows users to screen for iron condor opportunities
 * with customizable parameters and AI-powered analysis.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useOptionChain } from '@/contexts';
import { Navigation } from '@/components';
import { InlineAiInsights } from '@/components/ai';
import {
  IronCondorMetadata,
  createIronCondorContext,
} from '@/types';

// =============================================================================
// Types
// =============================================================================

interface IronCondorCandidate {
  id: string;
  symbol: string;
  expiration: string;
  dte: number;
  short_put: number;
  long_put: number;
  short_call: number;
  long_call: number;
  width: number;
  total_credit: number;
  max_profit: number;
  max_loss: number;
  risk_reward_ratio: number;
  ror: number;
  combined_pop: number;
  combined_score: number;
  breakeven_low: number;
  breakeven_high: number;
  short_put_delta: number;
  short_call_delta: number;
  dist_to_short_put: number;
  dist_to_short_call: number;
  dist_to_lower_be: number;
  dist_to_upper_be: number;
}

interface IronCondorResponse {
  symbol: string;
  underlying_price: number;
  total_candidates: number;
  candidates: IronCondorCandidate[];
  timestamp: string;
  cached?: boolean;
}

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

// Iron Condors Table Component
function CondorsTable({
  condors,
  selectedCondor,
  onSelectCondor,
  isMobile,
}: {
  condors: IronCondorCandidate[];
  selectedCondor?: IronCondorCandidate;
  onSelectCondor: (condor: IronCondorCandidate) => void;
  isMobile: boolean;
}) {
  const isSelected = (condor: IronCondorCandidate) =>
    selectedCondor &&
    condor.id === selectedCondor.id;

  const getRowClass = (condor: IronCondorCandidate) => {
    const base = 'cursor-pointer transition-colors border-b';
    const selected = isSelected(condor);

    if (selected) {
      return `${base} bg-blue-100`;
    }
    return `${base} hover:bg-gray-50`;
  };

  // Mobile view - simplified columns
  if (isMobile) {
    return (
      <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left">Exp</th>
              <th className="px-2 py-2 text-right">Credit</th>
              <th className="px-2 py-2 text-right">ROR</th>
              <th className="px-2 py-2 text-right">POP</th>
              <th className="px-2 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {condors.map((condor) => (
              <tr
                key={condor.id}
                className={getRowClass(condor)}
                onClick={() => onSelectCondor(condor)}
              >
                <td className="px-2 py-2 text-sm">{condor.expiration}</td>
                <td className="px-2 py-2 text-right font-medium text-green-600">
                  {formatCurrency(condor.total_credit)}
                </td>
                <td className="px-2 py-2 text-right">
                  {formatPercent(condor.ror)}
                </td>
                <td className="px-2 py-2 text-right">
                  {formatPercent(condor.combined_pop)}
                </td>
                <td className="px-2 py-2 text-right">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    condor.combined_score >= 0.7 ? 'bg-green-100 text-green-700' :
                    condor.combined_score >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {formatNumber(condor.combined_score, 2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Desktop view - full columns
  return (
    <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 text-left">Expiration</th>
            <th className="px-3 py-2 text-right">DTE</th>
            <th className="px-3 py-2 text-right">Short Put</th>
            <th className="px-3 py-2 text-right">Short Call</th>
            <th className="px-3 py-2 text-right">Width</th>
            <th className="px-3 py-2 text-right">Credit</th>
            <th className="px-3 py-2 text-right">Max Loss</th>
            <th className="px-3 py-2 text-right">ROR</th>
            <th className="px-3 py-2 text-right">POP</th>
            <th className="px-3 py-2 text-right">Put Delta</th>
            <th className="px-3 py-2 text-right">Call Delta</th>
            <th className="px-3 py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {condors.map((condor) => (
            <tr
              key={condor.id}
              className={getRowClass(condor)}
              onClick={() => onSelectCondor(condor)}
            >
              <td className="px-3 py-2">{condor.expiration}</td>
              <td className="px-3 py-2 text-right">{condor.dte}</td>
              <td className="px-3 py-2 text-right font-medium">{formatCurrency(condor.short_put)}</td>
              <td className="px-3 py-2 text-right font-medium">{formatCurrency(condor.short_call)}</td>
              <td className="px-3 py-2 text-right">${condor.width.toFixed(0)}</td>
              <td className="px-3 py-2 text-right font-medium text-green-600">{formatCurrency(condor.total_credit)}</td>
              <td className="px-3 py-2 text-right text-red-600">{formatCurrency(condor.max_loss)}</td>
              <td className="px-3 py-2 text-right font-medium">{formatPercent(condor.ror)}</td>
              <td className="px-3 py-2 text-right">{formatPercent(condor.combined_pop)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(condor.short_put_delta, 2)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(condor.short_call_delta, 2)}</td>
              <td className="px-3 py-2 text-right">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  condor.combined_score >= 0.7 ? 'bg-green-100 text-green-700' :
                  condor.combined_score >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {formatNumber(condor.combined_score, 2)}
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

export default function IronCondorsPage() {
  // Filter state
  const [ticker, setTicker] = useState<string>('QQQ');
  const [minDte, setMinDte] = useState(14);
  const [maxDte, setMaxDte] = useState(45);
  const [minRor, setMinRor] = useState(0.15);
  const [minPop, setMinPop] = useState(0.50);
  const [limit, setLimit] = useState(20);

  // Data state
  const [condors, setCondors] = useState<IronCondorCandidate[]>([]);
  const [underlyingPrice, setUnderlyingPrice] = useState(0);
  const [timestamp, setTimestamp] = useState('');
  const [selectedCondor, setSelectedCondor] = useState<IronCondorCandidate | undefined>();
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

  // Fetch iron condors from API
  const fetchCondors = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    setCondors([]);
    setSelectedCondor(undefined);
    clearContext();

    try {
      const params = new URLSearchParams({
        symbol: ticker,
        dte_min: minDte.toString(),
        dte_max: maxDte.toString(),
        min_roc: minRor.toString(),
        min_pop: minPop.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/iron-condors?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch iron condors');
      }

      const data: IronCondorResponse = await response.json();
      setCondors(data.candidates);
      setUnderlyingPrice(data.underlying_price);
      setTimestamp(data.timestamp);

      if (data.candidates.length === 0) {
        setError('No iron condors found matching your criteria. Try adjusting filters.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch iron condors');
    } finally {
      setIsLoading(false);
    }
  }, [ticker, minDte, maxDte, minRor, minPop, limit, clearContext]);

  // Auto-fetch on mount with default parameters
  useEffect(() => {
    fetchCondors();
  }, []); // Only on mount

  // Update context when condor is selected
  useEffect(() => {
    if (selectedCondor && underlyingPrice) {
      const metadata: IronCondorMetadata = {
        symbol: selectedCondor.symbol,
        underlyingPrice: underlyingPrice,
        expiration: selectedCondor.expiration,
        dte: selectedCondor.dte,
        shortPutStrike: selectedCondor.short_put,
        longPutStrike: selectedCondor.long_put,
        shortCallStrike: selectedCondor.short_call,
        longCallStrike: selectedCondor.long_call,
        width: selectedCondor.width,
        netCredit: selectedCondor.total_credit,
        maxLoss: selectedCondor.max_loss,
        maxGain: selectedCondor.max_profit,
        lowerBreakeven: selectedCondor.breakeven_low,
        upperBreakeven: selectedCondor.breakeven_high,
        profitZoneWidth: selectedCondor.breakeven_high - selectedCondor.breakeven_low,
        ror: selectedCondor.ror,
        riskRewardRatio: selectedCondor.risk_reward_ratio,
        probProfit: selectedCondor.combined_pop,
        shortPutDelta: selectedCondor.short_put_delta,
        shortCallDelta: selectedCondor.short_call_delta,
        distToShortPut: selectedCondor.dist_to_short_put,
        distToShortCall: selectedCondor.dist_to_short_call,
        distToLowerBE: selectedCondor.dist_to_lower_be,
        distToUpperBE: selectedCondor.dist_to_upper_be,
      };

      const context = createIronCondorContext(metadata);
      setCurrentContext(context.page, context.contextType, metadata);
      setShowAiPanel(true);
    }
  }, [selectedCondor, underlyingPrice, setCurrentContext]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <Navigation subtitle="Iron Condors" />

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

                {/* DTE Range */}
                <CompactRangeInput
                  label="DTE"
                  minValue={minDte}
                  maxValue={maxDte}
                  onMinChange={setMinDte}
                  onMaxChange={setMaxDte}
                  min={1}
                  max={180}
                  tooltip="Days to Expiration. Shorter DTE means faster time decay (theta) but less time for the trade to work. Longer DTE gives more time but slower decay."
                />

                {/* Min ROR */}
                <CompactValueInput
                  label="Min ROR"
                  value={minRor}
                  onChange={setMinRor}
                  min={0.05}
                  max={1}
                  step={0.01}
                  tooltip="Minimum Return on Risk (as a decimal). This is the max profit divided by max loss. Higher ROR means better reward relative to risk. E.g., 0.15 = 15% return."
                />

                {/* Min POP */}
                <CompactValueInput
                  label="Min POP"
                  value={minPop}
                  onChange={setMinPop}
                  min={0.0}
                  max={1}
                  step={0.05}
                  tooltip="Minimum Probability of Profit (as a decimal). Estimated likelihood the iron condor expires profitable. E.g., 0.50 = 50% chance of profit."
                />

                {/* Top N */}
                <CompactValueInput
                  label="Top N"
                  value={limit}
                  onChange={setLimit}
                  min={1}
                  max={50}
                  step={5}
                  tooltip="Maximum number of iron condor candidates to display, sorted by combined score."
                />

                {/* Screen Button */}
                <button
                  onClick={fetchCondors}
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
                    <span className="text-gray-500">
                      {condors.length} found
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Results Table */}
            {condors.length > 0 && (
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">Iron Condor Opportunities</h2>
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

                <CondorsTable
                  condors={condors}
                  selectedCondor={selectedCondor}
                  onSelectCondor={setSelectedCondor}
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
                <p className="text-gray-600">Screening iron condors...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && condors.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                {error}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && condors.length === 0 && !error && (
              <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <div className="text-4xl mb-4">🦅</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Screen for Iron Condors</h3>
                <p className="text-gray-600">
                  Adjust the filters above and click "Screen" to find opportunities.
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
                  <p className="text-blue-100 text-xs">Iron Condor Analysis</p>
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
      </div>
    </div>
  );
}
