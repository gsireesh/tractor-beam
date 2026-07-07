import { SchemaClassViewer } from '@/components/sidebar/SchemaClassViewer.tsx';

import { Schema, SchemaAction } from '@/lib/definitions.ts';
import { ListPlus } from 'lucide-react';
import { useState } from 'react';
import { createNewClass } from '@/lib/utils.ts';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { SchemaHistory } from '@/components/sidebar/SchemaHistory.tsx';
import { SchemaBookmarkButton } from '@/components/sidebar/SchemaBookmarkButton.tsx';

interface SchemaViewerProps {
  schema: Schema;
  dispatch: (action: SchemaAction) => void;
}

export function SchemaViewer({ schema, dispatch }: SchemaViewerProps) {
  // activeSchema can be undefined for a beat before schemas load (or if the store
  // is empty); render nothing rather than dereferencing schema.classes.
  if (!schema) return null;

  return <SchemaViewerInner schema={schema} dispatch={dispatch} />;
}

// Split out so the newly-created-class state lives below the early `!schema`
// return — hooks can't run conditionally in the outer component.
function SchemaViewerInner({ schema, dispatch }: SchemaViewerProps) {
  // Id of the class most recently added here, so its viewer can mount straight
  // into title-edit mode with focus. Only meaningful on that viewer's first
  // render (see SchemaClassViewer's autoEdit handling).
  const [newClassId, setNewClassId] = useState<string | null>(null);

  return (
    <div>
      <div className="sticky top-0 z-10 bg-card">
        <div className="flex justify-end gap-1">
          <IconButton
            title="Add New Highlighter"
            icon={ListPlus}
            label={'Add New Highlighter'}
            strokeWidth={2}
            onClick={() => {
              const newClass = createNewClass(
                'Highlighter Name',
                '',
                [],
                schema.classes.map((c) => c.color),
              );
              setNewClassId(newClass.id);
              dispatch({
                actionType: 'addClass',
                schemaId: schema.id,
                classInfo: newClass,
              });
            }}
          />
          <SchemaBookmarkButton schema={schema} />
          <SchemaHistory schema={schema} />
        </div>
        <Separator />
      </div>
      <ul className="list-none p-0 m-0">
        {schema.classes.map((sc) => (
          <SchemaClassViewer
            key={sc.id}
            schemaId={schema.id}
            schemaClass={sc}
            dispatch={dispatch}
            autoEdit={sc.id === newClassId}
          />
        ))}
      </ul>
    </div>
  );
}
