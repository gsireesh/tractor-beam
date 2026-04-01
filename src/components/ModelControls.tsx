import {useState} from "react";
import {MlProgressMessage} from "@/lib/messaging/message_definitions.ts";
import {Schema} from "@/lib/definitions.ts"
import {Progress} from '@/components/ui/progress';
import {LayoutPanelLeft, Play, Square} from 'lucide-react';

export interface ModelControlsProps {
    status: MlProgressMessage["stage"]
    progress: number,
    message: string,
    activeSchema: Schema,
}

const STATUS_MAP: Record<string, string> = {
    "unloaded": "bg-red-500",
    "downloading": "bg-yellow-400",
    "loading": "bg-yellow-400",
    "running": "bg-green-600"
}

export function ModelControls({status, progress, message, activeSchema} : ModelControlsProps) {
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const isRunning = status === "running" && progress < 1;

    function sendRunMessage() {
        const requestId = crypto.randomUUID();
        setCurrentRequestId(requestId);
        console.log("[ModelControls] triggering annotation pipeline!");
        window.TractorBeamDrawer.runAnnotationPipeline(activeSchema, requestId);
    }

    function sendCancelMessage() {
        if (!currentRequestId) return;
        console.log("[ModelControls] cancelling annotation pipeline!");
        window.TractorBeamDrawer.cancelAnnotationPipeline(currentRequestId);
        setCurrentRequestId(null);
    }

    return <div className="border-t-2 border-blue-500 p-2 m-0 shadow-[0px_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <h1 className="font-semibold">Model Control Panel</h1>
        <div className="flex items-center gap-2 text-sm">
            Model Status: {status}
            <span className={"inline-block w-2 h-2 rounded-full " + (STATUS_MAP[status] || "bg-gray-400")} />
        </div>
        {status === "loading" && (
            <div className="mt-1">
                <div className="text-xs text-gray-500">Loading model...</div>
                <Progress value={progress * 100} className="h-2" />
            </div>
        )}
        {isRunning && (
            <div className="mt-1">
                <div className="text-xs text-gray-500">{message || "Annotating..."}</div>
                <Progress value={progress * 100} className="h-2 [&>div]:bg-green-500" />
            </div>
        )}
        <div className="flex gap-1 mt-1">
            <button
                onClick={sendRunMessage}
                disabled={isRunning}
            >
                <Play strokeWidth={1} color="green" />
            </button>
            {isRunning && (
                <button
                    onClick={sendCancelMessage}
                    title="Stop annotation"
                >
                    <Square strokeWidth={1} color="red" />
                </button>
            )}
            <button onClick={() => {
                console.log('[drawer] Running segmentation pipeline!');
                void window.TractorBeamDrawer.runSegmentationPipeline()
            }}>
                <LayoutPanelLeft strokeWidth={1} />
            </button>
        </div>
    </div>
}
