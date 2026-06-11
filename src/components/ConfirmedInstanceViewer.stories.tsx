import type { Story } from '@ladle/react';
import { ConfirmedInstanceViewer } from './ConfirmedInstanceViewer';
import { placeholderSchemas } from '@/lib/placeholder-schemas';
import { rgbaToHex } from '@/lib/utils';
import { DrawerContext } from '@/contexts/DrawerContext';

// The "STS Reading" schema (index 1) carries classes with populated `instances`
// that have real PDF coords — so the viewer has something to resolve and render.
const activeSchema = placeholderSchemas[1];
const schemaClass = activeSchema.classes.find((c) => c.instances.length > 0)!;
const instances = schemaClass.instances.slice(0, 3);

// ConfirmedInstanceViewer reads/writes through DrawerContext. Provide a stub so
// it resolves its instance; dispatch is a no-op (the story just renders the form —
// edits/deletes aren't persisted here).
const stubContext = {
  activeSchema,
  pdfUrl: '',
  dispatch: () => {},
  removeMlHighlight: () => {},
};

// Mimic the schema-viewer backdrop: in the app these cards sit inside the class
// accordion, whose background is the class color at low alpha. Tinting the frame
// the same way lets you judge the white card's contrast realistically.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    className="relative w-[420px] rounded-lg border p-2 shadow-sm"
    style={{
      backgroundColor: rgbaToHex(schemaClass.color),
      borderColor: rgbaToHex(schemaClass.color, 1.0),
    }}
  >
    {children}
  </div>
);

export const ConfirmedInstances: Story = () => (
  <DrawerContext.Provider value={stubContext}>
    <Frame>
      {instances.map((instance) => (
        <ConfirmedInstanceViewer
          key={instance.id}
          schemaId={activeSchema.id}
          classId={schemaClass.id}
          instanceId={instance.id}
          coords={instance.coords}
        />
      ))}
    </Frame>
  </DrawerContext.Provider>
);
