/**
 * A floating, rendered slice of the page shown while hovering the minimap: a real
 * rasterized full-width band (via TractorBeamPdf.renderRegion), with the suggested
 * annotations layered on top as the same wavy "squiggle" divs used on the page, so the
 * preview matches the live document. Positioned left of the strip, centered on the cursor.
 */

export interface PreviewOverlay {
  key: string;
  left: string; // % of the image width
  top: string; // % of the image height
  width: string; // %
  height: string; // css length (calc with a px scallop allowance)
  color: string; // rgba(...) fill
  maskStyle: { mask: string; WebkitMask: string } | Record<string, never>;
}

export function MinimapPreview({
  src,
  topPx,
  rightPx,
  width,
  overlays,
}: {
  src: string;
  topPx: number; // viewport Y to center on (fixed positioning)
  rightPx: number; // distance from the right edge (left of the strip)
  width: number; // px
  overlays: PreviewOverlay[];
}) {
  return (
    <div className="tractor-beam-minimap-preview" style={{ top: topPx, right: rightPx, width }}>
      <div style={{ position: 'relative' }}>
        <img src={src} alt="" style={{ width: '100%', display: 'block' }} />
        {overlays.map((o) => (
          <div
            key={o.key}
            style={{
              position: 'absolute',
              left: o.left,
              top: o.top,
              width: o.width,
              height: o.height,
              pointerEvents: 'none',
            }}
          >
            <div
              className="w-full h-full rounded-sm mix-blend-multiply"
              style={{ backgroundColor: o.color, ...o.maskStyle }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
