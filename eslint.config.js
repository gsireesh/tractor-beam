import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import vitest from '@vitest/eslint-plugin';

import autoImports from './.wxt/eslint-auto-imports.mjs';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn'],
      '@typescript-eslint/no-empty-function': ['warn'],
    },
  },
  autoImports,
  // Test-file-only rules. Scoped to *.test.* so production code is unaffected.
  {
    files: ['**/*.test.{ts,tsx}'],
    plugins: { vitest },
    rules: {
      // The rule that would have caught our assertion-less test: every test
      // must contain at least one assertion.
      'vitest/expect-expect': 'error',
      // Catches malformed assertions, e.g. expect() called with no matcher.
      'vitest/valid-expect': 'error',
    },
  },
  eslintConfigPrettier,
);
