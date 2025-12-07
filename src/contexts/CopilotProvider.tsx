'use client';

/**
 * CopilotKit Provider
 *
 * Root provider component that wraps the application with CopilotKit context.
 * Configures the runtime endpoint and provides AI capabilities to child components.
 */

import React, { ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';

// Import CopilotKit styles
import '@copilotkit/react-ui/styles.css';

// ============================================================================
// Configuration
// ============================================================================

const COPILOTKIT_CONFIG = {
  // API endpoint for CopilotKit runtime
  runtimeUrl: '/api/copilotkit',

  // Public API key (if using cloud service)
  publicApiKey: process.env.NEXT_PUBLIC_COPILOTKIT_API_KEY,

  // Chat configuration
  chatInstructions: `You are an expert options analyst AI assistant for OptionChain.
You help users understand their options trading simulations including LEAPS, Credit Spreads, and Iron Condors.
Always provide educational, fact-based analysis without giving specific trading advice.
Format your responses with clear sections and use the structured JSON format when analyzing trades.`,
};

// ============================================================================
// Provider Props
// ============================================================================

interface CopilotProviderProps {
  children: ReactNode;
}

// ============================================================================
// CopilotProvider Component
// ============================================================================

export function CopilotProvider({ children }: CopilotProviderProps) {
  return (
    <CopilotKit
      runtimeUrl={COPILOTKIT_CONFIG.runtimeUrl}
      publicApiKey={COPILOTKIT_CONFIG.publicApiKey}
    >
      {children}
      <CopilotPopup
        instructions={COPILOTKIT_CONFIG.chatInstructions}
        labels={{
          title: 'AI Insights',
          initial: 'How can I help you understand your options strategy?',
          placeholder: 'Ask about your simulation...',
        }}
        defaultOpen={false}
      />
    </CopilotKit>
  );
}

export default CopilotProvider;
