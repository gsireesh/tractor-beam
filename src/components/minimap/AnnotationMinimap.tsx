import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Highlight } from '@/lib/definitions';
import { scrollToAnnotation } from '@/lib/pdf-navigation';
import { bodyToBorderColor } from '@/lib/utils';
import { wavyBoxFromHeight } from '@/components/highlights/wavy-mask';
import { fractionToLocation, usePdfPageLayout, type PdfLayout } from './usePdfPageLayout';
import { MinimapPreview, type PreviewOverlay } from './MinimapPreview';

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

// Keep in sync with DRAWER_WIDTH in DrawerContainer.tsx — the strip rides the drawer
// tab's band, so it shifts left by the drawer's width when the drawer is open.
const DRAWER_WIDTH = 380;
const FALLBACK_COLOR = '#9370DB';
const STRIP_WIDTH = 28;
const PREVIEW_GAP = 8; // px between the strip and the preview
const PREVIEW_MIN_WIDTH = 260; // px floor so it stays readable on narrow windows
const PREVIEW_BAND = 0.16; // fraction of page height shown in the slice
const HOVER_DEBOUNCE_MS = 70;

/**
 * The fully-opaque "border" variant of a class color (stored as translucent
 * rgba(…,0.3) fill). Same treatment the on-page highlights use for borders, so the
 * minimap ticks read at full saturation instead of the faint 30% fill.
 */
function rectColor(color: string): string {
  if (!color) return FALLBACK_COLOR;
  try {
    return bodyToBorderColor(color);
  } catch {
    return color; // already a solid (e.g. hex) color
  }
}

interface MinimapRect {
  key: string;
  top: number; // % of strip height
  height: number; // %
  left: number; // % of strip width
  width: number; // %
  color: string;
}

/**
 * Project every suggested-annotation box onto the strip. Uses the exact same
 * normalized-coord math the on-page overlays use (`box.top * pageHeight`), then
 * expresses it as a fraction of the whole document's scroll height so the strip is
 * proportional to the real document.
 */
function computeRects(highlights: Highlight[], layout: PdfLayout): MinimapRect[] {
  if (layout.scrollHeight <= 0) return [];
  const pageByNumber = new Map(layout.pages.map((p) => [p.pageNumber, p]));
  const rects: MinimapRect[] = [];

  for (const h of highlights) {
    h.coords.forEach((box, i) => {
      const page = pageByNumber.get(box.pageNumber);
      if (!page) return;
      const topPx = page.top + box.top * page.height;
      const heightPx = box.height * page.height;
      rects.push({
        key: `${h.id}-${i}`,
        top: (topPx / layout.scrollHeight) * 100,
        // Floor the height so a single-line box stays visible on a long document.
        height: Math.max((heightPx / layout.scrollHeight) * 100, 0.4),
        left: box.left * 100,
        width: Math.max(box.width * 100, 8),
        color: rectColor(h.color),
      });
    });
  }
  return rects;
}

/**
 * A vertical minimap of suggested (ML) annotations, pinned to the drawer tab's 28px
 * band over the scrollbar. Only rendered when suggestions exist; updates live as they
 * stream in (it re-renders with `mlHighlights`). Read-only over ML state — it maps
 * cleanly onto the future `ml` store slice (docs/architecture/02).
 */
