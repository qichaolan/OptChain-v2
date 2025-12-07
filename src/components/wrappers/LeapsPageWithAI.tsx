'use client';

/**
 * LEAPS Page Wrapper with AI Integration
 *
 * Wraps the existing LEAPS Ranker page and provides CopilotKit integration.
 * This component adds the AI Insights button and panel without modifying
 * the original page code.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useOptionChain } from '@/contexts';
import { AiInsightsButton, AiInsightsPanel } from '@/components/ai';
import { LeapsMetadata, createLeapsContext } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface LeapsPageWithAIProps {
  /**
   * URL of the existing LEAPS page to embed
   * Default: The existing FastAPI-served page
   */
  pageUrl?: string;

  /**
   * Callback to extract metadata from the embedded page
   * Called when simulation data changes
   */
  onMetadataExtract?: () => LeapsMetadata | null;

  /**
   * Custom class for the wrapper
   */
  className?: string;
}

// ============================================================================
// Message Handler for iframe communication
// ============================================================================

interface SimulationMessage {
  type: 'LEAPS_SIMULATION_UPDATE';
  payload: LeapsMetadata;
}

// ============================================================================
// Component
// ============================================================================

export function LeapsPageWithAI({
  pageUrl = '/',
  className = '',
}: LeapsPageWithAIProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { setCurrentContext, clearContext } = useOptionChain();

  // Handle messages from the embedded page
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Validate origin for security
      const allowedOrigins = [
        window.location.origin,
        'http://localhost:8080',
        'http://127.0.0.1:8080',
      ];

      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      // Check if it's a simulation update message
      const data = event.data as SimulationMessage;
      if (data?.type === 'LEAPS_SIMULATION_UPDATE' && data.payload) {
        const metadata = data.payload;

        // Create context and update state
        const context = createLeapsContext(metadata);
        setCurrentContext(context.page, context.contextType, metadata);
      }
    },
    [setCurrentContext]
  );

  // Set up message listener
  useEffect(() => {
    window.addEventListener('message', handleMessage);

    return () => {
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
        // Cross-origin iframe, cannot access directly
        console.log('Using postMessage for cross-origin communication');
      }
    };

    iframe.addEventListener('load', injectScript);

    return () => {
      iframe.removeEventListener('load', injectScript);
    };
  }, []);

  return (
    <div className={`relative w-full h-screen ${className}`}>
      {/* Embedded LEAPS Page */}
      <iframe
        ref={iframeRef}
        src={pageUrl}
        className="w-full h-full border-0"
        title="LEAPS Ranker"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />

      {/* AI Components Overlay */}
      <AiInsightsButton position="bottom-right" />
      <AiInsightsPanel />
    </div>
  );
}

export default LeapsPageWithAI;
