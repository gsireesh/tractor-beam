import {
  DEFAULT_MODEL_CONFIG as DEFAULT_LEGACY_MODEL_CONFIG,
  DEFAULT_WEBLLM_MODEL,
  type ModelConfig as LegacyModelConfig,
} from './ml/types';
import { DEFAULT_MODEL_CONFIG, type ModelConfig, type ModelSelection } from './ml/model-config';
import { DEFAULT_ANTHROPIC_CONFIG, DEFAULT_ANTHROPIC_MODEL } from '@/lib/ml/claude-runner.ts';
import { DEFAULT_WEBLLM_CONFIG } from '@/lib/ml/webllm-runner.ts';
import { DEFAULT_OPENAI_CONFIG } from '@/lib/ml/openai-runner.ts';

/**
 * Single source of truth for everything persisted in chrome.storage.local.
 *
 * Every key the extension stores is declared in {@link PersistedState} below and
 * read/written only through the accessors in this module — no component should
 * touch chrome.storage.local directly. There are two families of state:
 *
 *  - Config: model selection + credentials (`modelConfig`, `claudeApiKey`,
 *    `ollamaBaseUrl`), each under its own key for backward compatibility.
 *  - UI: drawer position, consolidated under a single `uiState` key.
 *
 * Note: offscreen documents can't reach chrome.storage — config is passed to them
 * via messages, not read here. The UI accessors below all read-modify-write the
 * single `uiState` blob, and a single user action can fire several at once (e.g.
 * switching schema writes both the per-document schemaId and lastSchemaId). To
 * avoid lost updates from concurrent read-modify-write, every mutation goes through
 * {@link updateUiState}, which serializes them on one promise chain.
 */

const MODEL_CONFIG_KEY = 'modelConfig';
const API_KEY_STORAGE_KEY = 'claudeApiKey';
const OLLAMA_BASE_URL_KEY = 'ollamaBaseUrl';
const UI_STATE_KEY = 'uiState';

/**
 * The chrome.storage.local area, or null when `chrome` is absent — e.g. WXT's
 * Node pre-render pass or any non-extension context. Reads fall back to defaults
 * and writes no-op in that case; the real values load once the page runs live.
 */
function localStore(): chrome.storage.LocalStorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

// ─── UI-state shape ───

/** Which drawer tab is showing. Matches the <Tabs> value strings in drawer.tsx. */
export type DrawerView = 'schema' | 'navigation';

/**
 * How the UI resolves its color theme. `system` follows the OS via
 * prefers-color-scheme; `light`/`dark` are explicit user overrides. Applied to
 * each surface root by {@link file://./theme.ts syncTheme}.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Where the user was in the drawer for one document (keyed by pdfUrl). */
export interface DocumentUiState {
  schemaId: string;
  view: DrawerView;
}

/** All non-config UI state, stored under the single `uiState` key. */
export interface UiState {
  drawerOpen: boolean;
  /** Last schema the user actively selected, anywhere — fallback for documents with no saved position. */
  lastSchemaId: string | null;
  /** Per-document drawer position, keyed by pdfUrl. */
  documents: Record<string, DocumentUiState>;
  /** Color-theme preference; applied to every surface root by syncTheme. */
  themePreference: ThemePreference;
}

/** Full documented shape of chrome.storage.local. */
export interface PersistedState {
  modelConfig: ModelConfig; // key: 'modelConfig'
  claudeApiKey: string | null; // key: 'claudeApiKey'
  ollamaBaseUrl: string | null; // key: 'ollamaBaseUrl'
  uiState: UiState; // key: 'uiState'
}

const DEFAULT_UI_STATE: UiState = {
  drawerOpen: true,
  lastSchemaId: null,
  documents: {},
  themePreference: 'system',
};

// ─── Model config + credentials ───

/**
 * @deprecated Legacy flat-shape accessor, kept during the expand/contract
 * migration to the per-provider {@link ModelConfig}. The runtime path still uses
 * this; consumers move to a {@link coerceModelConfig}-backed read in the contract
 * step, after which this (and the separate credential accessors below) are removed.
 */
export async function getModelConfig(): Promise<LegacyModelConfig> {
  const store = localStore();
  if (!store) return { ...DEFAULT_LEGACY_MODEL_CONFIG };
  const result = await store.get(MODEL_CONFIG_KEY);
  const stored = result[MODEL_CONFIG_KEY] as Partial<LegacyModelConfig> | undefined;
  return { ...DEFAULT_LEGACY_MODEL_CONFIG, ...stored };
}

