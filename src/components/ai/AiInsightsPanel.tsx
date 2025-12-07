'use client';

/**
 * AI Insights Panel
 *
 * Displays structured AI analysis results.
 * Renders different sections based on the page type.
 */

import React, { useMemo } from 'react';
import { useAiExplainer } from '@/hooks';
import { useOptionChain } from '@/contexts';
import { AiExplainerContent, KeyInsight, RiskItem, WatchItem } from '@/types/ai-response';
import { sanitizeAiResponse } from '@/lib/sanitize';

// ============================================================================
// Sub-components
// ============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="mt-4 text-gray-600">Analyzing your simulation...</p>
      <p className="text-sm text-gray-400">This may take a few seconds</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-4xl mb-4">⚠️</span>
      <p className="text-red-600 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function InsightCard({ insight }: { insight: KeyInsight }) {
  const sentimentColors = {
    positive: 'border-l-green-500 bg-green-50',
    neutral: 'border-l-gray-400 bg-gray-50',
    negative: 'border-l-red-500 bg-red-50',
  };

  const sentimentIcons = {
    positive: '▲',
    neutral: '●',
    negative: '▼',
  };

  return (
    <div className={`border-l-4 p-3 rounded-r-lg ${sentimentColors[insight.sentiment]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs ${
          insight.sentiment === 'positive' ? 'text-green-600' :
          insight.sentiment === 'negative' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {sentimentIcons[insight.sentiment]}
        </span>
        <strong className="text-sm font-semibold">{insight.title}</strong>
      </div>
      <p className="text-sm text-gray-700">{insight.description}</p>
    </div>
  );
}

function RiskCard({ risk }: { risk: RiskItem }) {
  const severityColors = {
    low: 'bg-yellow-100 text-yellow-800',
    medium: 'bg-orange-100 text-orange-800',
    high: 'bg-red-100 text-red-800',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${severityColors[risk.severity]}`}>
        {risk.severity.toUpperCase()}
      </span>
      <p className="text-sm text-gray-700">{risk.risk}</p>
    </div>
  );
}

