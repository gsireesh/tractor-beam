/**
 * Prettier configuration for tractor-beam.
 *
 * This single file is read by three things: `pnpm format`, `pnpm format:check`,
 * and the IDE's format-on-save (Prettier mode = AUTOMATIC).
 *
 * @see https://prettier.io/docs/options
 * @type {import("prettier").Config}
 */
const config = {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  trailingComma: 'all',
};

export default config;
