import {useState, useEffect} from "react";
import {MlProgressMessage, AnnotationBackend} from "@/lib/messaging/message_definitions.ts";
import {Schema} from "@/lib/definitions.ts"
import {Progress} from '@/components/ui/progress';
import {Button} from '@/components/ui/button';
import {PiPlayBold, PiStopBold} from "react-icons/pi";

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
    const [backend, setBackend] = useState<AnnotationBackend>('webllm');
    const [apiKey, setApiKey] = useState('');
    const [apiKeySaved, setApiKeySaved] = useState(false);
    const isRunning = status === "running" && progress < 1;

    // Load saved API key on mount
    useEffect(() => {
        chrome.storage?.local?.get('claudeApiKey').then((result) => {
            if (result.claudeApiKey) {
                setApiKey(result.claudeApiKey);
                setApiKeySaved(true);
            }
        }).catch(() => {});
    }, []);

    function sendRunMessage() {
        const requestId = crypto.randomUUID();
        setCurrentRequestId(requestId);
        console.log(`[side panel] triggering annotation pipeline (${backend})!`);
        chrome.runtime.sendMessage({
            type: "runAnnotationPipeline",
            requestId,
            schema: activeSchema,
            backend,
        });
    }

    function sendCancelMessage() {
        if (!currentRequestId) return;
        console.log("[side panel] cancelling annotation pipeline!");
        chrome.runtime.sendMessage({
            type: "cancelAnnotationPipeline",
            requestId: currentRequestId,
        });
        setCurrentRequestId(null);
    }

    function saveApiKey() {
        chrome.runtime.sendMessage({
            type: "setClaudeApiKey",
            apiKey,
        });
        setApiKeySaved(true);
    }

    return <div className="border-2 border-blue-500 rounded-md p-2">
        <div className="font-semibold text-sm">Model Control Panel</div>
        <div className="flex items-center gap-2 text-sm">
            Model Status: {status}
            <span className={"inline-block w-2 h-2 rounded-full " + (STATUS_MAP[status] || "bg-gray-400")} />
        </div>

        <div className="flex items-center gap-2 mt-1 text-sm">
            <label>Backend:</label>
            <select
                className="text-xs border rounded px-1 py-0.5"
                value={backend}
                onChange={(e) => setBackend(e.target.value as AnnotationBackend)}
                disabled={isRunning}
            >
                <option value="webllm">WebLLM (local)</option>
                <option value="claude">Claude API</option>
            </select>
        </div>

        {backend === 'claude' && !apiKeySaved && (
            <div className="flex items-center gap-1 mt-1">
                <input
                    type="password"
                    className="text-xs border rounded px-1 py-0.5 flex-1"
                    placeholder="sk-ant-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
                <Button variant="outline" size="xs" onClick={saveApiKey} disabled={!apiKey}>
                    Save
                </Button>
            </div>
        )}
        {backend === 'claude' && apiKeySaved && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                API key saved
                <button className="underline text-xs" onClick={() => setApiKeySaved(false)}>change</button>
            </div>
        )}

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
                className="border-1 rounded-sm p-0"
                onClick={sendRunMessage}
                disabled={isRunning}
            >
                <PiPlayBold />
            </button>
            {isRunning && (
                <button
                    className="border-1 rounded-sm p-0 text-red-600"
                    onClick={sendCancelMessage}
                    title="Stop annotation"
                >
                    <PiStopBold />
                </button>
            )}
        </div>
    </div>
}
