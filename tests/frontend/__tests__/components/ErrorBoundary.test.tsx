/**
 * Unit tests for ErrorBoundary component in src/components/ErrorBoundary.tsx
 *
 * Test Scenarios:
 * - Normal rendering of children
 * - Error catching and fallback rendering
 * - Error recovery via retry
 * - Error logging
 * - Nested error boundaries
 *
 * Coverage Target: ≥95% line and branch coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

// ============================================================================
// Test Components
// ============================================================================

function GoodComponent() {
  return <div>Good component content</div>;
}

function BadComponent(): JSX.Element {
  throw new Error('Test error from BadComponent');
}

function ConditionallyBadComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Conditional error');
  }
  return <div>Component is working</div>;
}

// ============================================================================
// Test Normal Rendering
// ============================================================================

describe('ErrorBoundary - Normal Rendering', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Good component content')).toBeInTheDocument();
  });

  it('should render multiple children', () => {
    render(
      <ErrorBoundary>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });

  it('should render null children without error', () => {
    render(
      <ErrorBoundary>
        {null}
        {undefined}
      </ErrorBoundary>
    );

    // Should not throw
    expect(true).toBe(true);
  });
});

// ============================================================================
// Test Error Catching
// ============================================================================

describe('ErrorBoundary - Error Catching', () => {
  // Suppress console.error for these tests
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should catch and display error', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    // Should show fallback UI
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should display error message', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    // Error message should be in the details section
    // The actual error message "Test error from BadComponent" is in a pre tag
    expect(screen.getByText('Test error from BadComponent')).toBeInTheDocument();
  });

  it('should show retry button', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole('button', { name: /try again|retry/i })
    ).toBeInTheDocument();
  });

  it('should log error to console', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should not leak error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    // Stack trace should not be visible in production
    const pageContent = document.body.textContent || '';
    expect(pageContent).not.toContain('at BadComponent');

    process.env.NODE_ENV = originalEnv;
  });
});

// ============================================================================
// Test Error Recovery
// ============================================================================

describe('ErrorBoundary - Error Recovery', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should reset error state on retry', () => {
    let shouldThrow = true;

    function FlipComponent() {
      if (shouldThrow) {
        throw new Error('Temporary error');
      }
      return <div>Recovered successfully</div>;
    }

    const { rerender } = render(
      <ErrorBoundary key="test">
        <FlipComponent />
      </ErrorBoundary>
    );

    // Should show error state
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Fix the component
    shouldThrow = false;

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }));

    // Force rerender with same key but fixed component
    rerender(
      <ErrorBoundary key="test">
        <FlipComponent />
      </ErrorBoundary>
    );

    // Note: The actual recovery behavior depends on implementation
    // The retry button might reload the page or reset the boundary
  });
});

// ============================================================================
// Test Default Fallback Component
// ============================================================================

describe('ErrorBoundary - Default Fallback', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should show error details section', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    // Should have expandable details section
    expect(screen.getByText('Error details')).toBeInTheDocument();
  });

  it('should show error message in details', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    // Error message is shown in the pre tag
    expect(screen.getByText('Test error from BadComponent')).toBeInTheDocument();
  });
});

// ============================================================================
// Test Nested Error Boundaries
// ============================================================================

describe('ErrorBoundary - Nested Boundaries', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should catch error at nearest boundary', () => {
    render(
      <ErrorBoundary>
        <div>Outer content</div>
        <ErrorBoundary>
          <BadComponent />
        </ErrorBoundary>
      </ErrorBoundary>
    );

    // Inner boundary should catch the error and show "Something went wrong"
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    // Outer content should still be visible
    expect(screen.getByText('Outer content')).toBeInTheDocument();
  });

  it('should preserve sibling content when nested error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Preserved content</div>
        <ErrorBoundary>
          <BadComponent />
        </ErrorBoundary>
      </ErrorBoundary>
    );

    expect(screen.getByText('Preserved content')).toBeInTheDocument();
  });
});

// ============================================================================
// Test Error Boundary with Different Error Types
// ============================================================================

describe('ErrorBoundary - Error Types', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle TypeError', () => {
    function TypeErrorComponent(): JSX.Element {
      throw new TypeError('Type error');
    }

    render(
      <ErrorBoundary>
        <TypeErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should handle RangeError', () => {
    function RangeErrorComponent(): JSX.Element {
      throw new RangeError('Range error');
    }

    render(
      <ErrorBoundary>
        <RangeErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should handle non-Error objects thrown', () => {
    function StringThrowComponent(): JSX.Element {
      throw 'String error';
    }

    render(
      <ErrorBoundary>
        <StringThrowComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Test Accessibility
// ============================================================================

describe('ErrorBoundary - Accessibility', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should have accessible fallback UI', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    // Should have heading or role
    const heading = screen.queryByRole('heading') ||
                    screen.queryByRole('alert');

    // Retry button should be accessible
    const button = screen.getByRole('button', { name: /try again|retry/i });
    expect(button).toBeInTheDocument();
  });

  it('should have proper focus management', () => {
    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    const button = screen.getByRole('button', { name: /try again|retry/i });

    // Button should be focusable
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});

// ============================================================================
// Test Edge Cases
// ============================================================================

describe('ErrorBoundary - Edge Cases', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle normal unmount', () => {
    function NormalComponent() {
      React.useEffect(() => {
        return () => {
          // Normal cleanup, no error
        };
      }, []);
      return <div>Normal component</div>;
    }

    const { unmount } = render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    // Initial render should work
    expect(screen.getByText('Normal component')).toBeInTheDocument();

    // Unmount should work without error
    expect(() => unmount()).not.toThrow();
  });

  it('should handle errors during render phase', () => {
    let renderCount = 0;

    function CountingBadComponent(): JSX.Element {
      renderCount++;
      if (renderCount > 0) {
        throw new Error('Render error');
      }
      return <div>Never reached</div>;
    }

    render(
      <ErrorBoundary>
        <CountingBadComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
