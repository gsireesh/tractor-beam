import React from 'react';
import { Highlight } from './Highlight.tsx';
import { PdfBox } from '@/lib/definitions';

interface HighlightProps {
  id: string;
  classId: string;
  coords: PdfBox[];
  source?: 'manual' | 'ml';
  text?: string;
  color: string;
}

interface PageHighlightsProps {
  pageNumber: number;
  highlights: HighlightProps[];
}

export function PageHighlights({ pageNumber, highlights }: PageHighlightsProps) {
  return (
    <>
      {highlights.flatMap((hl) => {
        if (!hl.coords) return [];
        return hl.coords
          .filter((box) => box.pageNumber === pageNumber)
          .map((box, i) => (
            <Highlight
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
