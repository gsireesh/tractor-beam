/**
 * Client-side entry point for the free connection probe. Ensures the offscreen
 * document exists (where the SDKs live — the drawer can't call them directly),
 * then sends a verify request and awaits the offscreen's sendResponse reply.
 *
 * Kept separate from the drawer's window-API bridge so both the readiness hook
 * and the config modal's Test button can call it without depending on
 * window.TractorBeamDrawer. Never throws — a transport failure resolves to a
 * classified `connection` result so callers have a single shape to render.
 */
import type { ModelConfig, ModelProvider } from './model-config';
import type { ModelConnectionResult } from '@/lib/messaging/message_definitions';

export async function verifyModelConnection(
  config: ModelConfig,
  provider?: ModelProvider,
): Promise<ModelConnectionResult> {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return { ok: false, classification: 'unknown', error: 'Extension runtime unavailable' };
  }
  // The offscreen doc hosts the SDKs; make sure it's up before probing.
  await chrome.runtime.sendMessage({ type: 'ensureOffscreen' }).catch(() => {});
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'verifyModelConnection',
      modelConfig: config,
      provider,
    })) as ModelConnectionResult | undefined;
    return res ?? { ok: false, classification: 'unknown', error: 'No response from offscreen' };
  } catch (err) {
    return {
      ok: false,
      classification: 'connection',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
