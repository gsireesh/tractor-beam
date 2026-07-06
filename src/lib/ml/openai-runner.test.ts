import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OpenAI SDK: capture the create() args without any network. vi.mock is
// hoisted, so the spy is created via vi.hoisted.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } };
    constructor(_opts: unknown) {}
  },
}));

import { OpenAiRunner } from './openai-runner';

function newRunner() {
  const runner = new OpenAiRunner(() => {});
  runner.setBaseUrl('https://api.openai.com/v1');
  runner.setApiKeyDirect('sk-test');
  runner.setModel('gpt-5.4');
  return runner;
}

describe('OpenAiRunner request params', () => {
  beforeEach(() => {
    createMock.mockReset().mockResolvedValue({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  });

  it('sends max_completion_tokens, never the deprecated max_tokens', async () => {
    // OpenAI o-series / GPT-5 (the defaults) reject max_tokens with a 400.
    const runner = newRunner();
    runner.setParams({ maxTokens: 512 });
    await runner.run([{ role: 'user', content: 'hi' }]);

    const args = createMock.mock.calls[0][0];
    expect(args.max_completion_tokens).toBe(512);
    expect(args).not.toHaveProperty('max_tokens');
  });

  it('falls back to the default cap when none is configured', async () => {
    const runner = newRunner();
    await runner.run([{ role: 'user', content: 'hi' }]);
    expect(createMock.mock.calls[0][0].max_completion_tokens).toBe(1024);
  });

  it('omits sampling params unless explicitly set (reasoning models reject non-defaults)', async () => {
    const runner = newRunner();
    await runner.run([{ role: 'user', content: 'hi' }]);
    const args = createMock.mock.calls[0][0];
    expect(args).not.toHaveProperty('temperature');
    expect(args).not.toHaveProperty('top_p');
  });

  it('includes sampling params when the user set them', async () => {
    const runner = newRunner();
    runner.setParams({ maxTokens: 256, temperature: 0.2, topP: 0.9 });
    await runner.run([{ role: 'user', content: 'hi' }]);
    const args = createMock.mock.calls[0][0];
    expect(args.temperature).toBe(0.2);
    expect(args.top_p).toBe(0.9);
  });
});
