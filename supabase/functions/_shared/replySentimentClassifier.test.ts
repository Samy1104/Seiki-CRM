import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallGemini } = vi.hoisted(() => ({ mockCallGemini: vi.fn() }));
vi.mock('./geminiApi.ts', () => ({ callGemini: mockCallGemini }));

import {
  buildSentimentPrompt,
  parseSentimentResponse,
  classifyReplySentiment,
} from './replySentimentClassifier';

describe('buildSentimentPrompt', () => {
  it('includes the original subject and reply text in the user prompt', () => {
    const { user } = buildSentimentPrompt("Oui je suis intéressé, appelons-nous demain", 'Une idée pour votre entreprise');
    expect(user).toContain('Une idée pour votre entreprise');
    expect(user).toContain("Oui je suis intéressé, appelons-nous demain");
  });

  it('truncates reply text longer than 4000 characters', () => {
    const longText = 'a'.repeat(5000);
    const { user } = buildSentimentPrompt(longText, 'Sujet');
    expect(user).toContain('a'.repeat(4000));
    expect(user).not.toContain('a'.repeat(4001));
  });

  it('instructs the model to default to neutral when unsure', () => {
    const { system } = buildSentimentPrompt('texte', 'sujet');
    expect(system).toContain('neutral');
    expect(system.toLowerCase()).toContain('doute');
  });
});

describe('parseSentimentResponse', () => {
  it('parses a valid positive response', () => {
    expect(parseSentimentResponse('{"sentiment": "positive", "reason": "Demande un rendez-vous"}'))
      .toEqual({ sentiment: 'positive', reason: 'Demande un rendez-vous' });
  });

  it('parses a valid negative response', () => {
    expect(parseSentimentResponse('{"sentiment": "negative", "reason": "Demande d\'arrêter les emails"}').sentiment)
      .toBe('negative');
  });

  it('parses a valid neutral response', () => {
    expect(parseSentimentResponse('{"sentiment": "neutral", "reason": "Réponse automatique absence bureau"}').sentiment)
      .toBe('neutral');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSentimentResponse('not json')).toThrow('JSON invalide');
  });

  it('throws on an unrecognized sentiment value', () => {
    expect(() => parseSentimentResponse('{"sentiment": "maybe", "reason": "test"}')).toThrow('Sentiment invalide');
  });

  it('throws when reason is missing', () => {
    expect(() => parseSentimentResponse('{"sentiment": "neutral"}')).toThrow('Raison manquante');
  });
});

describe('classifyReplySentiment', () => {
  beforeEach(() => {
    mockCallGemini.mockReset();
  });

  it('calls callGemini with the built prompts and returns the parsed result', async () => {
    mockCallGemini.mockResolvedValue({ rawText: '{"sentiment": "positive", "reason": "Intéressé"}', generationMs: 10, usageMetadata: null });
    const result = await classifyReplySentiment('fake-key', "Oui ça m'intéresse", 'Sujet original');
    expect(result).toEqual({ sentiment: 'positive', reason: 'Intéressé' });
    expect(mockCallGemini).toHaveBeenCalledWith('fake-key', expect.objectContaining({ temperature: 0.2 }));
  });

  it('propagates a parse error when Gemini returns malformed JSON', async () => {
    mockCallGemini.mockResolvedValue({ rawText: 'not json', generationMs: 10, usageMetadata: null });
    await expect(classifyReplySentiment('fake-key', 'texte', 'sujet')).rejects.toThrow('JSON invalide');
  });
});
