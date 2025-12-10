import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/frontend/setup.ts'],
    include: ['tests/frontend/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/validation.ts',
        'src/lib/rate-limiter.ts',
        'src/lib/security.ts',
        'src/components/ErrorBoundary.tsx',
        'src/app/chain-analysis/page.tsx',
      ],
      exclude: [
        'src/**/*.d.ts',
      ],
      // Note: thresholds apply globally across all included files
      // Individual file thresholds can be set per-file if needed
      thresholds: {
        // For chain-analysis page tests, we focus on that file's coverage
        // Other files have separate test suites
        'src/app/chain-analysis/page.tsx': {
          lines: 85,
          branches: 80,
          functions: 80,
          statements: 85,
        },
      },
    },
    mockReset: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
