'use client';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 */

import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

// ============================================================================
// Fallback Component
// ============================================================================

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        <details className="text-left mb-4 p-3 bg-gray-100 rounded text-sm">
          <summary className="cursor-pointer text-gray-700 font-medium">
            Error details
          </summary>
          <pre className="mt-2 text-red-600 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        </details>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Error Logger
// ============================================================================

function logError(error: Error, info: React.ErrorInfo) {
  // Log to console in development
  console.error('Error caught by boundary:', error.message);
  console.error('Component stack:', info.componentStack);

  // In production, you could send this to an error tracking service
  // e.g., Sentry, LogRocket, etc.
}

// ============================================================================
// Error Boundary Wrapper
// ============================================================================

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logError}
      onReset={() => {
        // Reset app state here if needed
        window.location.reload();
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export default AppErrorBoundary;
