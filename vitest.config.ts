import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    // Mirror the '@/...' -> 'src/...' alias the app uses, so test files can
    // import modules the same way the source does.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Tier 1 (pure logic) needs no browser/DOM, so the fast 'node' environment
    // is enough. We'll switch to 'jsdom' when we reach the component tier.
    environment: 'node',
    // Only pick up files we explicitly name as tests.
    include: ['src/**/*.test.ts'],
  },
});
