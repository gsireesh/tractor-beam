import type { Story } from '@ladle/react';
import { SchemaViewer } from './SchemaViewer.tsx';
import { placeholderSchemas } from '@/lib/placeholder-schemas.ts';
import { DrawerContext } from '@/contexts/DrawerContext.tsx';

// "STS Reading" (index 1) is the schema with populated classes + instances, so the
// viewer renders a realistic stack of class accordions instead of an empty shell.
const schema = placeholderSchemas[1];
const dispatch = () => {};

// A drawer-sized, bounded flex column so SchemaViewer's `flex-1` fills it and the
// sticky toolbar / scroll behavior we just wired up read realistically.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex h-[480px] w-[420px] flex-col overflow-hidden border border-gray-300 shadow-sm">
    {children}
  </div>
);

export const Default: Story = () => {
  return (
    <DrawerContext.Provider
      value={{
        activeSchema: schema,
        pdfUrl: '',
        dispatch,
        removeMlHighlight: () => {},
      }}
    >
      <Frame>
        <SchemaViewer schema={schema} dispatch={dispatch} />
      </Frame>
    </DrawerContext.Provider>
  );
};
