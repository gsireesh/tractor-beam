import { SchemaClassViewer } from '@/components/sidebar/SchemaClassViewer.tsx';

import { Schema, SchemaAction } from '@/lib/definitions.ts';
import { ListPlus } from 'lucide-react';
import { createNewClass } from '@/lib/utils.ts';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { Separator } from '@/components/ui/separator.tsx';

interface SchemaViewerProps {
  schema: Schema;
  dispatch: (action: SchemaAction) => void;
}

export function SchemaViewer({ schema, dispatch }: SchemaViewerProps) {
  // activeSchema can be undefined for a beat before schemas load (or if the store
  // is empty); render nothing rather than dereferencing schema.classes.
  if (!schema) return null;

  return (
    <div>
      <div className="flex justify-end">
        <IconButton
          title="Add Class"
          icon={ListPlus}
          strokeWidth={2}
          onClick={() => {
            dispatch({
              actionType: 'addClass',
              schemaId: schema.id,
              classInfo: createNewClass(
                'New Class',
                'This text describes what this class is.',
                [],
                schema.classes.map((c) => c.color),
              ),
            });
          }}
        />
      </div>
      <Separator />
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
