import { useState } from 'react';

import { SchemaClassViewer } from '@/components/sidebar/SchemaClassViewer.tsx';
import { ExpandableIconButtonBar } from '@/components/sidebar/ExpandableIconButtonBar.tsx';
import { ExportModal } from '@/components/export/ExportModal.tsx';

import { PiListPlus, PiTable, PiDownloadSimple } from 'react-icons/pi';
import { Schema, SchemaAction } from '@/lib/definitions.ts';
import { createNewClass } from '@/lib/utils.ts';
import { createSnapshot } from '@/lib/schema-storage.ts';
import { exportSchema, ExportOptions } from '@/lib/export.ts';
import { APP_CONFIG } from '@/app-config.ts';

interface SchemaViewerProps {
  schema: Schema;
  dispatch: (action: SchemaAction) => void;
}

export function SchemaViewer({ schema, dispatch }: SchemaViewerProps) {
  const [exportOpen, setExportOpen] = useState(false);

  // activeSchema can be undefined for a beat before schemas load (or if the store
  // is empty); render nothing rather than dereferencing schema.classes.
  if (!schema) return null;

  // Bookmark the complete schema, then download the (possibly filtered) view.
  const handleExport = (opts: ExportOptions) => {
    createSnapshot(APP_CONFIG.indexedDBConfig, schema).catch((e) =>
      console.error('[export] snapshot failed', e),
    );
    exportSchema(schema, opts);
  };

  return (
    <div>
      <ExpandableIconButtonBar
        className="mb-1 sticky top-0 z-10"
        items={[
          {
            key: 'add-class',
            label: 'Add new class',
            icon: PiListPlus,
            onClick: () =>
              dispatch({
                actionType: 'addClass',
                schemaId: schema.id,
                classInfo: createNewClass(
                  'New Class',
                  'This text describes what this class is.',
                  [],
                  schema.classes.map((c) => c.color),
                ),
              }),
          },
          {
            key: 'open-manager',
            label: 'Open Schema Manager',
            icon: PiTable,
            onClick: () =>
              browser.runtime.sendMessage({ type: 'openSchemaManager', schemaId: schema.id }),
          },
          {
            key: 'export',
            label: 'Export data',
            icon: PiDownloadSimple,
            onClick: () => setExportOpen(true),
          },
        ]}
      />
      <ExportModal
        open={exportOpen}
        schema={schema}
        container={document.getElementById('tractor-beam-drawer-root')}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />
      <ul className="list-none p-0 m-0">
        {schema.classes.map((sc) => (
          <SchemaClassViewer
            key={sc.id}
            schemaId={schema.id}
            schemaClass={sc}
            dispatch={dispatch}
          />
        ))}
      </ul>
    </div>
  );
}
