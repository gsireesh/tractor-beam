import { HighlightOverlay } from './HighlightOverlay.tsx';
import { Highlight } from '@/lib/definitions';

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
            <HighlightOverlay
              key={`${hl.id}-${i}`}
              highlightId={hl.id}
              classId={hl.classId}
              schemaId={hl.schemaId}
              left={box.left}
              top={box.top}
              width={box.width}
              height={box.height}
              color={hl.color}
              source={hl.source}
              text={hl.text}
              allCoords={hl.coords}
              positiveExample={hl.positiveExample}
            />
          ));
      })}
    </>
  );
}
