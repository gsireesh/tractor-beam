import type { Story } from "@ladle/react";
import { InstanceNavigator } from "./InstanceNavigator";
import { placeholderSchemas } from "@/lib/placeholder-schemas";
import type { Highlight, MlHighlight } from "@/lib/definitions";
import {getHighlightsFromSchema} from "@/lib/utils.ts";

// Use the "STS Reading" schema (index 1, not 0): its classes carry populated
// `instances` with real PDF coords, so the navigator has something to render.
const activeSchema = placeholderSchemas[1];

// Placeholder ML annotations — the provisional, model-sourced hits the
// navigator would surface alongside confirmed ones.
const mlHighlights: MlHighlight[] = [
  {
    id: "ml-1",
    classId: activeSchema.classes[0].id,
    schemaId: activeSchema.id,
    source: "ml",
    text: "impacting",
    coords: [{ pageNumber: 1, left: 0.148, top: 0.298, width: 0.064, height: 0.014 }],
  },
  {
    id: "ml-2",
    classId: activeSchema.classes[1].id,
    schemaId: activeSchema.id,
    source: "ml",
    text: "categorization",
    coords: [{ pageNumber: 1, left: 0.572, top: 0.465, width: 0.09, height: 0.013 }],
  },
];

// TODO(human): derive confirmedHighlights from activeSchema's instances.
// Flatten every class's `instances` into Highlight objects. Remember a
// Highlight needs `color` (lives on the class) plus per-instance fields
// (id, classId, coords, text, positiveExample) and `schemaId`/`source`.
const confirmedHighlights: Highlight[] = getHighlightsFromSchema(activeSchema);

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-[480px] min-h-[300px] border border-gray-300 bg-white p-4 overflow-auto shadow-sm">
    {children}
  </div>
);

export const Default: Story = () => (
  <Frame>
    <InstanceNavigator
      mlHighlights={mlHighlights}
      confirmedHighlights={confirmedHighlights}
    />
  </Frame>
);
