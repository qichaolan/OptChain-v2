'use client';

/**
 * AI Tooltip Component - Hover/Tap AI Explanations
 *
 * Provides AI-powered explanations when users hover (desktop) or tap (mobile)
 * on metrics. Makes the site feel alive as users learn while exploring.
 *
 * Examples:
 * - IV Percentile → "Explain what this means for spreads"
 * - Delta → "What does 0.28 delta imply for risk?"
 * - Score → "Why is this contract scored 0.82?"
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useOptionChain } from '@/contexts';

// ============================================================================
// Types
// ============================================================================

export type MetricType =
  | 'iv'
  | 'ivp'
  | 'delta'
  | 'score'
  | 'dte'
  | 'roc'
  | 'pop'
  | 'breakeven'
  | 'strike'
  | 'premium'
  | 'width'
  | 'credit'
  | 'max_gain'
  | 'max_loss';

interface AiTooltipProps {
  /** The type of metric being explained */
  metricType: MetricType;
  /** The actual value to explain */
  value: string | number;
  /** Children to wrap (the metric display) */
  children: React.ReactNode;
  /** Custom explanation prompt (optional) */
  customPrompt?: string;
  /** Position preference */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Custom className for wrapper */
  className?: string;
}

// ============================================================================
// Metric Configurations
// ============================================================================

const METRIC_CONFIG: Record<MetricType, { label: string; icon: string; getPrompt: (value: string | number) => string }> = {
  iv: {
    label: 'Implied Volatility',
    icon: '📊',
    getPrompt: (value) => `Explain what ${value}% implied volatility means for this options strategy and whether it's high or low relative to historical levels.`,
  },
  ivp: {
    label: 'IV Percentile',
    icon: '📈',
    getPrompt: (value) => `Explain what ${value}% IV percentile means for options trading and how it affects premium pricing and strategy selection.`,
  },
  delta: {
    label: 'Delta',
    icon: '∆',
    getPrompt: (value) => `Explain what a delta of ${value} implies for risk, probability of profit, and how much the option moves with the underlying.`,
  },
  score: {
    label: 'AI Score',
    icon: '🎯',
    getPrompt: (value) => `Explain why this contract/spread received an AI score of ${value} and what factors typically contribute to high or low scores.`,
  },
  dte: {
    label: 'Days to Expiration',
    icon: '📅',
    getPrompt: (value) => `Explain how ${value} days to expiration affects this options strategy in terms of time decay and risk.`,
  },
  roc: {
    label: 'Return on Capital',
    icon: '💹',
    getPrompt: (value) => `Explain what ${value} ROC means - is this a good return for the risk taken? How does it compare to typical credit spreads?`,
  },
  pop: {
    label: 'Probability of Profit',
    icon: '🎲',
    getPrompt: (value) => `Explain what ${value}% probability of profit means in practice and what factors could change this probability.`,
  },
  breakeven: {
    label: 'Breakeven',
    icon: '📍',
    getPrompt: (value) => `Explain what the breakeven price of ${value} means and the probability of reaching it based on current market conditions.`,
  },
  strike: {
    label: 'Strike Price',
    icon: '🎯',
    getPrompt: (value) => `Explain the significance of the ${value} strike price - is it ATM, ITM, or OTM? How does this affect the strategy?`,
  },
  premium: {
    label: 'Premium',
    icon: '💰',
    getPrompt: (value) => `Explain what ${value} premium tells us about market expectations and whether this is relatively cheap or expensive.`,
  },
  width: {
    label: 'Spread Width',
    icon: '↔️',
    getPrompt: (value) => `Explain how the ${value} wide spread affects max profit, max loss, and probability of success.`,
  },
  credit: {
    label: 'Credit Received',
    icon: '💵',
    getPrompt: (value) => `Explain what receiving ${value} credit means for this spread and how it relates to the risk/reward profile.`,
  },
  max_gain: {
    label: 'Max Gain',
    icon: '📈',
    getPrompt: (value) => `Explain the conditions needed to achieve the maximum gain of ${value} and how likely this outcome is.`,
  },
  max_loss: {
    label: 'Max Loss',
    icon: '📉',
    getPrompt: (value) => `Explain when the maximum loss of ${value} would occur and how to potentially mitigate this risk.`,
  },
};

