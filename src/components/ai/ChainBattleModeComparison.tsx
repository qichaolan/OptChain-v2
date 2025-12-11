'use client';

/**
 * Chain Battle Mode Comparison Component
 *
 * Specialized comparison tool for chain analysis page with large volumes.
 * Features smart filtering, search, and sorting for better UX.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useOptionChain } from '@/contexts';
import { OptionContract, ChainAnalysisMetadata } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ContractForComparison {
  contractSymbol: string;
  optionType: 'call' | 'put';
  strike: number;
  premium: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  iv?: number;
  expiration: string;
  breakeven?: number;
  openInterest?: number;
  volume?: number;
}

interface BattleResult {
  battle_summary: {
    winner_id: string;
    winning_category: string;
    verdict_text: string;
  };
  tale_of_the_tape: Array<{
    metric: string;
    winner: 'A' | 'B';
    explanation: string;
  }>;
  badges: {
    contract_a_badge: string;
    contract_b_badge: string;
  };
  disclaimer: string;
}

interface ChainBattleModeComparisonProps {
  className?: string;
}

// ============================================================================
// Contract Selector for Chain Options
// ============================================================================

function ChainContractSelector({
  label,
  selectedContract,
  onSelect,
  availableOptions,
  excludeSymbol,
  underlyingPrice,
}: {
  label: string;
  selectedContract: ContractForComparison | null;
  onSelect: (contract: ContractForComparison | null) => void;
  availableOptions: OptionContract[];
  excludeSymbol?: string;
  underlyingPrice: number;
}) {
  const [filterType, setFilterType] = useState<'all' | 'call' | 'put'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'strike' | 'oi' | 'atm'>('atm');
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter and sort options
  const filteredOptions = useMemo(() => {
    let options = availableOptions.filter(o => o.contractSymbol !== excludeSymbol);

    // Filter by type
    if (filterType !== 'all') {
      options = options.filter(o => o.optionType === filterType);
    }

    // Filter by search (strike or contract symbol)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      options = options.filter(
        o =>
          o.strike.toString().includes(query) ||
          o.contractSymbol.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'strike':
        options = [...options].sort((a, b) => a.strike - b.strike);
        break;
      case 'oi':
        options = [...options].sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0));
        break;
      case 'atm':
        options = [...options].sort(
          (a, b) =>
            Math.abs(a.strike - underlyingPrice) - Math.abs(b.strike - underlyingPrice)
        );
        break;
    }

    // Limit to top 50 for performance
    return options.slice(0, 50);
  }, [availableOptions, excludeSymbol, filterType, searchQuery, sortBy, underlyingPrice]);

  const handleSelect = (option: OptionContract) => {
    const breakeven =
      option.optionType === 'call'
        ? option.strike + option.lastPrice
        : option.strike - option.lastPrice;

    onSelect({
      contractSymbol: option.contractSymbol,
      optionType: option.optionType,
      strike: option.strike,
      premium: option.lastPrice,
      delta: option.delta,
      gamma: option.gamma,
      theta: option.theta,
      iv: option.impliedVolatility,
      expiration: option.expiration,
      breakeven,
      openInterest: option.openInterest,
      volume: option.volume,
    });
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelect(null);
    setSearchQuery('');
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {selectedContract && (
          <button
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {selectedContract ? (
        <div className="bg-white rounded border border-gray-200 p-2">
          <div className="flex items-center justify-between">
            <div>
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  selectedContract.optionType === 'call'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {selectedContract.optionType.toUpperCase()}
              </span>
              <span className="ml-2 font-medium">${selectedContract.strike}</span>
            </div>
            <span className="text-sm text-gray-600">${selectedContract.premium.toFixed(2)}</span>
          </div>
          {selectedContract.delta && (
            <div className="mt-1 text-xs text-gray-500">
              Δ {selectedContract.delta.toFixed(2)} | OI: {selectedContract.openInterest?.toLocaleString() || '-'}
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-400 transition-colors"
          >
            Select an option...
          </button>

          {showDropdown && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
              {/* Search and Filters */}
              <div className="p-2 border-b border-gray-100 space-y-2">
                <input
                  type="text"
                  placeholder="Search strike or symbol..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex gap-1">
                  {(['all', 'call', 'put'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`flex-1 px-2 py-1 text-xs rounded ${
                        filterType === type
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {type === 'all' ? 'All' : type === 'call' ? 'Calls' : 'Puts'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {([
                    { key: 'atm', label: 'Near ATM' },
                    { key: 'oi', label: 'By OI' },
                    { key: 'strike', label: 'By Strike' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setSortBy(key)}
                      className={`flex-1 px-2 py-1 text-xs rounded ${
                        sortBy === key
                          ? 'bg-violet-100 text-violet-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options List */}
              <div className="max-h-48 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <div className="p-3 text-center text-sm text-gray-500">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map(option => (
                    <button
                      key={option.contractSymbol}
                      onClick={() => handleSelect(option)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            option.optionType === 'call'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {option.optionType === 'call' ? 'C' : 'P'}
                        </span>
                        <span className="font-medium text-sm">${option.strike}</span>
                        {option.delta && (
                          <span className="text-xs text-gray-500">
                            Δ{option.delta.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">${option.lastPrice.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">
                          OI: {(option.openInterest || 0).toLocaleString()}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Battle Result Display
// ============================================================================

function BattleResultDisplay({
  result,
  contractA,
  contractB,
}: {
  result: BattleResult;
  contractA: ContractForComparison;
  contractB: ContractForComparison;
}) {
  const getWinnerColor = (winner: 'A' | 'B') =>
    winner === 'A' ? 'text-blue-600' : 'text-purple-600';

  return (
    <div className="space-y-4">
      {/* Winner Summary */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🏆</span>
          <span className="font-bold text-lg text-amber-800">
            {result.battle_summary.winner_id === 'A'
              ? `$${contractA.strike} ${contractA.optionType.toUpperCase()}`
              : `$${contractB.strike} ${contractB.optionType.toUpperCase()}`}{' '}
            Wins!
          </span>
        </div>
        <p className="text-sm text-amber-700">{result.battle_summary.verdict_text}</p>
        <div className="mt-2 text-xs text-amber-600">
          Category: {result.battle_summary.winning_category}
        </div>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-xs text-blue-600 font-medium mb-1">Contract A Badge</div>
          <div className="text-lg">{result.badges.contract_a_badge}</div>
          <div className="text-xs text-gray-600 mt-1">
            ${contractA.strike} {contractA.optionType.toUpperCase()}
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <div className="text-xs text-purple-600 font-medium mb-1">Contract B Badge</div>
          <div className="text-lg">{result.badges.contract_b_badge}</div>
          <div className="text-xs text-gray-600 mt-1">
            ${contractB.strike} {contractB.optionType.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Tale of the Tape */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">⚔️ Tale of the Tape</span>
        </div>
        <div className="divide-y divide-gray-100">
          {result.tale_of_the_tape.map((item, index) => (
            <div key={index} className="px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{item.metric}</span>
                <span className={`text-xs font-bold ${getWinnerColor(item.winner)}`}>
                  {item.winner === 'A' ? 'Contract A' : 'Contract B'}
                </span>
              </div>
              <p className="text-xs text-gray-600">{item.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-gray-500 italic bg-gray-50 rounded p-2">
        {result.disclaimer}
      </div>
    </div>
  );
}

// ============================================================================
// Fallback Result Generator
// ============================================================================

function generateFallbackResult(
  contractA: ContractForComparison,
  contractB: ContractForComparison,
  aiText: string
): BattleResult {
  // Determine winner based on simple metrics
  const aScore =
    (contractA.delta ? Math.abs(contractA.delta) : 0) * 100 +
    (contractA.openInterest || 0) / 1000;
  const bScore =
    (contractB.delta ? Math.abs(contractB.delta) : 0) * 100 +
    (contractB.openInterest || 0) / 1000;

  const winnerId = aScore >= bScore ? 'A' : 'B';
  const winner = winnerId === 'A' ? contractA : contractB;

  return {
    battle_summary: {
      winner_id: winnerId,
      winning_category: 'Overall',
      verdict_text:
        aiText ||
        `$${winner.strike} ${winner.optionType.toUpperCase()} shows stronger market characteristics.`,
    },
    tale_of_the_tape: [
      {
        metric: 'Delta (Directional Exposure)',
        winner: Math.abs(contractA.delta || 0) >= Math.abs(contractB.delta || 0) ? 'A' : 'B',
        explanation: `Higher delta means more exposure to price movement.`,
      },
      {
        metric: 'Open Interest (Liquidity)',
        winner: (contractA.openInterest || 0) >= (contractB.openInterest || 0) ? 'A' : 'B',
        explanation: `More OI indicates better liquidity and tighter spreads.`,
      },
      {
        metric: 'Premium Efficiency',
        winner:
          contractA.premium / (Math.abs(contractA.delta || 0.01) + 0.01) <=
          contractB.premium / (Math.abs(contractB.delta || 0.01) + 0.01)
            ? 'A'
            : 'B',
        explanation: `Lower premium per delta point is more efficient.`,
      },
    ],
    badges: {
      contract_a_badge:
        contractA.optionType === 'call' ? '📈 Bullish Play' : '📉 Bearish Hedge',
      contract_b_badge:
        contractB.optionType === 'call' ? '📈 Bullish Play' : '📉 Bearish Hedge',
    },
    disclaimer:
      'This comparison is for educational purposes only and should not be considered financial advice.',
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function ChainBattleModeComparison({
  className = '',
}: ChainBattleModeComparisonProps) {
  const { currentMetadata, currentPage } = useOptionChain();
  const [contractA, setContractA] = useState<ContractForComparison | null>(null);
  const [contractB, setContractB] = useState<ContractForComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chainMetadata = currentMetadata as ChainAnalysisMetadata | null;

  // Get available options from metadata
  const availableOptions = useMemo(() => {
    if (!chainMetadata?.availableOptions) return [];
    return chainMetadata.availableOptions;
  }, [chainMetadata]);

  const underlyingPrice = chainMetadata?.underlyingPrice || 100;

  // Run comparison
  const runComparison = useCallback(async () => {
    if (!contractA || !contractB || !chainMetadata) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/copilotkit/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: currentPage || 'chain_analysis',
          contextType: 'chain_analysis',
          metadata: {
            ...chainMetadata,
            comparison: {
              contractA: {
                symbol: contractA.contractSymbol,
                optionType: contractA.optionType,
                strike: contractA.strike,
                premium: contractA.premium,
                breakeven: contractA.breakeven,
                delta: contractA.delta,
                gamma: contractA.gamma,
                theta: contractA.theta,
                openInterest: contractA.openInterest,
              },
              contractB: {
                symbol: contractB.contractSymbol,
                optionType: contractB.optionType,
                strike: contractB.strike,
                premium: contractB.premium,
                breakeven: contractB.breakeven,
                delta: contractB.delta,
                gamma: contractB.gamma,
                theta: contractB.theta,
                openInterest: contractB.openInterest,
              },
            },
          },
          microAction: {
            type: 'generic.summarize_selection',
            prompt: `Compare these two options contracts in battle mode format. Contract A is a $${contractA.strike} ${contractA.optionType} and Contract B is a $${contractB.strike} ${contractB.optionType}. Analyze which is better for different trading scenarios.`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get comparison');
      }

      const data = await response.json();

      // Try to parse JSON from response
      let parsedResult: BattleResult;
      try {
        const responseText =
          typeof data.response === 'string'
            ? data.response
            : JSON.stringify(data.response);
        const jsonMatch =
          responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
          responseText.match(/```\s*([\s\S]*?)\s*```/) ||
          [null, responseText];
        parsedResult = JSON.parse(jsonMatch[1] || responseText);
      } catch {
        // Fallback if parsing fails
        parsedResult = generateFallbackResult(contractA, contractB, data.response);
      }

      setResult(parsedResult);
    } catch (err) {
      console.error('Comparison error:', err);
      setError('Failed to compare options. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [contractA, contractB, chainMetadata, currentPage]);

  // Reset when contracts change
  const handleContractAChange = (contract: ContractForComparison | null) => {
    setContractA(contract);
    setResult(null);
    setError(null);
  };

  const handleContractBChange = (contract: ContractForComparison | null) => {
    setContractB(contract);
    setResult(null);
    setError(null);
  };

  const canCompare = contractA && contractB && !isLoading;

  if (!chainMetadata || availableOptions.length === 0) {
    return (
      <div className={`${className} p-4 text-center text-gray-500`}>
        <p className="text-sm">Select an option from the chain to enable Battle Mode.</p>
        <p className="text-xs mt-1 text-gray-400">
          Compare any two options to see which fits your strategy better.
        </p>
      </div>
    );
  }

  return (
    <div className={`${className} space-y-4`}>
      {/* Header */}
      <div className="text-center">
        <h3 className="text-sm font-bold text-gray-800 flex items-center justify-center gap-2">
          <span>⚔️</span>
          <span>Options Battle Mode</span>
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Compare two options head-to-head
        </p>
      </div>

      {/* Contract Selectors */}
      <div className="grid grid-cols-1 gap-3">
        <ChainContractSelector
          label="🅰️ Contract A"
          selectedContract={contractA}
          onSelect={handleContractAChange}
          availableOptions={availableOptions}
          excludeSymbol={contractB?.contractSymbol}
          underlyingPrice={underlyingPrice}
        />

        <div className="flex justify-center">
          <span className="text-lg">⚡</span>
        </div>

        <ChainContractSelector
          label="🅱️ Contract B"
          selectedContract={contractB}
          onSelect={handleContractBChange}
          availableOptions={availableOptions}
          excludeSymbol={contractA?.contractSymbol}
          underlyingPrice={underlyingPrice}
        />
      </div>

      {/* Compare Button */}
      <button
        onClick={runComparison}
        disabled={!canCompare}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
          canCompare
            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Analyzing...</span>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span>⚔️</span>
            <span>Start Battle</span>
          </span>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && contractA && contractB && (
        <BattleResultDisplay
          result={result}
          contractA={contractA}
          contractB={contractB}
        />
      )}
    </div>
  );
}

export default ChainBattleModeComparison;
