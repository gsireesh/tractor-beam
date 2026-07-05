import { placeholderSchemas } from '@/lib/placeholder-schemas.ts';
import { Story } from '@ladle/react';
import { DrawerContext } from '@/contexts/DrawerContext.tsx';
import { ModelControls } from '@/components/sidebar/ModelControls.tsx';

const activeSchema = placeholderSchemas[1];

// ConfirmedInstanceViewer reads/writes through DrawerContext. Provide a stub so
// it resolves its instance; dispatch is a no-op (the story just renders the form —
// edits/deletes aren't persisted here).
const stubContext = {
  activeSchema,
  pdfUrl: '',
  dispatch: () => {},
  removeMlHighlight: () => {},
};

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="relative w-[380px] border border-black p-2 shadow-sm">{children}</div>;
}

export const ModelControlsStory: Story = () => (
  <DrawerContext.Provider value={stubContext}>
    <Frame>
      {/*<div> testing!</div>*/}
      <ModelControls
        status={'loading'}
        progress={0.8}
        message={'Loading...'}
        setMlHighlights={() => {}}
        onRunStart={() => {}}
      />
    </Frame>
  </DrawerContext.Provider>
);
