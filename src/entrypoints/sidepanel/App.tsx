import {SchemaViewer} from "@/components/SchemaViewer";
import {placeholderSchemas} from "@/lib/placeholder-schemas.ts";

export default function Page() {
  return <SchemaViewer schemas={placeholderSchemas}></SchemaViewer>;
}