/** @deprecated See {@link getModelConfig}. */
export async function setModelConfig(config: Partial<LegacyModelConfig>): Promise<void> {
  const store = localStore();
  if (!store) return;
  const current = await getModelConfig();
  await store.set({ [MODEL_CONFIG_KEY]: { ...current, ...config } });
}

// ─── New per-provider model config (expand/contract migration) ───
//
// The live pipeline still uses the legacy accessors above. The helpers below
// produce the new per-provider ModelConfig and are unit-tested in isolation;
// they become the live read/write path in the contract step.

/** Fill any missing block or field of a (possibly partial) new-shape config from defaults. */
function withDefaults(stored: Partial<ModelConfig>): ModelConfig {
  return {
    selected: { ...DEFAULT_MODEL_CONFIG.selected, ...stored.selected },
    anthropic: {
      ...DEFAULT_MODEL_CONFIG.anthropic,
      ...stored.anthropic,
      params: { ...DEFAULT_MODEL_CONFIG.anthropic.params, ...stored.anthropic?.params },
    },
    openai: {
      ...DEFAULT_MODEL_CONFIG.openai,
      ...stored.openai,
      params: { ...DEFAULT_MODEL_CONFIG.openai.params, ...stored.openai?.params },
    },
    webllm: {
      ...DEFAULT_MODEL_CONFIG.webllm,
      ...stored.webllm,
      params: { ...DEFAULT_MODEL_CONFIG.webllm.params, ...stored.webllm?.params },
    },
  };
}

/**
 * A stored blob is the legacy flat shape iff it has none of the new per-provider
 * blocks but carries at least one legacy field.
 */
function isLegacyModelConfig(stored: object): stored is Partial<LegacyModelConfig> {
  return (
    !('anthropic' in stored) &&
    !('openai' in stored) &&
    !('webllm' in stored) &&
    ('provider' in stored ||
      'claudeModel' in stored ||
      'ollamaModel' in stored ||
      'webllmModel' in stored)
  );
}

/**
 * Heal a legacy flat config (plus the legacy top-level `claudeApiKey`) into the
 * new per-provider ModelConfig. Read-only on the legacy values — non-destructive.
 * Ollama settings are intentionally dropped (the provider is gone).
 */
function migrateLegacyModelConfig(
  legacy: Partial<LegacyModelConfig>,
  legacyApiKey: string | null,
): ModelConfig {
  // Model-first selection. Only an explicit WebLLM user stays local; Claude,
  // Ollama, and missing all map to Anthropic (Ollama is gone — nothing to carry).
  const selected: ModelSelection =
    legacy.provider === 'webllm'
      ? { provider: 'webllm', model: legacy.webllmModel ?? DEFAULT_WEBLLM_MODEL }
      : { provider: 'anthropic', model: legacy.claudeModel ?? DEFAULT_ANTHROPIC_MODEL };
  return {
    selected,
    anthropic: { ...DEFAULT_ANTHROPIC_CONFIG, apiKey: legacyApiKey },
    openai: { ...DEFAULT_OPENAI_CONFIG },
    webllm: { ...DEFAULT_WEBLLM_CONFIG },
  };
}

/**
 * Heal whatever is under the `modelConfig` storage key into a valid new-shape
 * ModelConfig. Pure: pass the stored blob plus the value read from the legacy
 * `claudeApiKey` key, so this stays unit-testable without chrome.storage.
 */
export function coerceModelConfig(stored: unknown, legacyApiKey: string | null): ModelConfig {
  if (stored === null || typeof stored !== 'object') return withDefaults({});
  if (isLegacyModelConfig(stored)) return migrateLegacyModelConfig(stored, legacyApiKey);
  return withDefaults(stored as Partial<ModelConfig>);
}

/** Read the Claude API key from chrome.storage.local. */
export async function getClaudeApiKey(): Promise<string | null> {
  const store = localStore();
  if (!store) return null;
  const result: Record<string, string> = await store.get(API_KEY_STORAGE_KEY);
  return result[API_KEY_STORAGE_KEY] ?? null;
}

