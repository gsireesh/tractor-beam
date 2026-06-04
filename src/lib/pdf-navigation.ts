import type { PdfBox } from '@/lib/definitions';

const VERTICAL_OFFSET = 1/3;

/**
 * Scroll the PDF viewer to bring a specific annotation into view.
 */
export function scrollToAnnotation(coords: PdfBox[]) {
  if (coords.length === 0) return;

  const box = coords[0];
  const viewerContainer = document.getElementById('viewerContainer');
  const pageEl = document.querySelector<HTMLElement>(`.page[data-page-number="${box.pageNumber}"]`);

  if (!viewerContainer || !pageEl) {
    console.warn('[pdf-navigation] Could not find viewerContainer or page element');
    return;
  }

  const destinationY = pageEl.offsetTop + (box.top * pageEl.clientHeight) - VERTICAL_OFFSET * viewerContainer.clientHeight;
  viewerContainer.scrollTo({top: destinationY, left: 0, behavior: "smooth"})
}