// ============================================================================
// Component
// ============================================================================

export function AiTooltip({
  metricType,
  value,
  children,
  customPrompt,
  position = 'top',
  className = '',
}: AiTooltipProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { currentMetadata, currentPage, currentContextType } = useOptionChain();

  const config = METRIC_CONFIG[metricType];

  // Position classes
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-white border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-white border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-white border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-white border-y-transparent border-l-transparent',
  };

  const fetchExplanation = useCallback(async () => {
    if (hasLoaded || isLoading) return;

    setIsLoading(true);
    try {
      const prompt = customPrompt || config.getPrompt(value);

      const response = await fetch('/api/copilotkit/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: currentPage || 'leaps_ranker',
          contextType: currentContextType || 'roi_simulator',
          metadata: currentMetadata || { metric: metricType, value },
          microAction: {
            type: `explain_${metricType}`,
            prompt: prompt,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setExplanation(data.microResponse || data.summary || 'No explanation available.');
      setHasLoaded(true);
    } catch (error) {
      console.error('AI tooltip error:', error);
      setExplanation('Unable to load explanation.');
    } finally {
      setIsLoading(false);
    }
  }, [hasLoaded, isLoading, customPrompt, config, value, currentPage, currentContextType, currentMetadata, metricType]);

  // Handle hover with delay
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
      fetchExplanation();
    }, 500); // 500ms delay before showing tooltip
  }, [fetchExplanation]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowTooltip(false);
  }, []);

  // Handle touch/tap for mobile
  const handleTouchStart = useCallback(() => {
    setShowTooltip(true);
    fetchExplanation();
  }, [fetchExplanation]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      ref={tooltipRef}
    >
      {/* Wrapped content with hover indicator */}
      <span className={`
        cursor-help
        ${isHovering ? 'underline decoration-dotted decoration-primary-400' : ''}
      `}>
        {children}
        <span className="ml-0.5 text-primary-500 opacity-60 text-xs">💡</span>
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={`
            absolute z-50 w-72 sm:w-80
            bg-white rounded-lg shadow-xl border border-gray-200
            p-3 animate-in fade-in zoom-in-95 duration-200
            ${positionClasses[position]}
          `}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
            <span className="text-base">{config.icon}</span>
            <span className="font-medium text-gray-800 text-sm">{config.label}</span>
            <span className="ml-auto text-primary-600 font-bold text-sm">{value}</span>
          </div>

          {/* Content */}
          <div className="text-sm text-gray-700">
            {isLoading ? (
              <div className="flex items-center gap-2 text-gray-500 py-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
                <span>AI is thinking...</span>
              </div>
            ) : (
              <p className="leading-relaxed">{explanation}</p>
            )}
          </div>

          {/* Arrow */}
          <div className={`absolute w-0 h-0 border-8 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Pre-configured Tooltip Components
// ============================================================================

interface SimpleTooltipProps {
  value: string | number;
  children: React.ReactNode;
  className?: string;
}

export function IVTooltip({ value, children, className }: SimpleTooltipProps) {
  return <AiTooltip metricType="iv" value={value} className={className}>{children}</AiTooltip>;
}

export function DeltaTooltip({ value, children, className }: SimpleTooltipProps) {
  return <AiTooltip metricType="delta" value={value} className={className}>{children}</AiTooltip>;
}

export function ScoreTooltip({ value, children, className }: SimpleTooltipProps) {
  return <AiTooltip metricType="score" value={value} className={className}>{children}</AiTooltip>;
}

export function DTETooltip({ value, children, className }: SimpleTooltipProps) {
  return <AiTooltip metricType="dte" value={value} className={className}>{children}</AiTooltip>;
}

export function POPTooltip({ value, children, className }: SimpleTooltipProps) {
  return <AiTooltip metricType="pop" value={value} className={className}>{children}</AiTooltip>;
}

export function ROCTooltip({ value, children, className }: SimpleTooltipProps) {
  return <AiTooltip metricType="roc" value={value} className={className}>{children}</AiTooltip>;
}

export default AiTooltip;
