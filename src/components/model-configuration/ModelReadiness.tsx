/**
 * React surface for model readiness — a hook that turns the current
 * `ModelConfig` into a `ModelReadiness` verdict, and a small indicator that
 * explains (via tooltip) why a model isn't ready to run.
 *
 * Readiness is purely structural (`describeConfigGap`) — no eager network probe.
 * Reachability is proven at run time (offline pre-check + circuit-breaker) or on
 * demand via the config modal's Test-connection button.
 */
import { useMemo } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { ModelConfig } from '@/lib/ml/model-config';
import { describeConfigGap, type ModelReadiness } from '@/lib/ml/readiness';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Derive whether the selected model can run. `null` config means storage hasn't
 * loaded yet — treated as not-ready (button stays disabled), but with no visible
 * warning since the model picker it sits beside isn't rendered until config loads.
 */
export function useModelReadiness(config: ModelConfig | null): ModelReadiness {
  return useMemo<ModelReadiness>(() => {
    if (!config) return { state: 'unconfigured', reason: 'Loading model configuration…' };
    const gap = describeConfigGap(config);
    return gap ? { state: 'unconfigured', reason: gap } : { state: 'ready' };
  }, [config]);
}

/**
 * Warning triangle shown next to the model name when the config is incomplete.
 * Hovering explains what's missing. Renders nothing once the model is ready.
 *
 * `container` must be the themed drawer root, or the portaled tooltip renders
 * transparent (see the note in tooltip.tsx / config panel usage).
 */
export function ModelReadinessIndicator({
  readiness,
  container,
}: {
  readiness: ModelReadiness;
  container: Element | null;
}) {
  if (readiness.state !== 'unconfigured') return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TriangleAlert
          className="size-4 shrink-0 text-amber-500"
          aria-label={`Model not ready: ${readiness.reason}`}
        />
      </TooltipTrigger>
      <TooltipContent container={container} className="z-[10002]">
        {readiness.reason}
      </TooltipContent>
    </Tooltip>
  );
}
