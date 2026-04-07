import type { PdfBox } from '@/lib/definitions';

export type { PdfBox };

export const VISUAL_BLOCK_CLASS_ID = '__visual-block__';

export interface HighlightRectProps {
  highlightId: string;
  classId: string;
  schemaId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  source?: 'manual' | 'ml';
  text?: string;
  allCoords?: PdfBox[];
}
