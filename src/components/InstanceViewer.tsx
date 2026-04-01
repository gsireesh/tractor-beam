import {Instance} from "@/lib/definitions.ts";
import {LocateFixed, Trash2} from "lucide-react";

export interface InstanceViewerProps {
    instance: Instance;
    borderColor: string;
}

export function InstanceViewer(props: InstanceViewerProps) {
    const {instance, borderColor} = props;

    return <>
        <div className="border-1 rounded-lg bg-white" style={{borderColor: borderColor}}>
            <div className="rounded-sm border-l-4 mx-3 my-1 p-2 italic bg-gray-100" style={{borderColor: borderColor}}>{instance.text}</div>
            <div className="m-3 flex flex-row justify-end align-middle">
                <button className={"mx-3 my-1"}>
                    <LocateFixed size={"16px"}/>
                </button>
                <button className={"mx-3 my-1"}>
                    <Trash2 size="16px" color="red"/>
                </button>
            </div>
        </div>
    </>
}