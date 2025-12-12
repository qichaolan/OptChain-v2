'use client';

/**
 * AI Explainer Hook
 *
 * Provides AI-powered analysis of options strategies.
 * Uses direct API calls to the backend AI explainer endpoint.
 */

import { useState, useCallback, useRef } from 'react';
import { useOptionChain } from '@/contexts';
import { AiExplainerContent } from '@/types/ai-response';

// Simple in-memory cache for AI responses
const responseCache = new Map<string, { result: AiExplainerContent; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface UseAiExplainerReturn {
  isLoading: boolean;
  error: string | null;
  result: AiExplainerContent | null;
  fromCache: boolean;
  analyze: () => Promise<void>;
  clearCache: () => void;
}

/**
 * Hook for AI-powered analysis of options strategies
 */
export function useAiExplainer(): UseAiExplainerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiExplainerContent | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { currentPage, currentContextType, currentMetadata } = useOptionChain();

  const analyze = useCallback(async () => {
    // Validate we have the necessary context
    if (!currentPage || !currentContextType || !currentMetadata) {
      setError('No context available for analysis');
      return;
    }

    // Create cache key from context
    const cacheKey = JSON.stringify({
      page: currentPage,
      contextType: currentContextType,
      metadata: currentMetadata,
    });

    // Check cache first
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResult(cached.result);
      setFromCache(true);
      setError(null);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setFromCache(false);

    try {
      const response = await fetch('/api/ai-explainer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: currentPage,
          contextType: currentContextType,
          metadata: currentMetadata,
          timestamp: new Date().toISOString(),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      // Cache the result
      responseCache.set(cacheKey, {
        result: data,
        timestamp: Date.now(),
      });

      setResult(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentContextType, currentMetadata]);

  const clearCache = useCallback(() => {
    responseCache.clear();
  }, []);

  return {
    isLoading,
    error,
    result,
    fromCache,
    analyze,
    clearCache,
  };
}

export default useAiExplainer;
