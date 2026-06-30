import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // The React plugin gives component tests the same JSX/Fast-Refresh-free
  // transform the app uses, so what we render matches production.
  plugins: [react()],
  resolve: {
    // Mirror the '@/...' -> 'src/...' alias the app uses, so test files can
    // import modules the same way the source does.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Default to the fast 'node' environment so tier-1 pure-logic tests stay
    // cheap. Component tests opt into jsdom per-file with a top-of-file pragma:
    //   // @vitest-environment jsdom
    environment: 'node',
    // Pick up both .test.ts (logic) and .test.tsx (components).
    include: ['src/**/*.test.{ts,tsx}'],
    // Registers jest-dom matchers and auto-cleanup after each test.
    setupFiles: ['./vitest.setup.ts'],
  },
});