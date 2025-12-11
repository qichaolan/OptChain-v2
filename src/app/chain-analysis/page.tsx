'use client';

/**
 * Chain Analysis Page
 *
 * Allows users to enter any ticker, select an expiration date,
 * and view the full options chain with AI-powered analysis.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useOptionChain } from '@/contexts';
import { Navigation } from '@/components';
import { InlineAiInsights } from '@/components/ai';
import {
  ChainAnalysisMetadata,
  OptionContract,
  createChainAnalysisContext,
} from '@/types';
import {
  findAtmStrike,
  isAtmStrike,
  transformOiChartData,
  calculatePremiumSummary,
  formatCompactCurrency,
  PremiumOptionContract,
} from '@/lib/options-utils';
import { OIMirrorBarChart } from '@/components/charts';

// =============================================================================
// Types
// =============================================================================

interface ExpirationResponse {
  symbol: string;
  underlying_price: number;
  expirations: string[];
  timestamp: string;
}

interface OptionsChainResponse {
  symbol: string;
  underlying_price: number;
  expiration: string;
  dte: number;
  calls: ApiOptionContract[];
  puts: ApiOptionContract[];
  total_calls: number;
  total_puts: number;
  timestamp: string;
}

interface ApiOptionContract {
  contract_symbol: string;
  option_type: string;
  strike: number;
  expiration: string;
  last_price: number;
  bid: number;
  ask: number;
  volume: number;
  open_interest: number;
  implied_volatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
}

type FilterType = 'oi_chart' | 'both' | 'call' | 'put';

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (val: number | undefined) =>
  val !== undefined
    ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '-';

const formatPercent = (val: number | undefined) =>
  val !== undefined ? `${(val * 100).toFixed(1)}%` : '-';

const formatNumber = (val: number | undefined) =>
  val !== undefined ? val.toLocaleString('en-US') : '-';

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

const convertApiContract = (api: ApiOptionContract): OptionContract => ({
  contractSymbol: api.contract_symbol,
  optionType: api.option_type as 'call' | 'put',
  strike: api.strike,
  expiration: api.expiration,
  lastPrice: api.last_price,
  bid: api.bid,
  ask: api.ask,
  volume: api.volume,
  openInterest: api.open_interest,
  impliedVolatility: api.implied_volatility,
  delta: api.delta,
  gamma: api.gamma,
  theta: api.theta,
  vega: api.vega,
  rho: api.rho,
});

// =============================================================================
// Components
// =============================================================================

// Ticker Input Component
function TickerInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.length >= 1 && value.length <= 5) {
      onSubmit();
    }
  };

  const handleBlur = () => {
    if (value.length >= 1 && value.length <= 5 && /^[A-Za-z]+$/.test(value)) {
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">Ticker</label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="SPY"
          maxLength={5}
          className={`w-20 h-9 px-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {isLoading && (
          <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
      </div>
    </div>
  );
}

// Expiration Dropdown Component
function ExpirationDropdown({
  expirations,
  selected,
  onSelect,
  disabled,
}: {
  expirations: string[];
  selected: string;
  onSelect: (exp: string) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatExpDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateDTE = (dateStr: string) => {
    const exp = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const visibleExpirations = expirations.slice(0, visibleCount);
  const hasMore = expirations.length > visibleCount;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">Expiration</label>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || expirations.length === 0}
          className="h-9 px-2 border border-gray-300 rounded-md text-sm text-left bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
        >
          {selected ? (
            <span className="flex justify-between gap-2">
              <span>{formatExpDate(selected)}</span>
              <span className="text-gray-500 text-xs">{calculateDTE(selected)}d</span>
            </span>
          ) : (
            <span className="text-gray-400">Select...</span>
          )}
        </button>

        {isOpen && expirations.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {visibleExpirations.map((exp) => (
              <button
                key={exp}
                onClick={() => {
                  onSelect(exp);
                  setIsOpen(false);
                }}
                className={`w-full px-2 py-1.5 text-sm text-left hover:bg-blue-50 flex justify-between ${
                  exp === selected ? 'bg-blue-100 text-blue-700' : ''
                }`}
              >
                <span>{formatExpDate(exp)}</span>
                <span className="text-gray-500 text-xs">{calculateDTE(exp)}d</span>
              </button>
            ))}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="w-full px-2 py-1.5 text-sm text-center text-blue-600 hover:bg-blue-50 border-t"
              >
                Load More ({expirations.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Filter Buttons Component
function FilterButtons({
  filter,
  onFilterChange,
}: {
  filter: FilterType;
  onFilterChange: (f: FilterType) => void;
}) {
  const getButtonStyle = (f: FilterType) => {
    if (filter !== f) return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    switch (f) {
      case 'oi_chart': return 'bg-purple-600 text-white';
      case 'call': return 'bg-green-600 text-white';
      case 'put': return 'bg-red-600 text-white';
      default: return 'bg-blue-600 text-white';
    }
  };

  const getButtonLabel = (f: FilterType) => {
    switch (f) {
      case 'oi_chart': return 'OI Bars';
      case 'both': return 'Both';
      case 'call': return 'Calls';
      case 'put': return 'Puts';
    }
  };

  return (
    <div className="flex gap-2">
      {(['oi_chart', 'both', 'call', 'put'] as FilterType[]).map((f) => (
        <button
          key={f}
          onClick={() => onFilterChange(f)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${getButtonStyle(f)}`}
        >
          {getButtonLabel(f)}
        </button>
      ))}
    </div>
  );
}

// Premium Summary Bar Component - Shows total call/put premium above OI chart
function PremiumSummaryBar({
  calls,
  puts,
  isMobile,
}: {
  calls: OptionContract[];
  puts: OptionContract[];
  isMobile: boolean;
}) {
  const summary = useMemo(() => {
    // Convert OptionContract to PremiumOptionContract
    const callContracts: PremiumOptionContract[] = calls.map((c) => ({
      bid: c.bid,
      ask: c.ask,
      lastPrice: c.lastPrice,
      openInterest: c.openInterest,
    }));
    const putContracts: PremiumOptionContract[] = puts.map((p) => ({
      bid: p.bid,
      ask: p.ask,
      lastPrice: p.lastPrice,
      openInterest: p.openInterest,
    }));
    return calculatePremiumSummary(callContracts, putContracts);
  }, [calls, puts]);

  // Don't render if no valid premium data
  if (summary.callPremium === null && summary.putPremium === null) {
    return null;
  }

  const getHigherLabel = () => {
    if (summary.higherSide === 'calls') return 'Calls';
    if (summary.higherSide === 'puts') return 'Puts';
    if (summary.higherSide === 'equal') return 'Equal';
    return null;
  };

  const higherLabel = getHigherLabel();

  // Mobile: two-line stacked layout
  if (isMobile) {
    return (
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-sm">
        <div className="flex justify-between items-center">
          {summary.callPremium !== null && (
            <span>
              <span className="text-gray-500">Call Premium: </span>
              <span className="font-semibold text-green-600">
                {formatCompactCurrency(summary.callPremium)}
              </span>
            </span>
          )}
          {summary.putPremium !== null && (
            <span>
              <span className="text-gray-500">Put Premium: </span>
              <span className="font-semibold text-red-600">
                {formatCompactCurrency(summary.putPremium)}
              </span>
            </span>
          )}
        </div>
        {higherLabel && (
          <div className="text-center text-gray-500 mt-1">
            Higher: <span className={`font-semibold ${summary.higherSide === 'calls' ? 'text-green-600' : summary.higherSide === 'puts' ? 'text-red-600' : 'text-gray-600'}`}>{higherLabel}</span>
          </div>
        )}
      </div>
    );
  }

  // Desktop: single-line layout
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-2 mb-3 flex items-center justify-center gap-6 text-sm">
      {summary.callPremium !== null && (
        <span>
          <span className="text-gray-500">Total Call Premium: </span>
          <span className="font-semibold text-green-600">
            {formatCompactCurrency(summary.callPremium)}
          </span>
        </span>
      )}
      <span className="text-gray-300">|</span>
      {summary.putPremium !== null && (
        <span>
          <span className="text-gray-500">Total Put Premium: </span>
          <span className="font-semibold text-red-600">
            {formatCompactCurrency(summary.putPremium)}
          </span>
        </span>
      )}
      {higherLabel && (
        <>
          <span className="text-gray-300">|</span>
          <span>
            <span className="text-gray-500">Premium Higher: </span>
            <span className={`font-semibold ${summary.higherSide === 'calls' ? 'text-green-600' : summary.higherSide === 'puts' ? 'text-red-600' : 'text-gray-600'}`}>
              {higherLabel}
            </span>
          </span>
        </>
      )}
    </div>
  );
}

// Options Table Component - Fully clickable call/put sides with selection highlighting
function OptionsTable({
  calls,
  puts,
  underlyingPrice,
  filter,
  onSelectOption,
  selectedOption,
  isMobile,
}: {
  calls: OptionContract[];
  puts: OptionContract[];
  underlyingPrice: number;
  filter: FilterType;
  onSelectOption: (opt: OptionContract) => void;
  selectedOption?: OptionContract;
  isMobile: boolean;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const atmRowRef = useRef<HTMLTableRowElement>(null);

  // Get all strikes sorted
  const allStrikes = useMemo(() => {
    const strikeSet = new Set<number>();
    calls.forEach((c) => strikeSet.add(c.strike));
    puts.forEach((p) => strikeSet.add(p.strike));
    return Array.from(strikeSet).sort((a, b) => a - b);
  }, [calls, puts]);

  // Find ATM strike (closest to underlying price)
  const atmStrike = useMemo(
    () => findAtmStrike(allStrikes, underlyingPrice),
    [allStrikes, underlyingPrice]
  );

  // Auto-scroll to ATM strike when data loads
  useEffect(() => {
    if (atmRowRef.current && tableContainerRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        atmRowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [atmStrike]);

  const getCallForStrike = (strike: number) => calls.find((c) => c.strike === strike);
  const getPutForStrike = (strike: number) => puts.find((p) => p.strike === strike);

  const isCallSelected = (opt?: OptionContract) =>
    opt && selectedOption?.contractSymbol === opt.contractSymbol && selectedOption?.optionType === 'call';

  const isPutSelected = (opt?: OptionContract) =>
    opt && selectedOption?.contractSymbol === opt.contractSymbol && selectedOption?.optionType === 'put';

  // Common cell click handler - prevents event propagation and selects option
  const handleOptionClick = (opt: OptionContract | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (opt) {
      onSelectOption(opt);
    }
  };

  // CSS classes for clickable option cells
  const getCallCellClass = (call?: OptionContract, isFirst = false) => {
    const base = 'px-3 py-2 cursor-pointer transition-colors';
    const selected = isCallSelected(call) ? 'bg-green-100 font-semibold' : '';
    const hover = call ? 'hover:bg-green-50' : '';
    const border = isFirst ? 'border-l-4 border-l-green-500' : '';
    return `${base} ${selected} ${hover} ${border}`.trim();
  };

  const getPutCellClass = (put?: OptionContract, isFirst = false) => {
    const base = 'px-3 py-2 cursor-pointer transition-colors';
    const selected = isPutSelected(put) ? 'bg-red-100 font-semibold' : '';
    const hover = put ? 'hover:bg-red-50' : '';
    const border = isFirst ? 'border-l-4 border-l-red-500' : '';
    return `${base} ${selected} ${hover} ${border}`.trim();
  };

  // Mobile-optimized table
  if (isMobile) {
    return (
      <div ref={tableContainerRef} className="max-h-[500px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              {/* Strike first when filtering by call or put only */}
              {filter !== 'both' && (
                <th className="px-2 py-2 text-center font-bold bg-gray-200">Strike</th>
              )}
              {(filter === 'both' || filter === 'call') && (
                <>
                  <th className="px-2 py-2 text-left text-green-700 border-l-4 border-l-green-500">Premium</th>
                  <th className="px-2 py-2 text-right text-green-700">IV%</th>
                </>
              )}
              {/* Strike in middle for both filter */}
              {filter === 'both' && (
                <th className="px-2 py-2 text-center font-bold bg-gray-200">Strike</th>
              )}
              {(filter === 'both' || filter === 'put') && (
                <>
                  <th className="px-2 py-2 text-left text-red-700 border-l-4 border-l-red-500">Premium</th>
                  <th className="px-2 py-2 text-right text-red-700">IV%</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {allStrikes.map((strike) => {
              const call = getCallForStrike(strike);
              const put = getPutForStrike(strike);
              const isAtm = strike <= underlyingPrice && (allStrikes[allStrikes.indexOf(strike) + 1] || Infinity) > underlyingPrice;
              const callSelected = isCallSelected(call);
              const putSelected = isPutSelected(put);

              return (
                <tr
                  key={strike}
                  ref={isAtmStrike(strike, atmStrike) ? atmRowRef : undefined}
                  className={`border-b ${isAtm ? 'bg-yellow-50' : ''}`}
                >
                  {/* Strike first when filtering */}
                  {filter !== 'both' && (
                    <td className="px-2 py-2 text-center font-semibold bg-gray-50">
                      {formatCurrency(strike)}
                    </td>
                  )}
                  {(filter === 'both' || filter === 'call') && (
                    <>
                      <td
                        className={`px-2 py-2 cursor-pointer transition-colors border-l-4 ${
                          callSelected ? 'bg-green-100 font-semibold border-l-green-600' : 'border-l-green-300 hover:bg-green-50'
                        } ${!call ? 'text-gray-400' : ''}`}
                        onClick={(e) => handleOptionClick(call, e)}
                      >
                        {call ? formatCurrency(call.lastPrice) : '-'}
                      </td>
                      <td
                        className={`px-2 py-2 text-right cursor-pointer transition-colors ${
                          callSelected ? 'bg-green-100' : 'hover:bg-green-50'
                        } ${!call ? 'text-gray-400' : 'text-gray-600'}`}
                        onClick={(e) => handleOptionClick(call, e)}
                      >
                        {call ? formatPercent(call.impliedVolatility) : '-'}
                      </td>
                    </>
                  )}
                  {/* Strike in middle for both filter */}
                  {filter === 'both' && (
                    <td className="px-2 py-2 text-center font-semibold bg-gray-50">
                      {formatCurrency(strike)}
                    </td>
                  )}
                  {(filter === 'both' || filter === 'put') && (
                    <>
                      <td
                        className={`px-2 py-2 cursor-pointer transition-colors border-l-4 ${
                          putSelected ? 'bg-red-100 font-semibold border-l-red-600' : 'border-l-red-300 hover:bg-red-50'
                        } ${!put ? 'text-gray-400' : ''}`}
                        onClick={(e) => handleOptionClick(put, e)}
                      >
                        {put ? formatCurrency(put.lastPrice) : '-'}
                      </td>
                      <td
                        className={`px-2 py-2 text-right cursor-pointer transition-colors ${
                          putSelected ? 'bg-red-100' : 'hover:bg-red-50'
                        } ${!put ? 'text-gray-400' : 'text-gray-600'}`}
                        onClick={(e) => handleOptionClick(put, e)}
                      >
                        {put ? formatPercent(put.impliedVolatility) : '-'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Desktop table with full columns
  return (
    <div ref={tableContainerRef} className="max-h-[600px] overflow-y-auto overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {/* Strike first when filtering by call or put only */}
            {filter !== 'both' && (
              <th className="px-3 py-2 text-center font-bold bg-gray-200">Strike</th>
            )}
            {(filter === 'both' || filter === 'call') && (
              <>
                <th className="px-3 py-2 text-left text-green-700 border-l-4 border-l-green-500">Last</th>
                <th className="px-3 py-2 text-left text-green-700">Bid</th>
                <th className="px-3 py-2 text-left text-green-700">Ask</th>
                <th className="px-3 py-2 text-right text-green-700">Vol</th>
                <th className="px-3 py-2 text-right text-green-700">OI</th>
                {filter === 'call' && (
                  <>
                    <th className="px-3 py-2 text-right text-green-700">IV%</th>
                    <th className="px-3 py-2 text-right text-green-700">Delta</th>
                    <th className="px-3 py-2 text-right text-green-700">Gamma</th>
                    <th className="px-3 py-2 text-right text-green-700">Theta</th>
                    <th className="px-3 py-2 text-right text-green-700">Vega</th>
                  </>
                )}
              </>
            )}
            {/* Strike in middle for both filter */}
            {filter === 'both' && (
              <th className="px-3 py-2 text-center font-bold bg-gray-200">Strike</th>
            )}
            {(filter === 'both' || filter === 'put') && (
              <>
                <th className="px-3 py-2 text-left text-red-700 border-l-4 border-l-red-500">Last</th>
                <th className="px-3 py-2 text-left text-red-700">Bid</th>
                <th className="px-3 py-2 text-left text-red-700">Ask</th>
                <th className="px-3 py-2 text-right text-red-700">Vol</th>
                <th className="px-3 py-2 text-right text-red-700">OI</th>
                {filter === 'put' && (
                  <>
                    <th className="px-3 py-2 text-right text-red-700">IV%</th>
                    <th className="px-3 py-2 text-right text-red-700">Delta</th>
                    <th className="px-3 py-2 text-right text-red-700">Gamma</th>
                    <th className="px-3 py-2 text-right text-red-700">Theta</th>
                    <th className="px-3 py-2 text-right text-red-700">Vega</th>
                  </>
                )}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {allStrikes.map((strike) => {
            const call = getCallForStrike(strike);
            const put = getPutForStrike(strike);
            const isAtm = strike <= underlyingPrice && (allStrikes[allStrikes.indexOf(strike) + 1] || Infinity) > underlyingPrice;
            const callSelected = isCallSelected(call);
            const putSelected = isPutSelected(put);

            // Base styles for call/put cells
            const callBaseClass = `px-3 py-2 cursor-pointer transition-colors ${
              callSelected ? 'bg-green-100 font-semibold' : 'hover:bg-green-50'
            } ${!call ? 'text-gray-400' : ''}`;

            const putBaseClass = `px-3 py-2 cursor-pointer transition-colors ${
              putSelected ? 'bg-red-100 font-semibold' : 'hover:bg-red-50'
            } ${!put ? 'text-gray-400' : ''}`;

            return (
              <tr
                key={strike}
                ref={isAtmStrike(strike, atmStrike) ? atmRowRef : undefined}
                className={`border-b ${isAtm ? 'bg-yellow-50' : ''}`}
              >
                {/* Strike first when filtering */}
                {filter !== 'both' && (
                  <td className="px-3 py-2 text-center font-semibold bg-gray-50">{formatCurrency(strike)}</td>
                )}
                {(filter === 'both' || filter === 'call') && (
                  <>
                    <td
                      className={`${callBaseClass} border-l-4 ${callSelected ? 'border-l-green-600' : 'border-l-green-300'}`}
                      onClick={(e) => handleOptionClick(call, e)}
                    >
                      {call ? formatCurrency(call.lastPrice) : '-'}
                    </td>
                    <td className={callBaseClass} onClick={(e) => handleOptionClick(call, e)}>
                      {call ? formatCurrency(call.bid) : '-'}
                    </td>
                    <td className={callBaseClass} onClick={(e) => handleOptionClick(call, e)}>
                      {call ? formatCurrency(call.ask) : '-'}
                    </td>
                    <td className={`${callBaseClass} text-right`} onClick={(e) => handleOptionClick(call, e)}>
                      {call ? formatNumber(call.volume) : '-'}
                    </td>
                    <td className={`${callBaseClass} text-right`} onClick={(e) => handleOptionClick(call, e)}>
                      {call ? formatNumber(call.openInterest) : '-'}
                    </td>
                    {filter === 'call' && (
                      <>
                        <td className={`${callBaseClass} text-right`} onClick={(e) => handleOptionClick(call, e)}>
                          {call ? formatPercent(call.impliedVolatility) : '-'}
                        </td>
                        <td className={`${callBaseClass} text-right`} onClick={(e) => handleOptionClick(call, e)}>
                          {call?.delta?.toFixed(3) || '-'}
                        </td>
                        <td className={`${callBaseClass} text-right`} onClick={(e) => handleOptionClick(call, e)}>
                          {call?.gamma?.toFixed(4) || '-'}
                        </td>
                        <td className={`${callBaseClass} text-right`} onClick={(e) => handleOptionClick(call, e)}>
                          {call?.theta?.toFixed(4) || '-'}
                        </td>
                        <td className={`${callBaseClass} text-right`} onClick={(e) => handleOptionClick(call, e)}>
                          {call?.vega?.toFixed(4) || '-'}
                        </td>
                      </>
                    )}
                  </>
                )}
                {/* Strike in middle for both filter */}
                {filter === 'both' && (
                  <td className="px-3 py-2 text-center font-semibold bg-gray-50">{formatCurrency(strike)}</td>
                )}
                {(filter === 'both' || filter === 'put') && (
                  <>
                    <td
                      className={`${putBaseClass} border-l-4 ${putSelected ? 'border-l-red-600' : 'border-l-red-300'}`}
                      onClick={(e) => handleOptionClick(put, e)}
                    >
                      {put ? formatCurrency(put.lastPrice) : '-'}
                    </td>
                    <td className={putBaseClass} onClick={(e) => handleOptionClick(put, e)}>
                      {put ? formatCurrency(put.bid) : '-'}
                    </td>
                    <td className={putBaseClass} onClick={(e) => handleOptionClick(put, e)}>
                      {put ? formatCurrency(put.ask) : '-'}
                    </td>
                    <td className={`${putBaseClass} text-right`} onClick={(e) => handleOptionClick(put, e)}>
                      {put ? formatNumber(put.volume) : '-'}
                    </td>
                    <td className={`${putBaseClass} text-right`} onClick={(e) => handleOptionClick(put, e)}>
                      {put ? formatNumber(put.openInterest) : '-'}
                    </td>
                    {filter === 'put' && (
                      <>
                        <td className={`${putBaseClass} text-right`} onClick={(e) => handleOptionClick(put, e)}>
                          {put ? formatPercent(put.impliedVolatility) : '-'}
                        </td>
                        <td className={`${putBaseClass} text-right`} onClick={(e) => handleOptionClick(put, e)}>
                          {put?.delta?.toFixed(3) || '-'}
                        </td>
                        <td className={`${putBaseClass} text-right`} onClick={(e) => handleOptionClick(put, e)}>
                          {put?.gamma?.toFixed(4) || '-'}
                        </td>
                        <td className={`${putBaseClass} text-right`} onClick={(e) => handleOptionClick(put, e)}>
                          {put?.theta?.toFixed(4) || '-'}
                        </td>
                        <td className={`${putBaseClass} text-right`} onClick={(e) => handleOptionClick(put, e)}>
                          {put?.vega?.toFixed(4) || '-'}
                        </td>
                      </>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Cache Types
// =============================================================================

interface CachedChainData {
  calls: OptionContract[];
  puts: OptionContract[];
  underlyingPrice: number;
  dte: number;
  timestamp: string;
  cachedAt: number; // Unix timestamp for cache age tracking
}

// Cache expiry time: 5 minutes (data freshness for options)
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

// =============================================================================
// Main Component
// =============================================================================

export default function ChainAnalysisPage() {
  // State
  const [ticker, setTicker] = useState('');
  const [expirations, setExpirations] = useState<string[]>([]);
  const [selectedExpiration, setSelectedExpiration] = useState('');
  const [underlyingPrice, setUnderlyingPrice] = useState(0);
  const [calls, setCalls] = useState<OptionContract[]>([]);
  const [puts, setPuts] = useState<OptionContract[]>([]);
  const [dte, setDte] = useState(0);
  const [chainTimestamp, setChainTimestamp] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('both');
  const [selectedOption, setSelectedOption] = useState<OptionContract | undefined>();
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false); // Track if data was loaded from cache

  // Loading & Error states
  const [isLoadingExpirations, setIsLoadingExpirations] = useState(false);
  const [isLoadingChain, setIsLoadingChain] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Client-side cache for options chain data (keyed by "ticker:expiration")
  const chainCacheRef = useRef<Map<string, CachedChainData>>(new Map());

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

  // Fetch expirations when ticker is submitted
  const fetchExpirations = useCallback(async () => {
    if (!ticker || ticker.length < 1 || ticker.length > 5) return;

    setIsLoadingExpirations(true);
    setError(undefined);
    setExpirations([]);
    setSelectedExpiration('');
    setCalls([]);
    setPuts([]);
    setSelectedOption(undefined);
    clearContext();

    try {
      const response = await fetch(`/api/chain/expirations/${ticker}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch expirations');
      }

      const data: ExpirationResponse = await response.json();
      setExpirations(data.expirations);
      setUnderlyingPrice(data.underlying_price);

      if (data.expirations.length === 0) {
        setError('No expiry dates available for this stock.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid ticker or no data found');
    } finally {
      setIsLoadingExpirations(false);
    }
  }, [ticker, clearContext]);

  // Helper to get cache key
  const getCacheKey = useCallback((t: string, exp: string) => `${t}:${exp}`, []);

  // Helper to check if cache is valid (not expired)
  const isCacheValid = useCallback((cachedData: CachedChainData) => {
    return Date.now() - cachedData.cachedAt < CACHE_EXPIRY_MS;
  }, []);

  // Fetch options chain when expiration is selected (with caching)
  const fetchChain = useCallback(async (forceRefresh = false) => {
    if (!ticker || !selectedExpiration) return;

    const cacheKey = getCacheKey(ticker, selectedExpiration);
    const cachedData = chainCacheRef.current.get(cacheKey);

    // Use cached data if available, valid, and not forcing refresh
    if (!forceRefresh && cachedData && isCacheValid(cachedData)) {
      setCalls(cachedData.calls);
      setPuts(cachedData.puts);
      setDte(cachedData.dte);
      setUnderlyingPrice(cachedData.underlyingPrice);
      setChainTimestamp(cachedData.timestamp);
      setIsFromCache(true);
      return;
    }

    setIsLoadingChain(true);
    setError(undefined);

    try {
      const response = await fetch(`/api/chain/options/${ticker}/${selectedExpiration}?include_greeks=true`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch options chain');
      }

      const data: OptionsChainResponse = await response.json();
      const convertedCalls = data.calls.map(convertApiContract);
      const convertedPuts = data.puts.map(convertApiContract);

      // Update state
      setCalls(convertedCalls);
      setPuts(convertedPuts);
      setDte(data.dte);
      setUnderlyingPrice(data.underlying_price);
      setChainTimestamp(data.timestamp);
      setIsFromCache(false);

      // Store in cache
      chainCacheRef.current.set(cacheKey, {
        calls: convertedCalls,
        puts: convertedPuts,
        underlyingPrice: data.underlying_price,
        dte: data.dte,
        timestamp: data.timestamp,
        cachedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options chain');
    } finally {
      setIsLoadingChain(false);
    }
  }, [ticker, selectedExpiration, getCacheKey, isCacheValid]);

  // Auto-fetch when expiration date changes
  useEffect(() => {
    if (ticker && selectedExpiration) {
      fetchChain();
    }
  }, [selectedExpiration]); // Only trigger on expiration change

  // Update context when option is selected
  useEffect(() => {
    if (selectedOption && ticker && underlyingPrice) {
      // Calculate breakeven price
      const breakeven = selectedOption.optionType === 'call'
        ? selectedOption.strike + selectedOption.lastPrice
        : selectedOption.strike - selectedOption.lastPrice;

      // Calculate distance to breakeven as percentage
      const distToBreakeven = ((breakeven - underlyingPrice) / underlyingPrice) * 100;

      // Calculate annualized hurdle rate (how much the stock needs to move per year to break even)
      const hurdleRate = dte > 0 ? distToBreakeven * (365 / dte) : undefined;

      // Calculate total premiums across all strikes
      // Premium = OpenInterest * ((Bid + Ask) / 2) * 100 (contract multiplier)
      const totalCallPremium = calls.reduce((sum, call) => {
        const midPrice = ((call.bid || 0) + (call.ask || 0)) / 2;
        return sum + (call.openInterest || 0) * midPrice * 100;
      }, 0);

      const totalPutPremium = puts.reduce((sum, put) => {
        const midPrice = ((put.bid || 0) + (put.ask || 0)) / 2;
        return sum + (put.openInterest || 0) * midPrice * 100;
      }, 0);

      // Extract OI data for histogram (sorted by strike price)
      const callOiData = calls
        .map(c => ({ strike: c.strike, openInterest: c.openInterest || 0 }))
        .sort((a, b) => a.strike - b.strike);

      const putOiData = puts
        .map(p => ({ strike: p.strike, openInterest: p.openInterest || 0 }))
        .sort((a, b) => a.strike - b.strike);

      // Combine calls and puts for Battle Mode (sorted by proximity to ATM)
      const availableOptions = [...calls, ...puts].sort(
        (a, b) => Math.abs(a.strike - underlyingPrice) - Math.abs(b.strike - underlyingPrice)
      );

      const metadata: ChainAnalysisMetadata = {
        symbol: ticker,
        underlyingPrice,
        expiration: selectedExpiration,
        dte,
        selectedOption,
        optionType: selectedOption.optionType,
        breakeven,
        maxLoss: selectedOption.lastPrice * 100,
        leverage: selectedOption.delta
          ? (selectedOption.delta * underlyingPrice * 100) / (selectedOption.lastPrice * 100)
          : undefined,
        stockEquivalent: selectedOption.delta
          ? selectedOption.delta * 100 * underlyingPrice
          : undefined,
        hurdleRate,
        distToBreakeven,
        totalCallPremium,
        totalPutPremium,
        callOiData,
        putOiData,
        availableOptions,
      };

      const context = createChainAnalysisContext(metadata);
      setCurrentContext(context.page, context.contextType, metadata);
      setShowAiPanel(true);
    }
  }, [selectedOption, ticker, underlyingPrice, selectedExpiration, dte, calls, puts, setCurrentContext]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <Navigation subtitle="Options Chain Analysis" />

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
        {/* Controls Section */}
        <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <TickerInput
              value={ticker}
              onChange={setTicker}
              onSubmit={fetchExpirations}
              isLoading={isLoadingExpirations}
              error={error && !expirations.length ? error : undefined}
            />

            <ExpirationDropdown
              expirations={expirations}
              selected={selectedExpiration}
              onSelect={setSelectedExpiration}
              disabled={expirations.length === 0 || isLoadingExpirations}
            />

            <button
              onClick={() => fetchChain(true)}
              disabled={!ticker || !selectedExpiration || isLoadingChain}
              className="h-9 px-4 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              title="Refresh data (bypasses cache)"
            >
              {isLoadingChain ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </span>
              )}
            </button>

            {/* Underlying Price Display - inline with controls */}
            {underlyingPrice > 0 && (
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-base font-bold text-gray-900">{ticker}</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(underlyingPrice)}</span>
                {dte > 0 && (
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-sm text-gray-600">
                    {dte} DTE
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Options Chain Section */}
        {(calls.length > 0 || puts.length > 0) && (
          <div>
            {/* Options Table */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Options Chain</h2>
                  {chainTimestamp && (
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      Updated: {formatTimestamp(chainTimestamp)}
                      {isFromCache && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded" title="Data loaded from cache">
                          Cached
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <FilterButtons filter={filter} onFilterChange={setFilter} />
              </div>

              {/* Conditionally render OI Chart or Options Table based on filter */}
              {filter === 'oi_chart' ? (
                <div className="p-4">
                  <PremiumSummaryBar calls={calls} puts={puts} isMobile={isMobile} />
                  <OIMirrorBarChart
                    data={transformOiChartData(
                      calls.map(c => ({ strike: c.strike, openInterest: c.openInterest || 0 })),
                      puts.map(p => ({ strike: p.strike, openInterest: p.openInterest || 0 }))
                    )}
                    underlyingPrice={underlyingPrice}
                    isMobile={isMobile}
                  />
                </div>
              ) : (
                <OptionsTable
                  calls={calls}
                  puts={puts}
                  underlyingPrice={underlyingPrice}
                  filter={filter}
                  onSelectOption={setSelectedOption}
                  selectedOption={selectedOption}
                  isMobile={isMobile}
                />
              )}
            </div>
          </div>
        )}

        {/* Loading State for Chain */}
        {isLoadingChain && (
          <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
            <svg className="animate-spin h-8 w-8 mx-auto text-blue-600 mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-600">Loading options chain...</p>
          </div>
        )}

        {/* Error State */}
        {error && calls.length === 0 && puts.length === 0 && !isLoadingChain && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoadingExpirations && !isLoadingChain && calls.length === 0 && puts.length === 0 && !error && (
          <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Started</h3>
            <p className="text-gray-600">
              Enter a stock ticker above and select an expiration date to view the options chain.
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

      {/* Chatless AI Insights Panel - sits next to content */}
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
                <p className="text-blue-100 text-xs">OptChain Insight Engine</p>
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
