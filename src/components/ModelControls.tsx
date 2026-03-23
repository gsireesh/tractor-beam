import {MlProgressMessage} from "@/lib/messaging/message_definitions.ts";
import {Schema} from "@/lib/definitions.ts"
import {Button, Progress} from 'flowbite-react';
import {PiPlayBold} from "react-icons/pi";

export interface ModelControlsProps {
    status: MlProgressMessage["stage"]
    progress: number,
    message: string,
    activeSchema: Schema,
}

const STATUS_MAP = {
    "unloaded": "bg-red-500",
    "downloading": "bg-yellow-400",
    "loading": "bg-yellow-400",
    "running": "bg-green-600"
}

  function sendRunMessage(activeSchema: Schema) {
    console.log("[side panel] triggering annotation pipeline!");
    chrome.runtime.sendMessage({
      type: "runAnnotationPipeline",
      requestId: crypto.randomUUID(),
      schema: activeSchema,
    })
  }

export function ModelControls({status, progress, message, activeSchema} : ModelControlsProps) {
    return <div className="border-2 border-blue-500 rounded-md">
        <div className="">Model Control Panel</div>
        <div><span>
            Model Status: {status}
            <span>
                {status=="loading" ? <Progress progress={progress * 100} /> : null}
            </span>
            <span className={"rounded-full " + STATUS_MAP[status]}>test</span>
        </span>
        </div>
        <button id={"runButton"} className={"border-1 rounded-sm p-0"} onClick={() => sendRunMessage(activeSchema)}><PiPlayBold /></button>
    </div>
}