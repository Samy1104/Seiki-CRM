import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callGemini, GEMINI_MODEL } from './geminiApi.ts';

vi.mock('./fetchWithTimeout.ts', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from './fetchWithTimeout.ts';

describe('callGemini', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('passes the gemini key via x-goog-api-key header and not in the URL query string', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '{"result": "success"}' }] },
          },
        ],
      }),
    };

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse as any);

    const key = 'test-secret-key-12345';
    const result = await callGemini(key, {
      userPrompt: 'Hello Gemini',
      temperature: 0.7,
    });

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchWithTimeout).mock.calls[0];

    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`);
    expect(url).not.toContain('key=');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    });
    expect(result.rawText).toBe('{"result": "success"}');
  });
});
