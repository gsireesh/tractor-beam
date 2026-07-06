import type { MouseEvent } from 'react';
import { Signpost } from '@/lib/definitions.ts';
import { scrollToAnnotation } from '@/lib/pdf-navigation.ts';
import { EditInstanceInline } from '@/components/navigation/EditInstanceInline.tsx';

export function ConfirmedHighlightSignpost({
  id,
  schemaId,
  classId,
  coords,
  onPageClick,
  sectionPath,
  onSectionClick,
}: Signpost & {
  onPageClick?: (page: number) => void;
  sectionPath?: { key: number; title: string }[];
  onSectionClick?: (key: number) => void;
}) {
  // Clicking the card navigates to the annotation in the PDF — except when the
  // click lands on a form control (notes textarea, class picker, delete), which
  // should do their own thing. The class dropdown is portaled out of the card,
  // so its option clicks never reach this handler.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input, textarea, button')) return;
    if (coords) {
      scrollToAnnotation(coords);
      window.TractorBeamHighlights?.flashHighlight(id);
    }
  };
  return (
    <div className="mx-1 my-2 cursor-pointer" onClick={handleClick}>
      <EditInstanceInline
        schemaId={schemaId}
        classId={classId}
        instanceId={id}
        onPageClick={onPageClick}
        sectionPath={sectionPath}
        onSectionClick={onSectionClick}
      />
    </div>
  );
}
