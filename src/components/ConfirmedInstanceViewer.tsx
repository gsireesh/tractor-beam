import {Instance} from "@/lib/definitions.ts";
import {LocateFixed, Plus, Minus, Trash2} from "lucide-react";
import {useDrawerContext} from "@/contexts/DrawerContext.tsx";
import {scrollToAnnotation} from "@/lib/pdf-navigation.ts";
import {Badge} from "@/components/ui/badge.tsx";

export interface InstanceViewerProps {
    instance: Instance;
    schemaClassId: string;
    borderColor: string;
}

export function ConfirmedInstanceViewer(props: InstanceViewerProps) {
    const {instance, schemaClassId, borderColor} = props;

    const {activeSchema, dispatch} = useDrawerContext();

    return <>
        <div className="border-1 rounded-lg bg-white" style={{borderColor: borderColor}}>
            <div className="rounded-sm border-l-4 mx-3 my-1 p-2 italic bg-gray-100" style={{borderColor: borderColor}}>{instance.text}</div>
            <div className="mx-3 my-1">
                {instance.positiveExample ?
                <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"><Plus />Positive Example</Badge> :
                <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"><Minus/>Negative Example</Badge>
                }
            </div>
            {instance.notes && <div className="rounded-sm mx-3 my-1 p-2 bg-white" style={{borderColor: borderColor}}>{instance.notes}</div>}
            <div className="m-3 flex flex-row justify-end align-middle">
                <button className={"mx-3 my-1"} onClick={() => {
                    if (!instance.coords) { return; }
                    scrollToAnnotation(instance.coords);
                    window.TractorBeamHighlights?.flashHighlight(instance.id);
                }}>
                    <LocateFixed size={"16px"}/>
                </button>
                <button className={"mx-3 my-1"} onClick={() => dispatch({
                        actionType: "deleteInstance",
                        schemaId: activeSchema.id,
                        classId: schemaClassId,
                        instanceId: instance.id
                    })}>
                    <Trash2 size="16px" color="red"/>
                </button>
            </div>
        </div>
    </>
}