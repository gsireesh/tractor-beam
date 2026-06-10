/**
 * Filtering for the Schema Manager table.
 *
 * The row projection (`ManagerRow`, `flattenSchema`) lives in `@/lib/manager-row`
 * so the export lib can share it; `ManagerRow` is re-exported here for the
 * manager's existing importers.
 */

import { ManagerRow } from '@/lib/manager-row';

export type { ManagerRow };

export interface FilterState {
  /** Class ids the user wants to see. */
  classIds: string[];
  /** Exact PDF URL to restrict to, or null for "all PDFs". */
  pdfUrl: string | null;
  /** Free-text search over the highlighted content (`text`). */
  contentQuery: string;
  /** Free-text search over the notes. */
  notesQuery: string;
}

export function applyFilters(rows: ManagerRow[], filters: FilterState): ManagerRow[] {
  return rows
    .filter((row) => filters.pdfUrl === null || filters.pdfUrl === row.pdfUrl)
    .filter((row) => filters.classIds.length == 0 || filters.classIds.includes(row.classId))
    .filter(
      (row) =>
        filters.contentQuery.length === 0 ||
        row.text.toLowerCase().includes(filters.contentQuery.toLowerCase()),
    )
    .filter(
      (row) =>
        filters.notesQuery.length === 0 ||
        (row.notes?.toLowerCase().includes(filters.notesQuery.toLowerCase()) ?? false),
    );
}
