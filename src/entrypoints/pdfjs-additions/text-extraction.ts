/**
 * PDF text extraction logic extracted from pdfjs-init.js.
 * Exposes window.TractorBeamTextExtraction API.
 */

declare global {
  interface Window {
    TractorBeamTextExtraction: {
      extractFullText: (PDFViewerApplication: any) => Promise<{ pageNumber: number; text: string }[]>;
    };
  }
}

async function extractFullText(PDFViewerApplication: any): Promise<{ pageNumber: number; text: string }[]> {
  const pdfDoc = PDFViewerApplication.pdfDocument;
  if (!pdfDoc) throw new Error('No PDF document loaded');

  const numPages = pdfDoc.numPages;
  const pages: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .filter((item: any) => item.str !== undefined)
      .map((item: any) => item.str)
      .join('');
    pages.push({ pageNumber: i, text });
  }

  return pages;
}

export function initTextExtraction() {
  window.TractorBeamTextExtraction = {
    extractFullText,
  };
  console.log('[pdfjs-additions] Text extraction initialized');
}
