import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],

  manifest: {
    action: {},
    permissions: ['tabs', 'offscreen'],
    host_permissions: ["<all_urls>"]
  },

  vite: (() => ({
    plugins: [tailwindcss()]
  })),
  imports: {
    eslintrc: {
      enabled: 9
    }
  },
});
