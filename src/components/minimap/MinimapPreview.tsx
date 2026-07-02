/**
 * A floating, rendered slice of the page shown while hovering the minimap: a real
 * rasterized full-width band (via TractorBeamPdf.renderRegion), positioned to the left
 * of the strip and vertically centered on the cursor.
 */
export function MinimapPreview({
  src,
  topPx,
  rightPx,
  width,
}: {
  src: string;
  topPx: number; // viewport Y to center on (fixed positioning)
  rightPx: number; // distance from the right edge (left of the strip)
  width: number; // px
}) {
  return (
    <div className="tractor-beam-minimap-preview" style={{ top: topPx, right: rightPx, width }}>
      <img src={src} alt="" style={{ width: '100%', display: 'block' }} />
    </div>
  );
}
