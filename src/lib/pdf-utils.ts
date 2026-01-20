/**
 * PDF utility functions for the extension
 */

/**
 * Generate the URL for the PDF viewer with the given PDF URL
 */
export function getPdfViewerUrl(pdfUrl: string): string {
  const viewerPath = browser.runtime.getURL('/pdfjs/web/viewer.html');
  return `${viewerPath}?file=${encodeURIComponent(pdfUrl)}`;
}

/**
 * Open a PDF in a new tab using the extension's PDF viewer
 */
export function openPdfInTab(pdfUrl: string): Promise<browser.Tabs.Tab> {
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
  const pdfPatterns = [
    /\/pdf\//i,
    /\.pdf$/i,
    /pdf\.ashx/i,
    /getpdf/i,
    /download.*pdf/i
  ];

  return pdfPatterns.some(pattern => pattern.test(url));
}
