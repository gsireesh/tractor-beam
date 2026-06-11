import { useMemo, useState } from 'react';

import { Schema } from '@/lib/definitions';
import { ExportFormat, ExportOptions } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ExportPanelProps {
  schema: Schema;
  onExport: (opts: ExportOptions) => void;
  onClose: () => void;
}

/**
 * The export form. Format and content are coupled 1:1 (JSON = full schema,
 * CSV = flattened instance list); a single toggle controls whether negative
 * examples land in the downloaded file.
 */
export function ExportPanel({ schema, onExport, onClose }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [includeNegatives, setIncludeNegatives] = useState(true);

  const { total, negatives } = useMemo(() => {
    let total = 0;
    let negatives = 0;
    for (const cls of schema.classes) {
      for (const inst of cls.instances) {
        total++;
        if (!inst.positiveExample) negatives++;
      }
    }
    return { total, negatives };
  }, [schema]);

  const exported = includeNegatives ? total : total - negatives;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Format</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={format}
          onValueChange={(v) => v && setFormat(v as ExportFormat)}
        >
          <ToggleGroupItem value="json">JSON (schema)</ToggleGroupItem>
          <ToggleGroupItem value="csv">CSV (instances)</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Toggle
        variant="outline"
        size="sm"
        className="w-fit"
        pressed={includeNegatives}
        onPressedChange={setIncludeNegatives}
      >
        Include negative examples
      </Toggle>

      <p className="text-sm text-muted-foreground">
        Exporting {schema.classes.length} {schema.classes.length === 1 ? 'class' : 'classes'} /{' '}
        {exported} {exported === 1 ? 'instance' : 'instances'}
        {!includeNegatives && negatives > 0 && ` (${negatives} negative excluded)`}.
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onExport({ format, includeNegatives });
            onClose();
          }}
        >
          Export
        </Button>
      </div>
    </div>
  );
}
