import type { Story } from "@ladle/react";
import { InstanceNavigator } from "./InstanceNavigator";
import { placeholderSchemas } from "@/lib/placeholder-schemas";
import { getHighlightsFromSchema, getSignpostsFromHighlights } from "@/lib/utils.ts";
import { DrawerContext } from "@/contexts/DrawerContext";

// Use the "STS Reading" schema (index 1, not 0): its classes carry populated
// `instances` with real PDF coords, so the navigator has something to render.
const activeSchema = placeholderSchemas[1];

// Confirmed highlights derived from the schema's instances, then projected into
// signposts (highlights + resolved className) at the boundary — exactly how the
// drawer feeds the navigator.
const signposts = getSignpostsFromHighlights(getHighlightsFromSchema(activeSchema), activeSchema);

// Each signpost renders an inline editor that reads/writes through DrawerContext.
// Provide a stub provider so the editors resolve their instances; dispatch is a
// no-op here (Ladle just renders the form — edits aren't persisted in the story).
const stubContext = { activeSchema, pdfUrl: "", dispatch: () => {} };

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-[480px] min-h-[300px] border border-gray-300 bg-white p-4 overflow-auto shadow-sm">
    {children}
  </div>
);

export const Default: Story = () => (
  <DrawerContext.Provider value={stubContext}>
    <Frame>
      <InstanceNavigator signposts={signposts} />
    </Frame>
  </DrawerContext.Provider>
);
