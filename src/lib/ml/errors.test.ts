import { describe, it, expect } from 'vitest';
import { classifyMlError, describeMlError } from './errors';

describe('classifyMlError', () => {
  it('classifies 401/403 as auth', () => {
    expect(classifyMlError({ status: 401 })).toBe('auth');
    expect(classifyMlError({ status: 403 })).toBe('auth');
  });

  it('classifies 429 as rateLimit', () => {
    expect(classifyMlError({ status: 429 })).toBe('rateLimit');
  });

  it('classifies 5xx as server', () => {
    expect(classifyMlError({ status: 500 })).toBe('server');
    expect(classifyMlError({ status: 529 })).toBe('server');
  });

  it('classifies other 4xx as unknown', () => {
    expect(classifyMlError({ status: 400 })).toBe('unknown');
    expect(classifyMlError({ status: 404 })).toBe('unknown');
  });

  it('classifies a status-less network failure as connection', () => {
    // Shapes the SDKs actually throw when the request never gets a response.
    expect(classifyMlError({ name: 'APIConnectionError', message: 'Connection error.' })).toBe(
      'connection',
    );
    expect(classifyMlError(new TypeError('Failed to fetch'))).toBe('connection');
    expect(classifyMlError({ message: 'getaddrinfo ENOTFOUND api.anthropic.com' })).toBe(
      'connection',
    );
  });

  it('falls back to unknown for an opaque error', () => {
    expect(classifyMlError({})).toBe('unknown');
    expect(classifyMlError(null)).toBe('unknown');
    expect(classifyMlError('boom')).toBe('unknown');
  });
});

describe('describeMlError', () => {
  it('gives an actionable message per class', () => {
    expect(describeMlError('auth')).toMatch(/api key/i);
    expect(describeMlError('connection')).toMatch(/connection|base url/i);
    expect(describeMlError('rateLimit')).toMatch(/rate limited/i);
    expect(describeMlError('server')).toMatch(/server error/i);
  });

  it('surfaces the raw message for unknown, with a fallback', () => {
    expect(describeMlError('unknown', 'model foo not found')).toBe('model foo not found');
    expect(describeMlError('unknown', '   ')).toBe('Connection check failed.');
    expect(describeMlError('unknown')).toBe('Connection check failed.');
  });
});
