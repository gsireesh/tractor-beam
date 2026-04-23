import {useState, useEffect} from "react";
import {MlProgressMessage} from "@/lib/messaging/message_definitions.ts";

import {Progress} from '@/components/ui/progress';
import {LayoutPanelLeft, Play, Settings, Square, Save, History} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {WEBLLM_MODELS, CLAUDE_MODELS, OLLAMA_MODELS, type ModelProvider, type ModelConfig} from '@/lib/ml/types';
import {DEFAULT_OLLAMA_BASE_URL} from '@/lib/ml/types';
import {getModelConfig, setModelConfig, getClaudeApiKey, setClaudeApiKey, getOllamaBaseUrl, setOllamaBaseUrl} from '@/lib/ml/config';
import { useDrawerContext } from '@/contexts/DrawerContext';
import {IconButton} from "@/components/IconButton.tsx";

export interface ModelControlsProps {
    status: MlProgressMessage["stage"]
    progress: number,
    message: string,
}

const STATUS_MAP: Record<string, string> = {
    "unloaded": "bg-red-500",
    "downloading": "bg-yellow-400",
    "loading": "bg-yellow-400",
    "running": "bg-green-600"
}

export function ModelControls({status, progress, message} : ModelControlsProps) {
    const { activeSchema, pdfUrl } = useDrawerContext();
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [config, setLocalConfig] = useState<Partial<ModelConfig>>({});
    const [apiKey, setApiKey] = useState('');
    const [apiKeySaved, setApiKeySaved] = useState(false);
    const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA_BASE_URL);
    const [ollamaUrlSaved, setOllamaUrlSaved] = useState(false);
    const isRunning = status === "running" && progress < 1;

    useEffect(() => {
        Promise.all([getModelConfig(), getClaudeApiKey(), getOllamaBaseUrl()]).then(([cfg, key, url]) => {
            setLocalConfig(cfg);
            if (key) setApiKey(key);
            if (url) setOllamaUrl(url);
        });
    }, []);

    function updateConfig(partial: Partial<ModelConfig>) {
        setLocalConfig(prev => ({...prev, ...partial}));
        void setModelConfig(partial);
    }

    async function saveApiKey() {
        await setClaudeApiKey(apiKey);
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 2000);
    }

    async function saveOllamaUrl() {
        await setOllamaBaseUrl(ollamaUrl);
        setOllamaUrlSaved(true);
        setTimeout(() => setOllamaUrlSaved(false), 2000);
    }

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

    const currentModel = config.provider === 'claude' ? config.claudeModel : config.provider === 'ollama' ? config.ollamaModel : config.webllmModel;

    return <div className="border-t-2 border-blue-500 p-2 m-0 shadow-[0px_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between">
            <h1 className="font-semibold">Model Control Panel</h1>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <IconButton icon={Settings} title="Model Settings" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 z-[10001]">
                    <DropdownMenuLabel>Provider</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={config.provider ?? 'webllm'} onValueChange={(v) => updateConfig({ provider: v as ModelProvider })}>
                        <DropdownMenuRadioItem value="webllm">WebLLM (local)</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="claude">Claude API</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="ollama">Ollama (local)</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Model</DropdownMenuLabel>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>{currentModel ?? 'Select model...'}</DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent className="z-[10002]">
                                {config.provider === 'claude' ? (
                                    <DropdownMenuRadioGroup value={config.claudeModel ?? ''} onValueChange={(v) => updateConfig({ claudeModel: v as typeof CLAUDE_MODELS[number] })}>
                                        {CLAUDE_MODELS.map((m) => <DropdownMenuRadioItem key={m} value={m}>{m}</DropdownMenuRadioItem>)}
                                    </DropdownMenuRadioGroup>
                                ) : config.provider === 'ollama' ? (
                                    <DropdownMenuRadioGroup value={config.ollamaModel ?? ''} onValueChange={(v) => updateConfig({ ollamaModel: v })}>
                                        {OLLAMA_MODELS.map((m) => <DropdownMenuRadioItem key={m} value={m}>{m}</DropdownMenuRadioItem>)}
                                    </DropdownMenuRadioGroup>
                                ) : (
                                    <DropdownMenuRadioGroup value={config.webllmModel ?? ''} onValueChange={(v) => updateConfig({ webllmModel: v as typeof WEBLLM_MODELS[number] })}>
                                        {WEBLLM_MODELS.map((m) => <DropdownMenuRadioItem key={m} value={m}>{m}</DropdownMenuRadioItem>)}
                                    </DropdownMenuRadioGroup>
                                )}
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        {config.provider === 'claude' && (
            <div className="flex items-center gap-1 mt-1">
                <input
                    type="password"
                    placeholder="Claude API Key"
                    className="flex-1 px-2 py-1 text-xs border rounded"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
                <IconButton title="Save API Key" icon={Save} size="icon-xs" onClick={() => void saveApiKey()}/>
                {apiKeySaved && <span className="text-xs text-green-600">Saved!</span>}
            </div>
        )}
        {config.provider === 'ollama' && (
            <div className="flex items-center gap-1 mt-1">
                <input
                    type="text"
                    placeholder="Ollama URL"
                    className="flex-1 px-2 py-1 text-xs border rounded"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                />
                <IconButton title="Save Ollama URL" icon={Save} size="icon-xs" onClick={() => void saveOllamaUrl()} />
                {ollamaUrlSaved && <span className="text-xs text-green-600">Saved!</span>}
            </div>
        )}
        <div className="flex items-center gap-2 text-sm">
            <span>{config.provider === 'claude' ? 'Claude' : config.provider === 'ollama' ? 'Ollama' : 'WebLLM'}: {status}</span>
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
            <IconButton title="Start Annotation Pipeline" icon={Play} color={"green"} onClick={sendRunMessage} disabled={isRunning} />
            {isRunning && (
                <IconButton title={"Stop Annotation"} icon={Square} color={"red"} onClick={sendCancelMessage} />
            )}
            <IconButton title={"Run Segmentation Pipeline"} icon={LayoutPanelLeft} onClick={() => {
                console.log('[drawer] Running segmentation pipeline!');
                void window.TractorBeamDrawer.runSegmentationPipeline();}}
            />
            <IconButton title={"Load Prior Annotations"} icon={History} onClick={() => {
                console.log('[ModelControls] Loading cached annotations');
                void window.TractorBeamDrawer.loadCachedAnnotations(activeSchema.id, pdfUrl)
            }} />
        </div>
    </div>
}
