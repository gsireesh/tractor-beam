/**
 * Row projection + filtering for the Schema Manager table.
 *
 * A ManagerRow is one confirmed instance, flattened out of the schema tree
 * (schema → class → instance) so it can live in a flat, filterable table.
 */

export interface ManagerRow {
  instanceId: string;
  classId: string;
  className: string;
  classColor: string; // rgba(...) string from SchemaClass.color
  pdfUrl: string;
  text: string;
  notes: string | null;
  positiveExample: boolean;
}

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
  return (rows
      .filter(row => filters.pdfUrl === null || filters.pdfUrl === row.pdfUrl)
      .filter(row => filters.classIds.length == 0 || filters.classIds.includes(row.classId))
      .filter(row => filters.contentQuery.length === 0 || row.text.toLowerCase().includes(filters.contentQuery.toLowerCase()))
      .filter(row => filters.notesQuery.length === 0 || (row.notes?.toLowerCase().includes(filters.notesQuery.toLowerCase()) ?? false))
  );
}
