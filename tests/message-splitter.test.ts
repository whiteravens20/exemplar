import { describe, it, expect } from 'vitest';
import { splitMessage, SAFE_LENGTH } from '../src/utils/message-splitter.js';

describe('splitMessage', () => {
  it('should return single chunk for short messages', () => {
    const chunks = splitMessage('Hello world');
    expect(chunks).toEqual(['Hello world']);
  });

  it('should return empty-ish array for empty string', () => {
    const chunks = splitMessage('');
    expect(chunks).toEqual(['']);
  });

  it('should split long messages into safe-length chunks', () => {
    const longText = 'word '.repeat(500); // 2500 chars
    const chunks = splitMessage(longText);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(SAFE_LENGTH);
    }
  });

  it('should preserve code blocks when possible', () => {
    const text = 'Before\n```js\nconst x = 1;\n```\nAfter';
    const chunks = splitMessage(text);

    // short enough to be a single chunk
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('```js');
    expect(chunks[0]).toContain('```');
  });

  it('should recombine all chunks to contain all original content', () => {
    const longText = Array.from({ length: 100 }, (_, i) => `Paragraph ${i}: ${'x'.repeat(20)}`).join('\n\n');
    const chunks = splitMessage(longText);
    const recombined = chunks.join('');

    // All paragraph markers should be present
    for (let i = 0; i < 100; i++) {
      expect(recombined).toContain(`Paragraph ${i}`);
    }
  });

  it('should handle custom maxLength', () => {
    const text = 'a'.repeat(200);
    const chunks = splitMessage(text, 100);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  it('should export SAFE_LENGTH as 1900', () => {
    expect(SAFE_LENGTH).toBe(1900);
  });
});
