import React from 'react';
import { HighlightRect } from './HighlightRect';

interface PdfBox {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Highlight {
  id: string;
  classId: string;
  coords: PdfBox[];
  source?: 'manual' | 'ml';
  text?: string;
}

const COLORS = [
  'rgba(255, 182, 193, 0.3)', // pink
  'rgba(255, 218, 185, 0.3)', // peach
  'rgba(255, 255, 186, 0.3)', // yellow
  'rgba(186, 255, 201, 0.3)', // mint
  'rgba(186, 225, 255, 0.3)', // sky blue
  'rgba(216, 191, 255, 0.3)', // lavender
  'rgba(255, 200, 221, 0.3)', // rose
  'rgba(200, 255, 240, 0.3)', // aqua
  'rgba(255, 228, 196, 0.3)', // bisque
  'rgba(230, 230, 250, 0.3)', // periwinkle
];

function hashId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getHighlightColor(classId: string): string {
  return COLORS[hashId(classId) % COLORS.length];
}

interface PageHighlightsProps {
  pageNumber: number;
  highlights: Highlight[];
}

export function PageHighlights({ pageNumber, highlights }: PageHighlightsProps) {
  return (
    <>
      {highlights.flatMap((hl) => {
        if (!hl.coords) return [];
        const color = getHighlightColor(hl.classId);
        return hl.coords
          .filter((box) => box.pageNumber === pageNumber)
          .map((box, i) => (
            <HighlightRect
              key={`${hl.id}-${i}`}
              highlightId={hl.id}
              classId={hl.classId}
              left={box.left}
              top={box.top}
              width={box.width}
              height={box.height}
              color={color}
              source={hl.source}
              text={hl.text}
              allCoords={hl.coords}
            />
          ));
      })}
    </>
  );
}
