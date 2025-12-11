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
        'src/lib/sanitize.ts',
        'src/types/context.ts',
        'src/actions/aiExplainerAction.ts',
        'src/components/ErrorBoundary.tsx',
      ],
      exclude: [
        'src/**/*.d.ts',
      ],
      // Coverage thresholds for tested modules
      thresholds: {
        'src/lib/validation.ts': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        'src/lib/rate-limiter.ts': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        'src/lib/security.ts': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        'src/components/ErrorBoundary.tsx': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
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
