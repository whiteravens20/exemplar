import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing modules that use it
vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getTemplate } from '../src/config/response-templates.js';

describe('getTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default template for known category', () => {
    const result = getTemplate('mention');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should return specific type template', () => {
    const result = getTemplate('mention', 'friendly');
    expect(result).toBeTruthy();
    expect(result).toContain('Bracie');
  });

  it('should return fallback for unknown category', () => {
    const result = getTemplate('nonexistent');
    expect(result).toBeTruthy();
    // Should return error.generic
    expect(typeof result).toBe('string');
  });

  it('should return default type for unknown type in known category', () => {
    const result = getTemplate('mention', 'nonexistent_type');
    expect(result).toBeTruthy();
  });

  it('should return error templates', () => {
    expect(getTemplate('error', 'processing')).toContain('Błąd');
    expect(getTemplate('error', 'n8nDown')).toContain('niedostępny');
    expect(getTemplate('error', 'timeout')).toContain('czas');
    expect(getTemplate('error', 'generic')).toBeTruthy();
  });

  it('should return restricted templates', () => {
    const result = getTemplate('restricted', 'default');
    expect(result).toContain('uprawnień');
  });

  it('should return success templates', () => {
    const result = getTemplate('success', 'processed');
    expect(result).toContain('✅');
  });
});
