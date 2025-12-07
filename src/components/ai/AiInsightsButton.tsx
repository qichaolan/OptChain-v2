'use client';

/**
 * AI Insights Button
 *
 * Floating button that triggers AI analysis.
 * Appears on pages with simulation data.
 */

import React from 'react';
import { useAiExplainer } from '@/hooks';
import { useOptionChain } from '@/contexts';

// ============================================================================
// Props
// ============================================================================

interface AiInsightsButtonProps {
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

// ============================================================================
// Component
// ============================================================================

export function AiInsightsButton({
  className = '',
  position = 'bottom-right',
}: AiInsightsButtonProps) {
  const { analyze, isLoading } = useAiExplainer();
  const { currentMetadata, openAiPanel } = useOptionChain();

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  const handleClick = async () => {
    openAiPanel();
    await analyze();
  };

  // Don't show if no simulation data
  const hasData = currentMetadata !== null;

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || !hasData}
      className={`
        fixed ${positionClasses[position]}
        z-50
        flex items-center gap-2
        px-4 py-3
        bg-primary-600 hover:bg-primary-700
        disabled:bg-gray-400 disabled:cursor-not-allowed
        text-white font-medium
        rounded-full shadow-lg
        transition-all duration-200
        hover:shadow-xl hover:scale-105
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
        ${isLoading ? 'animate-pulse-soft' : ''}
        ${className}
      `}
      title={hasData ? 'Get AI Insights' : 'Run a simulation first'}
      aria-label="AI Insights"
    >
      {/* Robot emoji icon */}
      <span className="text-xl" role="img" aria-hidden="true">
        {isLoading ? '...' : '🤖'}
      </span>

      {/* Button text */}
      <span className="hidden sm:inline">
        {isLoading ? 'Analyzing...' : 'AI Insights'}
      </span>
    </button>
  );
}

export default AiInsightsButton;