export function AnnotationMinimap({
  mlHighlights,
  isOpen,
}: {
  mlHighlights: Highlight[];
  isOpen: boolean;
}) {
  const active = mlHighlights.length > 0;
  const layout = usePdfPageLayout(active);
  const stripRef = useRef<HTMLDivElement>(null);

  // Hover preview: a rendered slice + the viewport-Y to center it on. `hoverReq`
  // tags each render request so a slower earlier render can't clobber a newer one.
  const [preview, setPreview] = useState<{
    src: string;
    topPx: number;
    width: number;
    overlays: PreviewOverlay[];
  } | null>(null);
  const hoverReq = useRef(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const rects = useMemo(() => computeRects(mlHighlights, layout), [mlHighlights, layout]);

  // Cancel any pending render + hide the preview when the minimap goes away.
  useEffect(() => {
    if (active) return;
    clearTimeout(hoverTimer.current);
    hoverReq.current++;
    setPreview(null);
  }, [active]);

  if (!active) return null;

  const stripRight = isOpen ? DRAWER_WIDTH : 0;
  // Space left of the strip; the preview is capped to this so it never runs off-screen.
  const availableWidth = window.innerWidth - (stripRight + STRIP_WIDTH + PREVIEW_GAP);

  const eventFraction = (e: MouseEvent<HTMLDivElement>): number => {
    const el = stripRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const loc = fractionToLocation(eventFraction(e), layout);
    if (!loc) return;
    // Reuse the sidebar's jump-to-highlight path with a zero-size synthetic box.
    scrollToAnnotation([
      { pageNumber: loc.pageNumber, left: 0, top: loc.normalizedTop, width: 0, height: 0 },
    ]);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const loc = fractionToLocation(eventFraction(e), layout);
    if (!loc) return;
    const topPx = e.clientY;
    // Match the page's current on-screen (zoomed) width, so the preview reflects the
    // magnification you're viewing at — capped to the space available left of the strip.
    const page = layout.pages.find((p) => p.pageNumber === loc.pageNumber);
    const displayWidth = Math.max(
      PREVIEW_MIN_WIDTH,
      Math.min(page?.width ?? availableWidth, availableWidth),
    );

    // The slice band, clamped exactly as renderRegion clamps it, so overlay boxes map
    // into the same region the raster shows.
    const regionTop = clamp01(loc.normalizedTop - PREVIEW_BAND / 2);
    const regionHeight = Math.min(PREVIEW_BAND, 1 - regionTop);
    // Full page height at the preview's display width — the basis for each box's
    // rendered pixel height (and thus its squiggle wavelength).
    const pageAspect = page && page.width > 0 ? page.height / page.width : 0;
    const pageHeightPx = displayWidth * pageAspect;

    // Suggested annotations on this page, as the same wavy overlays used on the page.
    const overlays: PreviewOverlay[] = mlHighlights.flatMap((h) =>
      h.coords
        .filter(
          (b) =>
            b.pageNumber === loc.pageNumber &&
            b.top + b.height >= regionTop &&
            b.top <= regionTop + regionHeight,
        )
        .map((b, i) => {
          const { style, extraHeightPx } = wavyBoxFromHeight(b.height * pageHeightPx);
          return {
            key: `${h.id}-${i}`,
            left: `${b.left * 100}%`,
            top: `${((b.top - regionTop) / regionHeight) * 100}%`,
            width: `${b.width * 100}%`,
            height: `calc(${(b.height / regionHeight) * 100}% + ${extraHeightPx}px)`,
            color: h.color || FALLBACK_COLOR,
            maskStyle: style,
          };
        }),
    );

    const req = ++hoverReq.current;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      const api = window.TractorBeamPdf;
      if (!api) return;
      api
        .renderRegion({
          pageNumber: loc.pageNumber,
          top: loc.normalizedTop - PREVIEW_BAND / 2,
          height: PREVIEW_BAND,
          // Render the full page at its on-screen display width so text is sharp and
          // tracks the current zoom.
          targetWidthPx: displayWidth,
        })
        .then((res) => {
          if (req !== hoverReq.current) return; // a newer hover superseded this one
          setPreview({ src: res.dataUrl, topPx, width: displayWidth, overlays });
        })
        .catch(() => {});
    }, HOVER_DEBOUNCE_MS);
  };

  const handleMouseLeave = () => {
    hoverReq.current++; // invalidate any in-flight render
    clearTimeout(hoverTimer.current);
    setPreview(null);
  };

  const viewportTop = layout.scrollHeight > 0 ? (layout.scrollTop / layout.scrollHeight) * 100 : 0;
  const viewportHeight =
    layout.scrollHeight > 0 ? (layout.clientHeight / layout.scrollHeight) * 100 : 0;

  return (
    <>
      <div
        ref={stripRef}
        className="tractor-beam-minimap"
        style={{ right: stripRight }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="tractor-beam-minimap-viewport"
          style={{ top: `${viewportTop}%`, height: `${viewportHeight}%` }}
        />
        {rects.map((r) => (
          <div
            key={r.key}
            className="tractor-beam-minimap-rect"
            style={{
              top: `${r.top}%`,
              height: `${r.height}%`,
              left: `${r.left}%`,
              width: `${r.width}%`,
              backgroundColor: r.color,
            }}
          />
        ))}
      </div>
      {preview && (
        <MinimapPreview
          src={preview.src}
          topPx={preview.topPx}
          rightPx={stripRight + STRIP_WIDTH + PREVIEW_GAP}
          width={preview.width}
          overlays={preview.overlays}
        />
      )}
    </>
  );
}
