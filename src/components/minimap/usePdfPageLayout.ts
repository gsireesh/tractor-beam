import { useEffect, useState } from 'react';

/**
 * Live geometry of the pdf.js page stack, sourced from the DOM (not React state —
 * page count/sizes don't live in any store). pdf.js pre-creates every
 * `.page[data-page-number]` div at its correct height before rasterizing the canvas,
 * so offsets are available for on- and off-screen pages alike.
 *
 * All measurements are in the same coordinate space `scrollToAnnotation`
 * (src/lib/pdf-navigation.ts) uses — `.page` `offsetTop` against
 * `#viewerContainer.scrollTop` — so the minimap and the existing jump-to-highlight
 * agree on where a page is.
 */
export interface PageMetric {
  pageNumber: number;
  top: number; // px, offset within the scrolled content
  height: number; // px, current on-screen height (tracks zoom)
  width: number; // px, current on-screen width (tracks zoom)
}

export interface PdfLayout {
  pages: PageMetric[];
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

const EMPTY: PdfLayout = { pages: [], scrollHeight: 0, scrollTop: 0, clientHeight: 0 };

function readLayout(): PdfLayout {
  const viewerContainer = document.getElementById('viewerContainer');
  if (!viewerContainer) return EMPTY;

  const pages: PageMetric[] = [];
  document.querySelectorAll<HTMLElement>('.page[data-page-number]').forEach((el) => {
    const pageNumber = Number(el.getAttribute('data-page-number'));
    if (!pageNumber) return;
    pages.push({
      pageNumber,
      top: el.offsetTop,
      height: el.clientHeight,
      width: el.clientWidth,
    });
  });

  return {
    pages,
    scrollHeight: viewerContainer.scrollHeight,
    scrollTop: viewerContainer.scrollTop,
    clientHeight: viewerContainer.clientHeight,
  };
}

/**
 * Track the page stack + scroll position while `active`, recomputing on scroll
 * (viewport indicator) and on reflow/zoom (ResizeObserver on #viewer). Reads are
 * coalesced into a single rAF so a burst of scroll events causes one state update.
 */
export function usePdfPageLayout(active: boolean): PdfLayout {
  const [layout, setLayout] = useState<PdfLayout>(EMPTY);

  useEffect(() => {
    if (!active) {
      setLayout(EMPTY);
      return;
    }
    const viewerContainer = document.getElementById('viewerContainer');
    const viewer = document.getElementById('viewer');
    if (!viewerContainer) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setLayout(readLayout()));
    };
    update();

    viewerContainer.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = viewer ? new ResizeObserver(update) : null;
    ro?.observe(viewer!);

    return () => {
      cancelAnimationFrame(raf);
      viewerContainer.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [active]);

  return layout;
}

/**
 * Map a 0–1 fraction down the strip to a document location: which page, and the
 * normalized (0–1) vertical position within that page. Pure — the inverse of how
 * rectangles are placed, so a click lands where the dots appear.
 */
export function fractionToLocation(
  fraction: number,
  layout: PdfLayout,
): { pageNumber: number; normalizedTop: number } | null {
  if (layout.scrollHeight <= 0 || layout.pages.length === 0) return null;

  const contentY = fraction * layout.scrollHeight;
  // Last page whose top is at or above contentY (pages are in document order),
  // upgrading to an exact containment match when one exists.
  let target = layout.pages[0];
  for (const p of layout.pages) {
    if (contentY >= p.top) target = p;
    if (contentY >= p.top && contentY < p.top + p.height) break;
  }
  const normalizedTop = target.height > 0 ? (contentY - target.top) / target.height : 0;
  return {
    pageNumber: target.pageNumber,
    normalizedTop: Math.min(Math.max(normalizedTop, 0), 1),
  };
}
