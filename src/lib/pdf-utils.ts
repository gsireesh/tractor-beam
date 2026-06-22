import { browser, type Browser } from 'wxt/browser';

/**
 * PDF utility functions for the extension
 */

/**
 * Generate the URL for the PDF viewer with the given PDF URL.
 *
 * Optionally deep-links to a specific schema instance: `schemaId` selects the
 * active schema in the drawer and `instanceId` triggers scroll-to + flash of
 * that highlight once its page renders.
 */
export function getPdfViewerUrl(
  pdfUrl: string,
  opts?: { schemaId?: string; instanceId?: string },
): string {
  const viewerPath = browser.runtime.getURL('/pdfjs/web/viewer.html');
  const params = new URLSearchParams({ file: pdfUrl });
  if (opts?.schemaId) params.set('schema', opts.schemaId);
  if (opts?.instanceId) params.set('instance', opts.instanceId);
  return `${viewerPath}?${params.toString()}`;
}

/**
 * Open a PDF in a new tab using the extension's PDF viewer
 */
export function openPdfInTab(pdfUrl: string): Promise<Browser.tabs.Tab> {
  return browser.tabs.create({ url: getPdfViewerUrl(pdfUrl) });
}

/**
 * Check if a URL points to a PDF file
 */
export function isPdfUrl(url: string | undefined): boolean {
  if (!url) return false;

  // Check file extension
  if (url.toLowerCase().endsWith('.pdf')) {
    return true;
  }

  // Check for common PDF content-type indicators in URLs
  if (url.includes('application/pdf')) {
    return true;
  }

  // Check for common PDF URL patterns
  const pdfPatterns = [/\/pdf\//i, /\.pdf$/i, /pdf\.ashx/i, /getpdf/i, /download.*pdf/i];

  return pdfPatterns.some((pattern) => pattern.test(url));
}
