import type { Story } from "@ladle/react";
import { InstanceNavigator } from "./InstanceNavigator";
import { placeholderSchemas } from "@/lib/placeholder-schemas";
import { getHighlightsFromSchema, getSignpostsFromHighlights } from "@/lib/utils.ts";

// Use the "STS Reading" schema (index 1, not 0): its classes carry populated
// `instances` with real PDF coords, so the navigator has something to render.
const activeSchema = placeholderSchemas[1];

// Confirmed highlights derived from the schema's instances, then projected into
// signposts (highlights + resolved className) at the boundary — exactly how the
// drawer feeds the navigator. Keeps InstanceNavigator a pure presentational
// component that needs no DrawerContext provider here.
const signposts = getSignpostsFromHighlights(getHighlightsFromSchema(activeSchema), activeSchema);

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-[480px] min-h-[300px] border border-gray-300 bg-white p-4 overflow-auto shadow-sm">
    {children}
  </div>
);

export const Default: Story = () => (
  <Frame>
    <InstanceNavigator signposts={signposts} />
  </Frame>
);
