import type { PdfBox } from '@/lib/definitions';

export type { PdfBox };

export const VISUAL_BLOCK_CLASS_ID = '__visual-block__';

export interface HighlightOverlayProps {
  highlightId: string;
  classId: string;
  schemaId: string;
  color: string;
  source?: 'manual' | 'ml';
  text?: string;
  allCoords?: PdfBox[];
  positiveExample: boolean,
}
