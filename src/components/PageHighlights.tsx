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
  color: string;
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
              color={hl.color}
              source={hl.source}
              text={hl.text}
              allCoords={hl.coords}
            />
          ));
      })}
    </>
  );
}
