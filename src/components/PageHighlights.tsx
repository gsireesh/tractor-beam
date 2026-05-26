import { HighlightOverlay } from './HighlightOverlay.tsx';
import { Highlight } from '@/lib/definitions';

interface PageHighlightsProps {
  pageNumber: number;
  highlights: Highlight[];
}

export function PageHighlights({ pageNumber, highlights }: PageHighlightsProps) {
  return (
    <>
      {highlights.filter((hl) => hl.coords != null).map((hl) => {
        return <HighlightOverlay
          key={hl.id}
          highlightId={hl.id}
          classId={hl.classId}
          schemaId={hl.schemaId}
          allCoords={hl.coords.filter(box => box.pageNumber === pageNumber)}
          color={hl.color}
          source={hl.source}
          text={hl.text}
          positiveExample={hl.positiveExample}
          />
      })}
    </>
  );
}
