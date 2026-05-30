import { createContext, useContext } from 'react';
import type { Schema } from '@/lib/definitions';
import type { SchemaAction } from '@/lib/schema-reducer';

export interface DrawerContextValue {
    activeSchema: Schema;
    pdfUrl: string;
    dispatch: (action: SchemaAction) => void;
    /** Drop a provisional (ML) highlight, e.g. after it's promoted to an instance. */
    removeMlHighlight: (highlightId: string) => void;
}

export const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useDrawerContext(): DrawerContextValue {
    const ctx = useContext(DrawerContext);
    if (!ctx) {
        throw new Error('useDrawerContext must be used within a DrawerContext provider!');
    }
    return ctx;
}