/**
 * Trim the full source PDFs down to just the page(s) each fixture needs, so small,
 * faithful, self-contained sources can be committed under test/fixtures/pdf/original/.
 *
 * pdf-lib copies page content streams verbatim (no re-encoding — unlike Ghostscript/
 * Preview, which corrupt text extraction) and drops unreferenced objects on save, so the
 * output is byte-faithful for text extraction AND small. Run `pnpm run fixtures:extract`
 * afterward and confirm the item counts are unchanged.
 *
 * Input: the full documents in test/fixtures/pdf/original/_sources/ (gitignored — drop the
 * originals there to re-run). Output: committed trimmed PDFs in test/fixtures/pdf/original/.
 *
 * Run:  node scripts/trim-fixture-sources.mjs   (or: pnpm run fixtures:trim)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

const originalDir = fileURLToPath(new URL('../test/fixtures/pdf/original/', import.meta.url));
const sourcesDir = join(originalDir, '_sources');

// Pages are 1-based (as humans count them). Keep only what the fixtures use; sciencedirect
// keeps its first two pages by request. The trimmed file renumbers pages from 1, so the
// extraction manifest reads getPage(1) even for what was page 7/12 of the full doc.
const TRIMS = [
  { source: 'chi_star.pdf', pages: [1], out: 'chi_star.pdf' },
  { source: 'sciencedirect.pdf', pages: [1, 2], out: 'sciencedirect.pdf' },
  { source: 'tobuild_truncated.pdf', pages: [1, 2], out: 'tobuild_truncated.pdf' },
  { source: 'nas_whitepaper.pdf', pages: [7], out: 'nas_whitepaper.pdf' },
  { source: 'Hearing Transcript.pdf', pages: [12], out: 'hearing_transcript.pdf' },
];

if (!existsSync(sourcesDir)) {
  console.error(`No _sources dir at ${sourcesDir} — drop the full PDFs there to trim.`);
  process.exit(1);
}
mkdirSync(originalDir, { recursive: true });

for (const { source, pages, out } of TRIMS) {
  const srcPath = join(sourcesDir, source);
  if (!existsSync(srcPath)) {
    console.warn(`skip ${out}: missing source ${source}`);
    continue;
  }
  const src = await PDFDocument.load(readFileSync(srcPath));
  const dst = await PDFDocument.create();
  const copied = await dst.copyPages(
    src,
    pages.map((p) => p - 1),
  );
  copied.forEach((pg) => dst.addPage(pg));
  const bytes = await dst.save();
  writeFileSync(join(originalDir, out), bytes);
  console.log(`${source} p${pages.join(',')} -> ${out} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
