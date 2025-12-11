/**
 * Vitest setup file for frontend tests
 *
 * This file runs before all tests and sets up:
 * - Jest DOM matchers for better assertions
 * - Global mocks for Next.js router, fetch, etc.
 * - Cleanup utilities
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: () => new Headers(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock ResizeObserver - use class syntax for proper constructor behavior
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock IntersectionObserver - use class syntax for proper constructor behavior
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    // Store callback for potential use in tests
  }
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock window.matchMedia - use plain function to avoid being cleared by clearAllMocks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: query.includes('dark') ? false : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock console.error to fail tests on unexpected errors
const originalError = console.error;
console.error = (...args: unknown[]) => {
  // Allow certain expected errors
  const message = args[0]?.toString() || '';
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: An update to')
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Environment variables for tests
process.env.NEXT_PUBLIC_COPILOTKIT_ENABLED = 'true';
// Note: NODE_ENV is already set to 'test' by Vitest automatically
