import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// WebLLM is excluded from builds unless explicitly opted in. Its model_lib WASM
// is fetched from a remote CDN, which MV3's no-remotely-hosted-code rule forbids,
// so store builds must not ship the library at all. When disabled we alias the
// package to a stub, making exclusion deterministic at module-resolution time
// rather than relying on (fragile) dead-code elimination of a dynamic import.
const webllmEnabled = process.env.VITE_ENABLE_WEBLLM === 'true';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],

  manifest: {
    action: {},
    permissions: ['tabs', 'offscreen', 'storage'],
    host_permissions: ['<all_urls>'],
  },

  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: webllmEnabled
        ? {}
        : {
            '@mlc-ai/web-llm': fileURLToPath(new URL('./src/lib/ml/webllm-stub.ts', import.meta.url)),
          },
    },
  }),
  imports: {
    eslintrc: {
      enabled: 9,
    },
  },
});
