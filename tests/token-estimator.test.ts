import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateTokensForConversation } from '../src/utils/token-estimator.js';

describe('estimateTokens', () => {
  it('should estimate tokens based on char/4 heuristic', () => {
    // 8 chars → ceil(8/4) = 2
    expect(estimateTokens('test1234')).toBe(2);
  });

  it('should ceil the result', () => {
    // 5 chars → ceil(5/4) = 2
    expect(estimateTokens('hello')).toBe(2);
  });

  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should return 0 for null', () => {
    expect(estimateTokens(null)).toBe(0);
  });

  it('should return 0 for undefined', () => {
    expect(estimateTokens(undefined)).toBe(0);
  });

  it('should handle long text', () => {
    const text = 'a'.repeat(1000);
    expect(estimateTokens(text)).toBe(250);
  });

  it('should handle unicode text', () => {
    const text = 'Zażółć gęślą jaźń'; // 18 chars
    expect(estimateTokens(text)).toBe(Math.ceil(18 / 4));
  });
});

describe('estimateTokensForConversation', () => {
  it('should sum tokens across multiple texts', () => {
    const texts = ['hello', 'world']; // 5+5 = 10 chars → ceil(5/4)+ceil(5/4) = 2+2 = 4
    expect(estimateTokensForConversation(texts)).toBe(4);
  });

  it('should return 0 for empty array', () => {
    expect(estimateTokensForConversation([])).toBe(0);
  });

  it('should handle single item', () => {
    expect(estimateTokensForConversation(['test'])).toBe(1);
  });
});
