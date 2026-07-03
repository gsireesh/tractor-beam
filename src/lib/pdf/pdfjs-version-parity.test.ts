import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Drift guard. Fixture `items.json` is generated with the `pdfjs-dist` devDependency,
 * but the extension ships the *vendored* pdf.js build. If those two versions diverge,
 * the fixtures no longer reflect what the app extracts. This test makes that invariant
 * executable: bumping one without the other fails here, loudly, instead of silently
 * rotting the fixtures.
 */
function vendoredVersion(): string {
  const path = fileURLToPath(new URL('../../../public/pdfjs/build/pdf.mjs', import.meta.url));
  const src = readFileSync(path, 'utf8');
  const match = src.match(/const version = "(\d+\.\d+\.\d+)"/);
  if (!match) throw new Error('could not find the version string in vendored pdf.mjs');
  return match[1];
}

describe('pdf.js version parity', () => {
  it('vendored viewer and the pdfjs-dist devDependency are the exact same version', () => {
    const dist = (require('pdfjs-dist/package.json') as { version: string }).version;
    expect(dist).toBe(vendoredVersion());
  });
});
