'use client';

/**
 * LEAPS Page - Native UI with Direct API Calls
 *
 * Allows users to screen for LEAPS (Long-term Equity AnticiPation Securities)
 * opportunities with customizable parameters and AI-powered analysis.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useOptionChain } from '@/contexts';
import { Navigation } from '@/components';
import { InlineAiInsights } from '@/components/ai';
import {
  LeapsMetadata,
  LeapsContract as LeapsContractType,
  createLeapsContext,
} from '@/types';

// =============================================================================
// Types
// =============================================================================

interface LeapsContract {
  contract_symbol: string;
  expiration: string;
  strike: number;
  target_price: number;
  premium: number;
  cost: number;
  payoff_target: number;
  roi_target: number;
  ease_score: number;
  roi_score: number;
  score: number;
  last_trade_price?: number;
  bid?: number;
  ask?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  implied_volatility?: number;
  open_interest?: number;
  volume?: number;
}

interface LeapsResponse {
  symbol: string;
  underlying_price: number;
  target_price: number;
  target_pct: number;
  mode: string;
  contracts: LeapsContract[];
  timestamp: string;
}

interface Ticker {
  symbol: string;
  name: string;
  default_target_pct: number;
}

type LeapsMode = 'high_prob' | 'high_convexity';

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (val: number | undefined | null) =>
  val != null
    ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '-';

const formatPercent = (val: number | undefined | null, decimals = 1) =>
  val != null ? `${(val * 100).toFixed(decimals)}%` : '-';

const formatNumber = (val: number | undefined | null, decimals = 2) =>
  val != null ? val.toFixed(decimals) : '-';

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

// Ticker Dropdown Component
function TickerDropdown({
  value,
  onChange,
  disabled,
  tickers,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
  tickers: Ticker[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center h-4">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Ticker</label>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 px-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {tickers.map((ticker) => (
          <option key={ticker.symbol} value={ticker.symbol}>
            {ticker.symbol} - {ticker.name}
          </option>
        ))}
      </select>
    </div>
  );
}

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

// Mode Dropdown Component
function ModeDropdown({
  value,
  onChange,
  tooltip,
}: {
  value: LeapsMode;
  onChange: (val: LeapsMode) => void;
  tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center h-4">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Mode</label>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LeapsMode)}
        className="h-9 px-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="high_prob">High Probability</option>
        <option value="high_convexity">High Convexity</option>
      </select>
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

// Contracts Table Component
function ContractsTable({
  contracts,
  selectedContract,
  onSelectContract,
  isMobile,
}: {
  contracts: LeapsContract[];
  selectedContract?: LeapsContract;
  onSelectContract: (contract: LeapsContract) => void;
  isMobile: boolean;
}) {
  const isSelected = (contract: LeapsContract) =>
    selectedContract &&
    contract.contract_symbol === selectedContract.contract_symbol;

  const getRowClass = (contract: LeapsContract) => {
    const base = 'cursor-pointer transition-colors border-b';
    const selected = isSelected(contract);

    if (selected) {
      return `${base} bg-blue-100`;
    }
    return `${base} hover:bg-gray-50`;
  };

  // Mobile view - card-based layout
  if (isMobile) {
    return (
      <div className="max-h-[500px] overflow-y-auto px-2 py-2 space-y-2">
        {contracts.map((contract, idx) => (
          <div
            key={`${contract.contract_symbol}-${idx}`}
            className={`p-3 rounded-lg border transition-all ${
              isSelected(contract)
                ? 'bg-blue-50 border-blue-300 shadow-md'
                : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
            }`}
            onClick={() => onSelectContract(contract)}
          >
            {/* Header row: Strike + Score */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(contract.strike)}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                contract.score >= 0.7 ? 'bg-green-100 text-green-700' :
                contract.score >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                Score: {formatNumber(contract.score, 2)}
              </span>
            </div>
            {/* Details row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="text-gray-500">Cost:</span>
                <span className="font-medium">{formatCurrency(contract.cost)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">ROI:</span>
                <span className="font-semibold text-green-600">{formatPercent(contract.roi_target)}</span>
              </div>
            </div>
            {/* Expiration row */}
            <div className="mt-1.5 text-xs text-gray-500">
              Exp: {contract.expiration}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop view - optimized columns for AI panel
  return (
    <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2 text-left whitespace-nowrap">Expiration</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Strike</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Last</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Bid</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Ask</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Cost</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Payoff</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">
              <div className="flex items-center justify-end">
                <span>ROI</span>
                <Tooltip text="ROI = (Payoff - Cost) / Cost. Shows your potential return if the stock reaches the target price." />
              </div>
            </th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Score</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Delta</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Gamma</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Theta</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Vega</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">IV%</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Vol</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">OI</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract, idx) => (
            <tr
              key={`${contract.contract_symbol}-${idx}`}
              className={getRowClass(contract)}
              onClick={() => onSelectContract(contract)}
            >
              <td className="px-2 py-2 whitespace-nowrap">{contract.expiration}</td>
              <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(contract.strike)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(contract.last_trade_price)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(contract.bid)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(contract.ask)}</td>
              <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(contract.cost)}</td>
              <td className="px-2 py-2 text-right text-green-600 whitespace-nowrap">{formatCurrency(contract.payoff_target)}</td>
              <td className="px-2 py-2 text-right font-medium text-green-700 whitespace-nowrap">{formatPercent(contract.roi_target)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  contract.score >= 0.7 ? 'bg-green-100 text-green-700' :
                  contract.score >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {formatNumber(contract.score, 2)}
                </span>
              </td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{contract.delta != null ? formatNumber(contract.delta, 3) : '-'}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{contract.gamma != null ? formatNumber(contract.gamma, 4) : '-'}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{contract.theta != null ? formatNumber(contract.theta, 3) : '-'}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{contract.vega != null ? formatNumber(contract.vega, 3) : '-'}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{contract.implied_volatility != null ? formatPercent(contract.implied_volatility, 0) : '-'}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{contract.volume != null ? contract.volume.toLocaleString() : '-'}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{contract.open_interest != null ? contract.open_interest.toLocaleString() : '-'}</td>
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

export default function LeapsPage() {
  // Ticker data
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [tickersLoaded, setTickersLoaded] = useState(false);

  // Filter state
  const [ticker, setTicker] = useState<string>('SPY');
  const [targetPct, setTargetPct] = useState(50); // 50%
  const [mode, setMode] = useState<LeapsMode>('high_prob');
  const [topN, setTopN] = useState(20);

  // Data state
  const [contracts, setContracts] = useState<LeapsContract[]>([]);
  const [underlyingPrice, setUnderlyingPrice] = useState(0);
  const [targetPrice, setTargetPrice] = useState(0);
  const [timestamp, setTimestamp] = useState('');
  const [selectedContract, setSelectedContract] = useState<LeapsContract | undefined>();
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

  // Fetch tickers on mount
  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const response = await fetch('/api/tickers');
        if (!response.ok) {
          throw new Error('Failed to fetch tickers');
        }
        const data: Ticker[] = await response.json();
        setTickers(data);
        setTickersLoaded(true);

        // Set default target_pct for SPY
        const spyTicker = data.find(t => t.symbol === 'SPY');
        if (spyTicker) {
          setTargetPct(Math.round(spyTicker.default_target_pct * 100));
        }
      } catch (err) {
        console.error('Failed to fetch tickers:', err);
        // Fallback to hardcoded list
        setTickers([
          { symbol: 'SPY', name: 'S&P 500 ETF', default_target_pct: 0.5 },
          { symbol: 'QQQ', name: 'Nasdaq 100 ETF', default_target_pct: 0.5 },
          { symbol: 'IWM', name: 'Russell 2000 ETF', default_target_pct: 0.5 },
          { symbol: 'GOOG', name: 'Alphabet Inc.', default_target_pct: 0.5 },
          { symbol: 'NVDA', name: 'NVIDIA Corp.', default_target_pct: 0.5 },
          { symbol: 'MSFT', name: 'Microsoft Corp.', default_target_pct: 0.5 },
        ]);
        setTickersLoaded(true);
      }
    };

    fetchTickers();
  }, []);

  // Update target_pct when ticker changes
  useEffect(() => {
    if (tickersLoaded) {
      const selectedTicker = tickers.find(t => t.symbol === ticker);
      if (selectedTicker) {
        setTargetPct(Math.round(selectedTicker.default_target_pct * 100));
      }
    }
  }, [ticker, tickers, tickersLoaded]);

  // Fetch contracts from API
  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    setContracts([]);
    setSelectedContract(undefined);
    clearContext();

    try {
      const response = await fetch('/api/leaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: ticker,
          target_pct: targetPct / 100, // Convert percentage to decimal
          mode: mode,
          top_n: topN,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch LEAPS contracts');
      }

      const data: LeapsResponse = await response.json();
      setContracts(data.contracts);
      setUnderlyingPrice(data.underlying_price);
      setTargetPrice(data.target_price);
      setTimestamp(data.timestamp);

      if (data.contracts.length === 0) {
        setError('No LEAPS contracts found matching your criteria. Try adjusting filters.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LEAPS contracts');
    } finally {
      setIsLoading(false);
    }
  }, [ticker, targetPct, mode, topN, clearContext]);

  // Auto-fetch on mount with default parameters
  useEffect(() => {
    if (tickersLoaded) {
      fetchContracts();
    }
  }, [tickersLoaded]); // Only on mount after tickers loaded

  // Update context when contract is selected
  useEffect(() => {
    if (selectedContract && underlyingPrice) {
      // Map all contracts to the LeapsContract type for Battle Mode comparison
      const availableContracts: LeapsContractType[] = contracts.map((c) => ({
        contractSymbol: c.contract_symbol,
        expiration: c.expiration,
        strike: c.strike,
        premium: c.premium,
        cost: c.cost,
        impliedVolatility: c.implied_volatility,
        openInterest: c.open_interest,
        delta: c.delta,
        gamma: c.gamma,
        theta: c.theta,
        vega: c.vega,
      }));

      const metadata: LeapsMetadata = {
        symbol: ticker,
        underlyingPrice: underlyingPrice,
        targetPrice: targetPrice,
        targetPct: targetPct / 100,
        mode: mode,
        contract: {
          contractSymbol: selectedContract.contract_symbol,
          expiration: selectedContract.expiration,
          strike: selectedContract.strike,
          premium: selectedContract.premium,
          cost: selectedContract.cost,
          impliedVolatility: selectedContract.implied_volatility,
          openInterest: selectedContract.open_interest,
        },
        roiResults: [
          {
            targetPrice: targetPrice,
            priceChangePct: targetPct / 100,
            intrinsicValue: Math.max(0, targetPrice - selectedContract.strike),
            payoff: selectedContract.payoff_target,
            profit: selectedContract.payoff_target - selectedContract.cost,
            roiPct: selectedContract.roi_target,
          },
        ],
        breakeven: selectedContract.strike + selectedContract.premium,
        maxLoss: selectedContract.cost,
        availableContracts: availableContracts,
      };

      const context = createLeapsContext(metadata);
      setCurrentContext(context.page, context.contextType, metadata);
      setShowAiPanel(true);
    }
  }, [selectedContract, underlyingPrice, targetPrice, ticker, targetPct, mode, contracts, setCurrentContext]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <Navigation subtitle="LEAPS" />

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
                  disabled={isLoading || !tickersLoaded}
                  tickers={tickers}
                />

                {/* Mode Dropdown */}
                <ModeDropdown
                  value={mode}
                  onChange={setMode}
                  tooltip="High Probability: Focuses on options with higher win rates - safer plays with more modest returns. High Convexity: Focuses on options with explosive upside potential - higher risk but bigger rewards if the stock moves significantly."
                />

                {/* Top N */}
                <CompactValueInput
                  label="Top N"
                  value={topN}
                  onChange={setTopN}
                  min={1}
                  max={50}
                  step={1}
                  tooltip="Number of top-ranked contracts to display. Higher values show more options to compare, but the best opportunities are typically at the top of the list."
                />

                {/* Screen Button */}
                <button
                  onClick={fetchContracts}
                  disabled={isLoading || !tickersLoaded}
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
                    <span className="text-gray-500">→</span>
                    <span className="font-bold text-indigo-600">{formatCurrency(targetPrice)}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      mode === 'high_prob' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {mode === 'high_prob' ? 'High Prob' : 'High Conv'}
                    </span>
                    <span className="text-gray-500">
                      {contracts.length} found
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Results Table */}
            {contracts.length > 0 && (
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">LEAPS Opportunities</h2>
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

                <ContractsTable
                  contracts={contracts}
                  selectedContract={selectedContract}
                  onSelectContract={setSelectedContract}
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
                <p className="text-gray-600">Screening LEAPS contracts...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && contracts.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                {error}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && contracts.length === 0 && !error && tickersLoaded && (
              <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                <div className="text-4xl mb-4">📈</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Screen for LEAPS</h3>
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
            {/* Header - Blue/Indigo color scheme for LEAPS branding, aligned with controls */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-indigo-200 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg">
                  <span className="text-xl">🤖</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">AI Insights</h4>
                  <p className="text-blue-100 text-xs">LEAPS Analysis</p>
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
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
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
