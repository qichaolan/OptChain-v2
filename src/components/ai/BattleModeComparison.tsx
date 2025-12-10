'use client';

/**
 * Battle Mode Comparison Component
 *
 * Side-by-side "Tale of the Tape" comparison for LEAPS contracts.
 * Gamifies the selection process by highlighting which contract is better
 * for different use cases (safety vs. aggressive growth).
 *
 * Supports:
 * - Dropdown selection from available contracts (when provided)
 * - Manual strike/premium input as fallback
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useOptionChain } from '@/contexts';
import { LeapsMetadata, LeapsContract } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ContractForComparison {
  strike: number;
  premium: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  iv?: number;
  expiration: string;
  breakeven?: number;
  leverageRatio?: number;
  contractSymbol?: string;
}

export interface BattleResult {
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

interface BattleModeComparisonProps {
  className?: string;
}

// ============================================================================
// Contract Selector Component (Dropdown + Manual Input)
// ============================================================================

function ContractSelector({
  label,
  selectedContract,
  onSelect,
  availableContracts,
  excludeStrike,
  baseMetadata,
}: {
  label: string;
  selectedContract: ContractForComparison | null;
  onSelect: (contract: ContractForComparison | null) => void;
  availableContracts: LeapsContract[];
  excludeStrike?: number;
  baseMetadata: LeapsMetadata | null;
}) {
  const [manualMode, setManualMode] = useState(false);
  const [manualStrike, setManualStrike] = useState('');
  const [manualPremium, setManualPremium] = useState('');

  // Filter out the excluded strike (the other contract's selection)
  const filteredContracts = useMemo(() => {
    return availableContracts.filter(c => c.strike !== excludeStrike);
  }, [availableContracts, excludeStrike]);

  const handleDropdownSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const strike = parseFloat(e.target.value);
    if (isNaN(strike)) {
      onSelect(null);
      return;
    }

    const contract = availableContracts.find(c => c.strike === strike);
    if (contract) {
      const underlyingPrice = baseMetadata?.underlyingPrice || 100;
      onSelect({
        strike: contract.strike,
        premium: contract.premium,
        delta: contract.delta,
        gamma: contract.gamma,
        theta: contract.theta,
        iv: contract.impliedVolatility,
        expiration: contract.expiration,
        breakeven: contract.strike + contract.premium,
        leverageRatio: underlyingPrice / (contract.premium * 100),
        contractSymbol: contract.contractSymbol,
      });
    }
  };

  const handleManualApply = () => {
    if (manualStrike && manualPremium) {
      const strikeNum = parseFloat(manualStrike);
      const premiumNum = parseFloat(manualPremium);
      const underlyingPrice = baseMetadata?.underlyingPrice || 100;

      onSelect({
        strike: strikeNum,
        premium: premiumNum,
        expiration: baseMetadata?.contract?.expiration || '',
        breakeven: strikeNum + premiumNum,
        leverageRatio: underlyingPrice / (premiumNum * 100),
        delta: strikeNum <= underlyingPrice ? 0.7 : 0.4,
        iv: baseMetadata?.contract?.impliedVolatility,
      });
    }
  };

  const handleClear = () => {
    onSelect(null);
    setManualStrike('');
    setManualPremium('');
  };

  const hasAvailableContracts = availableContracts.length > 0;

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
        /* Selected Contract Display */
        <div className="text-sm">
          <div className="font-bold text-gray-800">${selectedContract.strike} Strike</div>
          <div className="text-gray-600">Premium: ${selectedContract.premium.toFixed(2)}</div>
          <div className="text-gray-500 text-xs flex justify-between mt-1">
            <span>BE: ${selectedContract.breakeven?.toFixed(2)}</span>
            {selectedContract.delta && <span>Delta: {selectedContract.delta.toFixed(2)}</span>}
          </div>
        </div>
      ) : hasAvailableContracts && !manualMode ? (
        /* Dropdown Selection */
        <div className="space-y-2">
          <select
            onChange={handleDropdownSelect}
            className="w-full px-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            defaultValue=""
          >
            <option value="" disabled>Select a contract...</option>
            {filteredContracts.map((contract) => (
              <option key={contract.strike} value={contract.strike}>
                ${contract.strike} Strike — ${contract.premium.toFixed(2)} premium
                {contract.delta ? ` (Δ${contract.delta.toFixed(2)})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setManualMode(true)}
            className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
          >
            Or enter manually
          </button>
        </div>
      ) : (
        /* Manual Input */
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Strike"
              value={manualStrike}
              onChange={(e) => setManualStrike(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
            <input
              type="number"
              placeholder="Premium"
              value={manualPremium}
              onChange={(e) => setManualPremium(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            onClick={handleManualApply}
            disabled={!manualStrike || !manualPremium}
            className="w-full py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Set Contract
          </button>
          {hasAvailableContracts && (
            <button
              onClick={() => setManualMode(false)}
              className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
            >
              Back to dropdown
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tale of the Tape Metric Row
// ============================================================================

function TapeMetricRow({
  metric,
  winner,
  explanation,
}: {
  metric: string;
  winner: 'A' | 'B';
  explanation: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        winner === 'A' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
      }`}>
        {winner}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-800">{metric}</div>
        <div className="text-xs text-gray-500">{explanation}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BattleModeComparison({ className = '' }: BattleModeComparisonProps) {
  const { currentMetadata, currentPage } = useOptionChain();
  const [contractA, setContractA] = useState<ContractForComparison | null>(null);
  const [contractB, setContractB] = useState<ContractForComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leapsMetadata = currentMetadata as LeapsMetadata | null;

  // Get available contracts from metadata or create from current contract
  const availableContracts = useMemo(() => {
    if (leapsMetadata?.availableContracts && leapsMetadata.availableContracts.length > 0) {
      return leapsMetadata.availableContracts;
    }
    // If no availableContracts, just use the current contract as option
    if (leapsMetadata?.contract) {
      return [leapsMetadata.contract];
    }
    return [];
  }, [leapsMetadata]);

  // Run comparison
  const runComparison = useCallback(async () => {
    if (!contractA || !contractB || !leapsMetadata) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/copilotkit/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: currentPage || 'leaps_ranker',
          contextType: 'roi_simulator',
          metadata: {
            ...leapsMetadata,
            comparison: {
              contractA: {
                strike: contractA.strike,
                premium: contractA.premium,
                breakeven: contractA.breakeven,
                delta: contractA.delta,
                gamma: contractA.gamma,
                theta: contractA.theta,
                leverageRatio: contractA.leverageRatio,
              },
              contractB: {
                strike: contractB.strike,
                premium: contractB.premium,
                breakeven: contractB.breakeven,
                delta: contractB.delta,
                gamma: contractB.gamma,
                theta: contractB.theta,
                leverageRatio: contractB.leverageRatio,
              },
            },
          },
          microAction: {
            type: 'leaps.compare_contracts',
            prompt: 'Compare these two LEAPS contracts in battle mode format.',
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
        // The response might be JSON string or already parsed
        const responseText = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
        // Extract JSON from possible markdown code blocks
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                          responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                          [null, responseText];
        parsedResult = JSON.parse(jsonMatch[1] || responseText);
      } catch {
        // Fallback to generated result if parsing fails
        parsedResult = generateFallbackResult(contractA, contractB, data.response, leapsMetadata);
      }

      setResult(parsedResult);
    } catch (err) {
      console.error('Comparison error:', err);
      setError('Failed to compare contracts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [contractA, contractB, leapsMetadata, currentPage]);

  // Generate fallback result if AI response isn't properly formatted
  const generateFallbackResult = (
    a: ContractForComparison,
    b: ContractForComparison,
    aiResponse: string,
    metadata: LeapsMetadata
  ): BattleResult => {
    const aIsDeeper = a.strike < b.strike;
    const winner = aIsDeeper ? 'A' : 'B';

    return {
      battle_summary: {
        winner_id: `Contract ${winner}`,
        winning_category: 'Highest Probability of Profit',
        verdict_text: aiResponse || `Contract ${winner} offers better risk-adjusted returns with a lower breakeven hurdle.`,
      },
      tale_of_the_tape: [
        {
          metric: "Cost Efficiency ('Rent')",
          winner: a.premium < b.premium ? 'A' : 'B',
          explanation: `$${a.premium.toFixed(2)} vs $${b.premium.toFixed(2)} premium`,
        },
        {
          metric: 'Breakeven Difficulty',
          winner: (a.breakeven || 0) < (b.breakeven || 0) ? 'A' : 'B',
          explanation: `$${a.breakeven?.toFixed(2)} vs $${b.breakeven?.toFixed(2)}`,
        },
        {
          metric: 'Delta (Safety)',
          winner: (a.delta || 0) > (b.delta || 0) ? 'A' : 'B',
          explanation: `${a.delta?.toFixed(2) || 'N/A'} vs ${b.delta?.toFixed(2) || 'N/A'}`,
        },
      ],
      badges: {
        contract_a_badge: aIsDeeper ? '🛡️ The Fortress' : '🚀 Moonshot',
        contract_b_badge: !aIsDeeper ? '🛡️ The Fortress' : '🚀 Moonshot',
      },
      disclaimer: 'Educational comparison only. Not financial advice.',
    };
  };

  const bothSet = contractA && contractB;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">Battle Mode</span>
        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
          Compare Contracts
        </span>
      </div>

      {/* Instructions */}
      {availableContracts.length > 1 ? (
        <p className="text-xs text-gray-500">
          Select two contracts from the dropdown to compare them head-to-head.
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          Enter strike and premium for two contracts to compare.
        </p>
      )}

      {/* Contract Selectors */}
      <div className="grid grid-cols-2 gap-3">
        <ContractSelector
          label="Contender A"
          selectedContract={contractA}
          onSelect={setContractA}
          availableContracts={availableContracts}
          excludeStrike={contractB?.strike}
          baseMetadata={leapsMetadata}
        />
        <ContractSelector
          label="Contender B"
          selectedContract={contractB}
          onSelect={setContractB}
          availableContracts={availableContracts}
          excludeStrike={contractA?.strike}
          baseMetadata={leapsMetadata}
        />
      </div>

      {/* Compare Button */}
      {bothSet && (
        <button
          onClick={runComparison}
          disabled={isLoading}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <span>Compare</span>
              <span>VS</span>
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* VS Header */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 text-center">
              <div className="text-sm text-gray-500">{result.badges.contract_a_badge}</div>
              <div className="text-lg font-bold text-blue-600">${contractA?.strike}</div>
            </div>
            <div className="bg-gray-800 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              VS
            </div>
            <div className="flex-1 text-center">
              <div className="text-sm text-gray-500">{result.badges.contract_b_badge}</div>
              <div className="text-lg font-bold text-purple-600">${contractB?.strike}</div>
            </div>
          </div>

          {/* Tale of the Tape */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Tale of the Tape</h4>
            <div className="space-y-1">
              {result.tale_of_the_tape.map((row, i) => (
                <TapeMetricRow
                  key={i}
                  metric={row.metric}
                  winner={row.winner}
                  explanation={row.explanation}
                />
              ))}
            </div>
          </div>

          {/* Winner Announcement */}
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🏆</span>
              <span className="font-bold text-lg">{result.battle_summary.winner_id}</span>
            </div>
            <div className="text-xs text-yellow-700 font-medium mb-1">
              {result.battle_summary.winning_category}
            </div>
            <p className="text-sm text-gray-700">{result.battle_summary.verdict_text}</p>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-gray-400 text-center italic">
            {result.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}

export default BattleModeComparison;
