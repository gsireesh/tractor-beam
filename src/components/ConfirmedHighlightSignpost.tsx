import {Signpost} from "@/lib/definitions.ts"
import {scrollToAnnotation} from "@/lib/pdf-navigation.ts";
import {EditInstanceInline} from "@/components/EditInstanceInline.tsx";

export function ConfirmedHighlightSignpost({id, schemaId, classId, coords}: Signpost) {
    return <div className="my-3" onClick={() => (coords && scrollToAnnotation(coords))}>
        {/* Stop form interactions (typing, selecting a class) from triggering the scroll-to-annotation click. */}
        <div onClick={(e) => e.stopPropagation()}>
            <EditInstanceInline schemaId={schemaId} classId={classId} instanceId={id} />
        </div>
    </div>
}
