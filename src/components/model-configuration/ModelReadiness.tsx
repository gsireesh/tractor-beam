/**
 * React surface for model readiness — a hook that turns the current
 * `ModelConfig` into a `ModelReadiness` verdict, and a small indicator that
 * explains (via tooltip) why a model isn't ready to run.
 *
 * Two layers: a synchronous *structural* gate (`describeConfigGap`), then a
 * debounced, free `models.list()` probe that upgrades a structurally-OK config
 * to `ready` / `unreachable`.
 */
import { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { ModelConfig } from '@/lib/ml/model-config';
import { describeConfigGap, readinessProbeKey, type ModelReadiness } from '@/lib/ml/readiness';
import { verifyModelConnection } from '@/lib/ml/verify-connection';
import { describeMlError } from '@/lib/ml/errors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Debounce the network probe so typing an API key in the modal (which persists —
// and thus re-runs this hook — on every keystroke) fires one request, not one per key.
const PROBE_DEBOUNCE_MS = 600;

/**
 * Derive whether the selected model can run. `null` config means storage hasn't
 * loaded yet — treated as not-ready (button stays disabled), but with no visible
 * warning since the model picker it sits beside isn't rendered until config loads.
 *
 * Structurally-incomplete configs never hit the network. A structurally-OK config
 * goes `verifying` → `ready`/`unreachable` from the probe result. The probe re-runs
 * only when `readinessProbeKey` changes (provider/model/key/baseUrl), and stale
 * results are discarded via a per-effect cancellation flag.
 */
export function useModelReadiness(config: ModelConfig | null): ModelReadiness {
  const [readiness, setReadiness] = useState<ModelReadiness>({
    state: 'unconfigured',
    reason: 'Loading model configuration…',
  });
  // Depend on the probe key (a primitive), not the config object — immer hands us
  // a new object on every edit, but we only want to re-probe on connection-field changes.
  const probeKey = config ? readinessProbeKey(config) : null;
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const current = configRef.current;
    if (!current) {
      setReadiness({ state: 'unconfigured', reason: 'Loading model configuration…' });
      return;
    }
    const gap = describeConfigGap(current);
    if (gap) {
      setReadiness({ state: 'unconfigured', reason: gap });
      return;
    }
    // Structurally OK → verify reachability (debounced, cancellable).
    setReadiness({ state: 'verifying' });
    let cancelled = false;
    const timer = setTimeout(() => {
      void verifyModelConnection(current).then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setReadiness({ state: 'ready' });
        } else {
          setReadiness({
            state: 'unreachable',
            reason: describeMlError(res.classification ?? 'unknown', res.error),
          });
        }
      });
    }, PROBE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // probeKey captures every field the probe reads; configRef supplies the latest object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeKey]);

  return readiness;
}

/**
 * Warning triangle shown next to the model name when the model can't run.
 * Hovering explains why. Renders nothing when the model is ready or verifying.
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
  if (readiness.state !== 'unconfigured' && readiness.state !== 'unreachable') return null;
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