function WatchItemCard({ item }: { item: WatchItem }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
      <span className="text-lg">👁️</span>
      <div>
        <p className="text-sm font-medium text-gray-800">{item.item}</p>
        {item.trigger && (
          <p className="text-xs text-gray-500 mt-1">Trigger: {item.trigger}</p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
        {title}
      </h5>
      {children}
    </div>
  );
}

// ============================================================================
// Main Content Renderer
// ============================================================================

function ContentRenderer({ content }: { content: AiExplainerContent }) {
  return (
    <div className="space-y-6">
      {/* Strategy Name (if available) */}
      {content.strategyName && (
        <div className="text-lg font-bold text-primary-700 mb-2">
          {content.strategyName}
        </div>
      )}

      {/* Summary */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-gray-700">{content.summary}</p>
      </div>

      {/* Trade Mechanics (Credit Spreads / Iron Condors) */}
      {content.tradeMechanics && (
        <Section title="📋 Trade Mechanics">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Structure:</span>
              <div className="font-medium">{content.tradeMechanics.structure}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Credit:</span>
              <div className="font-medium text-green-600">{content.tradeMechanics.creditReceived}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Margin:</span>
              <div className="font-medium">{content.tradeMechanics.marginRequirement}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Breakeven:</span>
              <div className="font-medium">{content.tradeMechanics.breakeven || content.tradeMechanics.breakevens}</div>
            </div>
          </div>
        </Section>
      )}

      {/* Key Metrics */}
      {content.keyMetrics && (
        <Section title="📊 Key Metrics">
          <div className="grid grid-cols-2 gap-3">
            {content.keyMetrics.maxProfit && (
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-500">Max Profit</div>
                <div className="text-lg font-bold text-green-600">{content.keyMetrics.maxProfit.value}</div>
                {content.keyMetrics.maxProfit.condition && (
                  <div className="text-xs text-gray-500">{content.keyMetrics.maxProfit.condition}</div>
                )}
              </div>
            )}
            {content.keyMetrics.maxLoss && (
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-500">Max Loss</div>
                <div className="text-lg font-bold text-red-600">{content.keyMetrics.maxLoss.value}</div>
                {content.keyMetrics.maxLoss.condition && (
                  <div className="text-xs text-gray-500">{content.keyMetrics.maxLoss.condition}</div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Visualization (Profit/Loss Zones) */}
      {content.visualization && (
        <Section title="📈 Profit/Loss Zones">
          <div className="space-y-2">
            {content.visualization.profitZone && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                <span className="text-green-600">▲</span>
                <span className="text-sm">Profit Zone: {content.visualization.profitZone}</span>
              </div>
            )}
            {content.visualization.lossZone && (
              <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                <span className="text-red-600">▼</span>
                <span className="text-sm">Loss Zone: {content.visualization.lossZone}</span>
              </div>
            )}
            {content.visualization.transitionZone && (
              <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                <span className="text-yellow-600">↔</span>
                <span className="text-sm">Transition: {content.visualization.transitionZone}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Strategy Analysis */}
      {content.strategyAnalysis && (
        <Section title="🎯 Strategy Analysis">
          <div className="space-y-2">
            {content.strategyAnalysis.bullishOutcome && (
              <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                <div className="font-medium text-green-800">📈 Bullish Outcome</div>
                <div className="text-sm text-gray-700 mt-1">{content.strategyAnalysis.bullishOutcome.scenario}</div>
                <div className="text-sm text-green-600 mt-1">{content.strategyAnalysis.bullishOutcome.result}</div>
              </div>
            )}
            {content.strategyAnalysis.neutralOutcome && (
              <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-gray-400">
                <div className="font-medium text-gray-800">↔ Neutral Outcome</div>
                <div className="text-sm text-gray-700 mt-1">{content.strategyAnalysis.neutralOutcome.scenario}</div>
                <div className="text-sm text-gray-600 mt-1">{content.strategyAnalysis.neutralOutcome.result}</div>
              </div>
            )}
            {content.strategyAnalysis.bearishOutcome && (
              <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                <div className="font-medium text-red-800">📉 Bearish Outcome</div>
                <div className="text-sm text-gray-700 mt-1">{content.strategyAnalysis.bearishOutcome.scenario}</div>
                <div className="text-sm text-red-600 mt-1">{content.strategyAnalysis.bearishOutcome.result}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Key Insights */}
      {content.keyInsights && content.keyInsights.length > 0 && (
        <Section title="💡 Key Insights">
          <div className="space-y-3">
            {content.keyInsights.map((insight, index) => (
              <InsightCard key={`insight-${index}`} insight={insight} />
            ))}
          </div>
        </Section>
      )}

      {/* Scenarios (LEAPS) */}
      {content.scenarios && (
        <Section title="📊 Historical Scenario Analysis">
          {content.scenarios.mediumIncrease && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-800 mb-2">
                Medium Increase ({content.scenarios.mediumIncrease.minAnnualReturn})
              </div>
              <div className="text-sm space-y-1">
                <p><strong>Target:</strong> {content.scenarios.mediumIncrease.projectedPriceTarget}</p>
                <p><strong>Realism:</strong> {content.scenarios.mediumIncrease.payoffRealism}</p>
                <p><strong>Payoff:</strong> {content.scenarios.mediumIncrease.optionPayoff}</p>
              </div>
            </div>
          )}
          {content.scenarios.strongIncrease && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="font-medium text-purple-800 mb-2">
                Strong Increase ({content.scenarios.strongIncrease.minAnnualReturn})
              </div>
              <div className="text-sm space-y-1">
                <p><strong>Target:</strong> {content.scenarios.strongIncrease.projectedPriceTarget}</p>
                <p><strong>Realism:</strong> {content.scenarios.strongIncrease.payoffRealism}</p>
                <p><strong>Payoff:</strong> {content.scenarios.strongIncrease.optionPayoff}</p>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Risk Management */}
      {content.riskManagement && (
        <Section title="🛡️ Risk Management">
          <div className="space-y-2 text-sm">
            {content.riskManagement.earlyExitTrigger && (
              <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                <span>⚠️</span>
                <div>
                  <span className="font-medium">Early Exit:</span> {content.riskManagement.earlyExitTrigger}
                </div>
              </div>
            )}
            {content.riskManagement.adjustmentOptions && (
              <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                <span>🔄</span>
                <div>
                  <span className="font-medium">Adjustments:</span> {content.riskManagement.adjustmentOptions}
                </div>
              </div>
            )}
            {content.riskManagement.worstCase && (
              <div className="flex items-start gap-2 p-2 bg-red-50 rounded">
                <span>🚫</span>
                <div>
                  <span className="font-medium">Worst Case:</span> {content.riskManagement.worstCase}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Risks */}
      {content.risks && content.risks.length > 0 && (
        <Section title="⚠️ Risk Factors">
          <div className="space-y-2">
            {content.risks.map((risk, index) => (
              <RiskCard key={`risk-${index}`} risk={risk} />
            ))}
          </div>
        </Section>
      )}

      {/* Watch Items */}
      {content.watchItems && content.watchItems.length > 0 && (
        <Section title="👁️ What to Watch">
          <div className="space-y-2">
            {content.watchItems.map((item, index) => (
              <WatchItemCard key={`watch-${index}`} item={item} />
            ))}
          </div>
        </Section>
      )}

      {/* Disclaimer */}
      <div className="mt-6 p-3 bg-gray-100 rounded-lg text-xs text-gray-500 flex items-start gap-2">
        <span>ℹ️</span>
        <p>{content.disclaimer}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface AiInsightsPanelProps {
  className?: string;
}

export function AiInsightsPanel({ className = '' }: AiInsightsPanelProps) {
  const { isLoading, error, result, analyze, fromCache } = useAiExplainer();
  const { isAiPanelOpen, closeAiPanel, currentMetadata } = useOptionChain();

  // Sanitize AI response to prevent XSS attacks
  const sanitizedResult = useMemo(() => {
    if (!result) return null;
    return sanitizeAiResponse(result) as AiExplainerContent;
  }, [result]);

  if (!isAiPanelOpen) {
    return null;
  }

  return (
    <div className={`
      fixed inset-y-0 right-0 w-full sm:w-96 md:w-[450px]
      bg-white shadow-2xl
      transform transition-transform duration-300
      z-50 overflow-hidden flex flex-col
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary-50">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h4 className="font-semibold text-gray-800">AI Analysis</h4>
          {fromCache && (
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
              Cached
            </span>
          )}
        </div>
        <button
          onClick={closeAiPanel}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!currentMetadata ? (
          <div className="text-center py-8 text-gray-500">
            <p>No simulation data available.</p>
            <p className="text-sm mt-2">Run a simulation first to get AI insights.</p>
          </div>
        ) : isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={analyze} />
        ) : sanitizedResult ? (
          <ContentRenderer content={sanitizedResult} />
        ) : (
          <div className="text-center py-8">
            <button
              onClick={analyze}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Get AI Insights
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AiInsightsPanel;
