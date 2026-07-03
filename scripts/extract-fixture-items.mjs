/**
 * Generate the `*.items.json` fixtures consumed by visual-blocks.fixtures.test.ts.
 *
 * Each fixture is extracted DIRECTLY from its original source PDF (in
 * test/fixtures/pdf/original/, which is gitignored) at a chosen page, using pdf.js pinned
 * to the vendored version — the exact path the extension uses. The resulting normalized
 * items ARE what the app feeds `groupItemsIntoBlocks`, so the committed JSON is a faithful
 * golden input.
 *
 * We commit only the JSON, not the PDFs: the faithful single pages are large, and
 * reprocessing them to shrink (Ghostscript) corrupts the text runs. Regenerating requires
 * the source PDFs; keep them in test/fixtures/pdf/original/.
 *
 * Run:  node scripts/extract-fixture-items.mjs   (or: pnpm run fixtures:extract)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { normalizedItemsFromTextContent } from '../src/lib/pdf/coords.ts';

GlobalWorkerOptions.workerSrc = fileURLToPath(
  new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url),
);
// Standard-font metrics shipped with pdfjs-dist — without these, base-14 glyph widths are
// estimated and item widths drift. Trailing slash required.
const STANDARD_FONT_DATA_URL = fileURLToPath(
  new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url),
);

const outDir = fileURLToPath(new URL('../test/fixtures/pdf/', import.meta.url));
const sourceDir = join(outDir, 'original');

// Manifest: which page of which (trimmed) source becomes which fixture. Sources are the
// trimmed PDFs produced by trim-fixture-sources.mjs, whose pages renumber from 1 — so the
// fixture NAME keeps the original document's page (e.g. p7 for provenance) while `page` is
// its position in the trimmed file. (See the plan for each fixture's regression/
// characterization role.)
const FIXTURES = [
  { source: 'chi_star.pdf', page: 1, name: 'chi_star.p1' },
  { source: 'sciencedirect.pdf', page: 1, name: 'sciencedirect.p1' },
  { source: 'tobuild_truncated.pdf', page: 1, name: 'tobuild.p1' },
  { source: 'tobuild_truncated.pdf', page: 2, name: 'tobuild.p2' },
  { source: 'nas_whitepaper.pdf', page: 1, name: 'nas_whitepaper.p7' }, // orig p7 = trimmed p1
  { source: 'hearing_transcript.pdf', page: 1, name: 'hearing_transcript.p12' }, // orig p12 = trimmed p1
];

if (!existsSync(sourceDir)) {
  console.error(`No source dir at ${sourceDir} — put the original PDFs there to regenerate.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

for (const { source, page: pageNum, name } of FIXTURES) {
  const path = join(sourceDir, source);
  if (!existsSync(path)) {
    console.warn(`skip ${name}: missing source ${source}`);
    continue;
  }
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.0 });
  const textContent = await page.getTextContent();
  const items = normalizedItemsFromTextContent(
    textContent.items,
    viewport.width,
    viewport.height,
    1,
  );

  writeFileSync(join(outDir, `${name}.items.json`), `${JSON.stringify(items, null, 2)}\n`);
  console.log(`${source} p${pageNum}: ${items.length} items -> ${name}.items.json`);
  await doc.destroy();
}
