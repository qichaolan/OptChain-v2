'use client';

/**
 * Credit Spreads Page Wrapper with AI Integration - Chatless Generative UI
 *
 * Wraps the existing Credit Spreads Screener page and provides CopilotKit integration.
 * Uses chatless generative UI - AI insights appear as native UI elements,
 * not as a chat conversation.
 *
 * Key traits:
 * - No chat surface
 * - App decides when and where generative UI appears
 * - Feels like a built-in product feature
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useOptionChain } from '@/contexts';
import { InlineAiInsights } from '@/components/ai';
import { CreditSpreadMetadata, createCreditSpreadContext } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface CreditSpreadsPageWithAIProps {
  /**
   * URL of the existing Credit Spreads page to embed
   */
  pageUrl?: string;

  /**
   * Custom class for the wrapper
   */
  className?: string;
}

// ============================================================================
// Message Handler for iframe communication
// ============================================================================

interface SimulationMessage {
  type: 'CREDIT_SPREAD_SIMULATION_UPDATE';
  payload: CreditSpreadMetadata;
}

// ============================================================================
// Component
// ============================================================================

export function CreditSpreadsPageWithAI({
  pageUrl = '/credit-spreads',
  className = '',
}: CreditSpreadsPageWithAIProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const { setCurrentContext, clearContext, currentMetadata } = useOptionChain();

  // Handle messages from the embedded page
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Debug: log all received messages
      console.log('[CreditSpreads] Received message:', event.data, 'from origin:', event.origin);

      // Validate origin for security - allow all in development
      const allowedOrigins = [
        window.location.origin,
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:3001',
      ];

      if (!allowedOrigins.includes(event.origin)) {
        console.log('[CreditSpreads] Origin not allowed:', event.origin);
        return;
      }

      // Check if it's a simulation update message
      const data = event.data as SimulationMessage;
      if (data?.type === 'CREDIT_SPREAD_SIMULATION_UPDATE' && data.payload) {
        console.log('[CreditSpreads] Simulation update received:', data.payload);
        const metadata = data.payload;

        // Create context and update state
        const context = createCreditSpreadContext(metadata);
        setCurrentContext(context.page, context.contextType, metadata);
      }
    },
    [setCurrentContext]
  );

  // Set up message listener
  useEffect(() => {
    console.log('[CreditSpreads] Setting up message listener');
    window.addEventListener('message', handleMessage);

    return () => {
      console.log('[CreditSpreads] Removing message listener');
      window.removeEventListener('message', handleMessage);
      clearContext();
    };
  }, [handleMessage, clearContext]);

  // Inject communication script into iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const injectScript = () => {
      try {
        const iframeWindow = iframe.contentWindow;
        if (!iframeWindow) return;

        // Post a ready message to the parent
        iframeWindow.postMessage({ type: 'OPTCHAIN_V2_READY' }, '*');
      } catch (e) {
        console.log('Using postMessage for cross-origin communication');
      }
    };

    iframe.addEventListener('load', injectScript);

    return () => {
      iframe.removeEventListener('load', injectScript);
    };
  }, []);

  // Auto-show AI panel when simulation data arrives
  useEffect(() => {
    if (currentMetadata) {
      setShowAiPanel(true);
    }
  }, [currentMetadata]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Main content area with iframe and AI panel side by side - no gap between them */}
      <div className="flex h-full">
        {/* Embedded Credit Spreads Page - uses flex-1 to fill remaining space */}
        <div className={`h-full transition-all duration-300 ease-out min-w-0 ${showAiPanel && currentMetadata ? 'flex-1' : 'w-full'}`}>
          <iframe
            ref={iframeRef}
            src={pageUrl}
            className="w-full h-full border-0"
            title="Credit Spreads Screener"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>

        {/* Chatless AI Insights Panel - reduced width for better balance */}
        {currentMetadata && showAiPanel && (
          <div
            className={`
              hidden md:flex h-full w-[380px] flex-shrink-0
              bg-white border-l border-gray-200 shadow-xl
              flex-col overflow-hidden
            `}
          >
            {/* Header - High contrast for visibility */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
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
            <div className="flex-1 overflow-y-auto p-4">
              <InlineAiInsights
                size="detailed"
                autoAnalyze={true}
              />
            </div>
          </div>
        )}

        {/* Toggle button when panel is hidden */}
        {currentMetadata && !showAiPanel && (
          <button
            onClick={() => setShowAiPanel(true)}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-full shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            <span className="text-xl">🤖</span>
            <span className="hidden sm:inline">AI Insights</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default CreditSpreadsPageWithAI;
