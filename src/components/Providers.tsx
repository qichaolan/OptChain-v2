'use client';

/**
 * Providers Component
 *
 * Client-side wrapper that combines all providers and error boundary.
 * Used in the root layout to wrap the application.
 */

import React, { useState, useEffect } from 'react';
import { OptionChainProvider } from '@/contexts';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Prevent hydration issues by only rendering providers after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/SSG, render children without providers to avoid context errors
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <OptionChainProvider>
      {children}
    </OptionChainProvider>
  );
}

export default Providers;
