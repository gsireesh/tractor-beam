import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";
import flowbiteReact from "flowbite-react/plugin/vite";

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
   
  vite: (() => ({
    plugins: [tailwindcss(), flowbiteReact()]
  })),
  imports: {
    eslintrc: {
      enabled: 9
    }
  }
});