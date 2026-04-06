import {Instance} from "@/lib/definitions.ts";
import {LocateFixed, Trash2} from "lucide-react";
import {useDrawerContext} from "@/contexts/DrawerContext.tsx";
import {scrollToAnnotation} from "@/lib/pdf-navigation.ts";

export interface InstanceViewerProps {
    instance: Instance;
    schemaClassId: string;
    borderColor: string;
}

export function InstanceViewer(props: InstanceViewerProps) {
    const {instance, schemaClassId, borderColor} = props;

    const {activeSchema, dispatch} = useDrawerContext();

    return <>
        <div className="border-1 rounded-lg bg-white" style={{borderColor: borderColor}}>
            <div className="rounded-sm border-l-4 mx-3 my-1 p-2 italic bg-gray-100" style={{borderColor: borderColor}}>{instance.text}</div>
            <div className="m-3 flex flex-row justify-end align-middle">
                <button className={"mx-3 my-1"} onClick={() => instance.coords && scrollToAnnotation(instance.coords)}>
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