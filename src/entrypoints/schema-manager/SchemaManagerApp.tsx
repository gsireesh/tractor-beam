import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Search, X } from 'lucide-react';
import { Schema } from '@/lib/definitions';
import { rebuildState, createSnapshot } from '@/lib/schema-storage';
import { getPdfViewerUrl } from '@/lib/pdf-utils';
import { APP_CONFIG } from '@/app-config';
import { rgbaToHex, bodyToBorderColor } from '@/lib/utils';
import { exportSchema, ExportOptions } from '@/lib/export';
import { flattenSchema } from '@/lib/manager-row';
import { Button } from '@/components/ui/button';
import { ExportModal } from '@/components/export/ExportModal.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { applyFilters, FilterState } from './filters';

const ALL_PDFS = '__all__';

function emptyFilters(schema: Schema | undefined): FilterState {
  return {
    classIds: schema ? schema.classes.map((c) => c.id) : [],
    pdfUrl: null,
    contentQuery: '',
    notesQuery: '',
  };
}

export function SchemaManagerApp() {
  const [schemas, setSchemas] = useState<Schema[] | null>(null);
  const [activeSchemaId, setActiveSchemaId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters(undefined));
  const [exportOpen, setExportOpen] = useState(false);

  // Load all schemas once; pick the initial schema from ?schemaId= (set by the
  // "Open Schema Manager" button), falling back to the first schema.
  useEffect(() => {
    void rebuildState(APP_CONFIG.indexedDBConfig).then((result) => {
      setSchemas(result);
      const requested = new URLSearchParams(window.location.search).get('schemaId');
      const initial = result.find((s) => s.id === requested) ?? result[0];
      setActiveSchemaId(initial?.id ?? null);
    });
  }, []);

  const activeSchema = useMemo(
    () => schemas?.find((s) => s.id === activeSchemaId),
    [schemas, activeSchemaId],
  );

  // Reset filters whenever the active schema changes — class ids are schema-specific.
  useEffect(() => {
    setFilters(emptyFilters(activeSchema));
  }, [activeSchema]);

  const rows = useMemo(() => (activeSchema ? flattenSchema(activeSchema) : []), [activeSchema]);

  const pdfUrls = useMemo(() => Array.from(new Set(rows.map((r) => r.pdfUrl))).sort(), [rows]);

  const visibleRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  if (!schemas) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (schemas.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">No schemas found.</div>;
  }

  const toggleClass = (classId: string, pressed: boolean) =>
    setFilters((f) => ({
      ...f,
      classIds: pressed ? [...f.classIds, classId] : f.classIds.filter((id) => id !== classId),
    }));

  // Bookmark the complete schema and download the (possibly filtered) view.
  // The manager's on-screen filters are intentionally ignored — only the
  // modal's controls drive the export, so both entry points behave identically.
  const handleExport = (opts: ExportOptions) => {
    if (!activeSchema) return;
    createSnapshot(APP_CONFIG.indexedDBConfig, activeSchema).catch((e) =>
      console.error('[export] snapshot failed', e),
    );
    exportSchema(activeSchema, opts);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Schema Manager</h1>
        <Select value={activeSchemaId ?? undefined} onValueChange={setActiveSchemaId}>
          <SelectTrigger size="sm" className="min-w-48">
            <SelectValue placeholder="Select schema" />
          </SelectTrigger>
          <SelectContent container={document.getElementById('root')}>
            {schemas.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name || 'Untitled schema'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExportOpen(true)}
          disabled={!activeSchema}
        >
          <Download />
          Export
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          Showing {visibleRows.length} of {rows.length} instances
        </span>
      </header>

      <ExportModal
        open={exportOpen}
        schema={activeSchema ?? null}
        container={document.getElementById('root')}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />

      {/* ─── Filter bar ─── */}
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border p-3">
        <div className="flex flex-wrap gap-3">
          <InputGroup className="max-w-xs">
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search content…"
              value={filters.contentQuery}
              onChange={(e) => setFilters((f) => ({ ...f, contentQuery: e.target.value }))}
            />
            {filters.contentQuery && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear content search"
                  onClick={() => setFilters((f) => ({ ...f, contentQuery: '' }))}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          <InputGroup className="max-w-xs">
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search notes…"
              value={filters.notesQuery}
              onChange={(e) => setFilters((f) => ({ ...f, notesQuery: e.target.value }))}
            />
            {filters.notesQuery && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear notes search"
                  onClick={() => setFilters((f) => ({ ...f, notesQuery: '' }))}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          <Select
            value={filters.pdfUrl ?? ALL_PDFS}
            onValueChange={(v) => setFilters((f) => ({ ...f, pdfUrl: v === ALL_PDFS ? null : v }))}
          >
            <SelectTrigger size="sm" className="max-w-xs">
              <SelectValue placeholder="Filter by PDF" />
            </SelectTrigger>
            <SelectContent container={document.getElementById('root')}>
              <SelectItem value={ALL_PDFS}>All PDFs</SelectItem>
              {pdfUrls.map((url) => (
                <SelectItem key={url} value={url}>
                  {url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Class filter chips, colored by class. */}
        <div className="flex flex-wrap gap-2">
          {activeSchema?.classes.map((cls) => (
            <Toggle
              key={cls.id}
              variant="outline"
              size="sm"
              className="rounded-full"
              style={{
                backgroundColor: filters.classIds.includes(cls.id)
                  ? rgbaToHex(cls.color)
                  : undefined,
                borderColor: bodyToBorderColor(cls.color),
              }}
              pressed={filters.classIds.includes(cls.id)}
              onPressedChange={(p) => toggleClass(cls.id, p)}
            >
              {cls.name}
            </Toggle>
          ))}
        </div>
      </div>

      {/* ─── Table ─── */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="p-2 font-medium">Class</th>
            <th className="p-2 font-medium">PDF</th>
            <th className="p-2 font-medium">Content</th>
            <th className="p-2 font-medium">Notes</th>
            <th className="p-2 font-medium">Open</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted-foreground">
                No matching instances.
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr key={row.instanceId} className="border-b border-border align-top">
                <td className="p-2">
                  <span
                    className="inline-block rounded-full border px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: rgbaToHex(row.classColor),
                      borderColor: bodyToBorderColor(row.classColor),
                    }}
                  >
                    {row.className}
                  </span>
                </td>
                <td className="max-w-48 truncate p-2 text-muted-foreground" title={row.pdfUrl}>
                  {row.pdfUrl}
                </td>
                <td className="p-2 italic">{row.text}</td>
                <td className="p-2 text-muted-foreground">
                  {row.notes || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-2">
                  <a
                    href={getPdfViewerUrl(row.pdfUrl, {
                      schemaId: activeSchemaId ?? undefined,
                      instanceId: row.instanceId,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    title="Open in PDF viewer and jump to this highlight"
                  >
                    <ExternalLink size={14} />
                    Open
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
