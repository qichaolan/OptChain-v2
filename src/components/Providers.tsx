'use client';

/**
 * Providers Component
 *
 * Client-side wrapper that combines all providers and error boundary.
 * Used in the root layout to wrap the application.
 */

import React from 'react';
import { AppErrorBoundary } from './ErrorBoundary';
import { CopilotProvider, OptionChainProvider } from '@/contexts';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AppErrorBoundary>
      <OptionChainProvider>
        <CopilotProvider>
          {children}
        </CopilotProvider>
      </OptionChainProvider>
    </AppErrorBoundary>
  );
}

export default Providers;
