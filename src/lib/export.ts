/**
 * Schema export: serialize the active schema to a downloadable JSON or CSV file.
 *
 * Pure (no React, no storage) so it stays trivially testable. Callers are
 * responsible for the DB-snapshot side effect — that's async and always uses the
 * COMPLETE schema, whereas the downloaded file is a VIEW that may drop negatives.
 */

import { Schema } from '@/lib/definitions';
import { flattenSchema, ManagerRow } from '@/lib/manager-row';

export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  /** When false, instances with `positiveExample === false` are omitted from the file. */
  includeNegatives: boolean;
}

export interface JsonExport {
  exportedAt: string;
  schemaId: string;
  schema: Schema;
}

/** Return a copy of the schema with negative instances stripped, or the schema as-is. */
function viewOfSchema(schema: Schema, includeNegatives: boolean): Schema {
  if (includeNegatives) return schema;
  return {
    ...schema,
    classes: schema.classes.map((cls) => ({
      ...cls,
      instances: cls.instances.filter((inst) => inst.positiveExample),
    })),
  };
}

export function buildJsonExport(schema: Schema, opts: ExportOptions): JsonExport {
  return {
    exportedAt: new Date().toISOString(),
    schemaId: schema.id,
    schema: viewOfSchema(schema, opts.includeNegatives),
  };
}

const CSV_HEADERS = ['Class', 'PDF', 'Content', 'Notes', 'Example'] as const;

export function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return '';
  else return /[,"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowToCells(row: ManagerRow): string[] {
  return [
    row.className,
    row.pdfUrl,
    row.text,
    row.notes ?? '',
    row.positiveExample ? 'positive' : 'negative',
  ];
}

export function buildCsvExport(schema: Schema, opts: ExportOptions): string {
  const rows = flattenSchema(schema).filter((r) => opts.includeNegatives || r.positiveExample);
  const lines = [CSV_HEADERS as readonly string[], ...rows.map(rowToCells)].map((cells) =>
    cells.map(escapeCsvField).join(','),
  );
  // Prepend a UTF-8 BOM so Excel opens the file as UTF-8 rather than ANSI.
  return '﻿' + lines.join('\r\n');
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'schema'
  );
}

export function exportFilename(schema: Schema, format: ExportFormat): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${slugify(schema.name)}-${timestamp}.${format}`;
}

export function triggerDownload(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Build the file for the chosen format and trigger a browser download. */
export function exportSchema(schema: Schema, opts: ExportOptions): void {
  if (opts.format === 'json') {
    const json = JSON.stringify(buildJsonExport(schema, opts), null, 2);
    triggerDownload(exportFilename(schema, 'json'), json, 'application/json');
  } else {
    const csv = buildCsvExport(schema, opts);
    triggerDownload(exportFilename(schema, 'csv'), csv, 'text/csv;charset=utf-8');
  }
}
