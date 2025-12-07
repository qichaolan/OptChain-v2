'use client';

/**
 * Iron Condor Page Wrapper with AI Integration
 *
 * Wraps the existing Iron Condor Screener page and provides CopilotKit integration.
 * This component adds the AI Insights button and panel without modifying
 * the original page code.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useOptionChain } from '@/contexts';
import { AiInsightsButton, AiInsightsPanel } from '@/components/ai';
import { IronCondorMetadata, createIronCondorContext } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface IronCondorPageWithAIProps {
  /**
   * URL of the existing Iron Condor page to embed
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
  type: 'IRON_CONDOR_SIMULATION_UPDATE';
  payload: IronCondorMetadata;
}

// ============================================================================
// Component
// ============================================================================

export function IronCondorPageWithAI({
  pageUrl = '/iron-condors',
  className = '',
}: IronCondorPageWithAIProps) {
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
      if (data?.type === 'IRON_CONDOR_SIMULATION_UPDATE' && data.payload) {
        const metadata = data.payload;

        // Create context and update state
        const context = createIronCondorContext(metadata);
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
      {/* Embedded Iron Condor Page */}
      <iframe
        ref={iframeRef}
        src={pageUrl}
        className="w-full h-full border-0"
        title="Iron Condor Screener"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />

      {/* AI Components Overlay */}
      <AiInsightsButton position="bottom-right" />
      <AiInsightsPanel />
    </div>
  );
}

export default IronCondorPageWithAI;
