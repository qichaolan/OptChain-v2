'use client';

/**
 * CopilotKit Provider - Chatless Generative UI
 *
 * Root provider component that wraps the application with CopilotKit context.
 * Configures the runtime endpoint for headless AI capabilities.
 *
 * This is a "Chatless" implementation where the agent communicates through
 * APIs and the app renders generative UI as part of its native interface.
 * No chat surface - AI insights appear as built-in product features.
 */

import React, { ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';

// ============================================================================
// Configuration
// ============================================================================

const COPILOTKIT_CONFIG = {
  // API endpoint for CopilotKit runtime (self-hosted with Google Gemini)
  runtimeUrl: '/api/copilotkit',

  // CopilotKit Cloud API key
  publicApiKey: process.env.NEXT_PUBLIC_COPILOTKIT_API_KEY,
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

/**
 * Headless CopilotKit provider for chatless generative UI.
 *
 * The agent doesn't talk directly to the user. Instead, it communicates
 * with the application through APIs, and the app renders generative UI
 * from the agent as part of its native interface.
 */
export function CopilotProvider({ children }: CopilotProviderProps) {
  return (
    <CopilotKit
      runtimeUrl={COPILOTKIT_CONFIG.runtimeUrl}
      publicApiKey={COPILOTKIT_CONFIG.publicApiKey}
    >
      {children}
    </CopilotKit>
  );
}

export default CopilotProvider;
