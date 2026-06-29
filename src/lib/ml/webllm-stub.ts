/**
 * Stand-in for @mlc-ai/web-llm in builds where WebLLM is disabled (the default;
 * enabled only with VITE_ENABLE_WEBLLM=true). wxt.config.ts aliases the package
 * to this file so the real ~5.7MB library — and its remote model_lib CDN URLs,
 * which MV3 prohibits — can never resolve into the bundle.
 *
 * The dynamic import that reaches this is dead code when WebLLM is disabled, so
 * CreateMLCEngine throwing is only a safety net for a misconfigured build.
 */
export function CreateMLCEngine(): never {
  throw new Error('WebLLM is not available in this build (VITE_ENABLE_WEBLLM is not set).');
}

export type MLCEngine = unknown;