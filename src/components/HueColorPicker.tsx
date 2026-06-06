import { useEffect, useState } from "react";
import { highlightColorForHue, hueOfColor } from "@/lib/highlight-palette.ts";
import { rgbaToHex } from "@/lib/utils.ts";

// Hue stops used to paint the slider track. Because L/S are locked in
// `highlightColorForHue`, this gradient *is* the band of pickable colors — the
// track previews exactly what the user can land on, not a generic rainbow.
const TRACK_GRADIENT = `linear-gradient(to right, ${Array.from(
  { length: 13 },
  (_, i) => rgbaToHex(highlightColorForHue(i * 30), 1.0),
).join(", ")})`;

/**
 * Continuous hue picker: the user drags across all 360° of hue, but lightness and
 * saturation stay pinned to the highlight-safe band, so every result is legible
 * under `mix-blend-multiply` and harmonious with the rest of the palette.
 */
export function HueColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [hue, setHue] = useState<number>(() => hueOfColor(value) ?? 0);

  // Sync the thumb when the color changes from outside the slider (e.g. a swatch
  // click), so the picker reflects the class's current color. Doesn't fight an
  // active drag: dragging only commits on release, so `value` is stable mid-drag.
  useEffect(() => {
    setHue(hueOfColor(value) ?? 0);
  }, [value]);

  const preview = rgbaToHex(highlightColorForHue(hue), 1.0);
  // Commit on release rather than per-frame, so a drag is one undoable change and
  // one persisted write instead of dozens.
  const commit = () => onChange(highlightColorForHue(hue));

  return (
    <div className="w-48 p-2">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="h-5 w-5 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: preview }}
        />
        <span className="text-xs text-black/60">{Math.round(hue)}°</span>
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => setHue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="w-full h-3 appearance-none rounded-full cursor-pointer"
        style={{ background: TRACK_GRADIENT }}
      />
    </div>
  );
}