/**
 * Store the Claude API key in chrome.storage.local.
 *
 * Plaintext-at-rest is a deliberate choice, not an oversight. chrome.storage is
 * isolated per-extension, so other extensions can't read it and have no filesystem
 * API to grep the profile either. The only threat that sees this value is malware
 * running as the user — which also already owns ~/.claude, .env, env vars, etc., so
 * encrypting this one slot buys nothing it couldn't bypass elsewhere. Any client-side
 * encryption would need its decryption material in the bundle (= obfuscation) or a
 * per-session passphrase prompt (= friction for ~zero gain against our threat model).
 * The real blast-radius control lives at the Anthropic console: scoped keys, spend
 * caps, easy rotation.
 */
export async function setClaudeApiKey(key: string): Promise<void> {
  const store = localStore();
  if (!store) return;
  await store.set({ [API_KEY_STORAGE_KEY]: key });
}

/** Read the Ollama base URL from chrome.storage.local. */
export async function getOllamaBaseUrl(): Promise<string | null> {
  const store = localStore();
  if (!store) return null;
  const result: Record<string, string> = await store.get(OLLAMA_BASE_URL_KEY);
  return result[OLLAMA_BASE_URL_KEY] ?? null;
}

/** Store the Ollama base URL in chrome.storage.local. */
export async function setOllamaBaseUrl(url: string): Promise<void> {
  const store = localStore();
  if (!store) return;
  await store.set({ [OLLAMA_BASE_URL_KEY]: url });
}

// ─── UI state ───

/** Read the UI state blob from chrome.storage.local, merged with defaults. */
export async function getUiState(): Promise<UiState> {
  const store = localStore();
  if (!store) return { ...DEFAULT_UI_STATE };
  const result = await store.get(UI_STATE_KEY);
  const stored = result[UI_STATE_KEY] as Partial<UiState> | undefined;
  return { ...DEFAULT_UI_STATE, ...stored, documents: stored?.documents ?? {} };
}

/**
 * Serializes read-modify-write of the `uiState` blob. Concurrent writers (a single
 * user action often fires several) would otherwise each read the same stale blob and
 * the last set() would clobber the others. Chaining on one promise makes each
 * mutation read the previous write's committed result.
 */
let uiWriteChain: Promise<void> = Promise.resolve();

function updateUiState(mutate: (state: UiState) => UiState): Promise<void> {
  const result = uiWriteChain.then(async () => {
    const store = localStore();
    if (!store) return;
    const current = await getUiState();
    await store.set({ [UI_STATE_KEY]: mutate(current) });
  });
  // Keep the chain alive if one write fails, but still surface the error to the caller.
  uiWriteChain = result.catch(() => undefined);
  return result;
}

/** Persist whether the drawer is open. */
export function setDrawerOpen(open: boolean): Promise<void> {
  return updateUiState((state) => ({ ...state, drawerOpen: open }));
}

/** Record the schema the user most recently selected (used to seed new documents). */
export function setLastSchemaId(id: string): Promise<void> {
  return updateUiState((state) => ({ ...state, lastSchemaId: id }));
}

/** Merge a partial update into one document's saved drawer position. */
export function setDocumentUiState(pdfUrl: string, patch: Partial<DocumentUiState>): Promise<void> {
  return updateUiState((state) => {
    const existing = state.documents[pdfUrl];
    const next: DocumentUiState = {
      schemaId: existing?.schemaId ?? '',
      view: existing?.view ?? 'schema',
      ...patch,
    };
    return { ...state, documents: { ...state.documents, [pdfUrl]: next } };
  });
}

/** Read the user's color-theme preference. */
export async function getThemePreference(): Promise<ThemePreference> {
  return (await getUiState()).themePreference;
}

/** Persist the user's color-theme preference. */
export function setThemePreference(pref: ThemePreference): Promise<void> {
  return updateUiState((state) => ({ ...state, themePreference: pref }));
}

/**
 * Subscribe to UI-state changes from any extension page. chrome.storage.onChanged
 * fires in every context sharing this storage area, so this is how one page's
 * write (e.g. flipping the theme toggle in the drawer) reaches the others. Returns
 * an unsubscribe fn; no-ops when `chrome` is absent.
 */
export function onUiStateChange(listener: (state: UiState) => void): () => void {
  const store = localStore();
  if (!store) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[UI_STATE_KEY]) return;
    const next = changes[UI_STATE_KEY].newValue as Partial<UiState> | undefined;
    listener({ ...DEFAULT_UI_STATE, ...next, documents: next?.documents ?? {} });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
