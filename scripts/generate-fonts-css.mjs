/*
 * Bundles IBM Plex Sans: copies the woff2 files into public/fonts/ and generates
 * src/fonts.css with the @font-face rules.
 *
 * Our theme CSS is injected as an inlined <style> into the vendored pdf.js viewer
 * page (see the `?inline` imports in src/entrypoints/pdfjs-additions). That page
 * is served at the extension origin, so a root-absolute `url(/fonts/…)` resolves
 * to `chrome-extension://<id>/fonts/…` — the packaged font. One file, fetched
 * once and browser-cached, shared by every surface that references it (no
 * per-stylesheet duplication the way base64 data URIs would incur).
 *
 * NOTE: this relies on the injected CSS living in an *extension-origin* document.
 * If a surface is ever injected into a third-party page (a real content script,
 * see docs/architecture/04), root-relative URLs resolve against THAT origin and
 * break — you'd need chrome.runtime.getURL() + web_accessible_resources, or fall
 * back to base64.
 *
 * Source of the binaries is the @fontsource/ibm-plex-sans devDependency (OFL).
 * Regenerate with: `pnpm run fonts:generate`. We ship only the latin subset in
 * the three weights the UI uses (400 normal, 500 medium, 600 semibold).
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const fontsourceDir = dirname(require.resolve('@fontsource/ibm-plex-sans/package.json'));
const filesDir = join(fontsourceDir, 'files');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicFontsDir = join(root, 'public', 'fonts');

// weight -> the font-weight value emitted in the @font-face rule
const WEIGHTS = [400, 500, 600];
const SUBSET = 'latin';

mkdirSync(publicFontsDir, { recursive: true });

function fontFace(weight) {
  const filename = `ibm-plex-sans-${weight}.woff2`;
  copyFileSync(
    join(filesDir, `ibm-plex-sans-${SUBSET}-${weight}-normal.woff2`),
    join(publicFontsDir, filename),
  );
  // Root-absolute so it resolves against the extension origin, not the deep
  // viewer path the injected <style> would otherwise resolve relative URLs against.
  return `@font-face {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(/fonts/${filename}) format('woff2');
}`;
}

const header = `/*
 * GENERATED FILE — do not edit by hand.
 * Run \`pnpm run fonts:generate\` (scripts/generate-fonts-css.mjs) to rebuild.
 *
 * Bundled IBM Plex Sans (${SUBSET} subset, weights ${WEIGHTS.join('/')}). The woff2
 * files live in public/fonts/ and are referenced by root-absolute URL so a single
 * cached copy is shared across every injected surface. Imported by theme.css.
 */`;

const css = [header, ...WEIGHTS.map(fontFace), ''].join('\n\n');

writeFileSync(join(root, 'src', 'fonts.css'), css);
console.log(`Wrote src/fonts.css + ${WEIGHTS.length} woff2 files to public/fonts/`);
