'use client';

/**
 * useAiExplainer Hook
 *
 * Custom hook for invoking AI explainer functionality.
 * Provides a simple interface for components to request AI analysis.
 */

import { useState, useCallback } from 'react';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { useOptionChain } from '@/contexts';
import { handleAiExplainerAction, AI_EXPLAINER_ACTION } from '@/actions';
import { AiExplainerContent, CopilotActionResult } from '@/types/ai-response';
import { ContextEnvelope, PageMetadata } from '@/types';

// ============================================================================
// Hook Return Type
// ============================================================================

interface UseAiExplainerReturn {
  // State
  isLoading: boolean;
  error: string | null;
  result: AiExplainerContent | null;
  fromCache: boolean;

  // Actions
  analyze: () => Promise<void>;
  analyzeWithContext: (context: ContextEnvelope<PageMetadata>) => Promise<void>;
  clearResult: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAiExplainer(): UseAiExplainerReturn {
  const {
    getContextEnvelope,
    setAiLoading,
    setAiResponse,
    setError: setContextError,
  } = useOptionChain();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiExplainerContent | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Register the action with CopilotKit
  useCopilotAction({
    name: AI_EXPLAINER_ACTION.name,
    description: AI_EXPLAINER_ACTION.description,
    parameters: AI_EXPLAINER_ACTION.parameters as any,
    handler: async ({ context }) => {
      const actionResult = await handleAiExplainerAction(context);
      if (actionResult.success && actionResult.data) {
        setResult(actionResult.data);
        setFromCache(actionResult.fromCache || false);
      }
      return actionResult;
    },
  });

  // Make current context readable by CopilotKit
  useCopilotReadable({
    description: 'Current options simulation context',
    value: getContextEnvelope(),
  });

  // Analyze using current context
  const analyze = useCallback(async () => {
    const context = getContextEnvelope();

    if (!context) {
      setError('No simulation context available. Please run a simulation first.');
      return;
    }

    setIsLoading(true);
    setAiLoading(true);
    setError(null);

    try {
      const actionResult = await handleAiExplainerAction(context);

      if (actionResult.success && actionResult.data) {
        setResult(actionResult.data);
        setFromCache(actionResult.fromCache || false);
        setAiResponse(actionResult.data);
      } else {
        setError(actionResult.error || 'Failed to get AI analysis');
        setContextError(actionResult.error || 'Failed to get AI analysis');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setContextError(errorMessage);
    } finally {
      setIsLoading(false);
      setAiLoading(false);
    }
  }, [getContextEnvelope, setAiLoading, setAiResponse, setContextError]);

  // Analyze with explicit context
  const analyzeWithContext = useCallback(
    async (context: ContextEnvelope<PageMetadata>) => {
      setIsLoading(true);
      setAiLoading(true);
      setError(null);

      try {
        const actionResult = await handleAiExplainerAction(context);

        if (actionResult.success && actionResult.data) {
          setResult(actionResult.data);
          setFromCache(actionResult.fromCache || false);
          setAiResponse(actionResult.data);
        } else {
          setError(actionResult.error || 'Failed to get AI analysis');
          setContextError(actionResult.error || 'Failed to get AI analysis');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setContextError(errorMessage);
      } finally {
        setIsLoading(false);
        setAiLoading(false);
      }
    },
    [setAiLoading, setAiResponse, setContextError]
  );

  // Clear result
  const clearResult = useCallback(() => {
    setResult(null);
    setFromCache(false);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    result,
    fromCache,
    analyze,
    analyzeWithContext,
    clearResult,
  };
}

export default useAiExplainer;
