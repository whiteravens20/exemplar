import { describe, it, expect } from 'vitest';
import {
  parseCookies,
  serializeCookie,
  isSnowflake,
  asEventType,
  asSeverity,
  asActorType,
  asDate,
  asBoundedInt,
  asSearch,
} from '../src/api/dashboard/http-helpers.js';

describe('parseCookies', () => {
  it('parses a multi-value cookie header', () => {
    expect(parseCookies('a=1; b=two; c=')).toEqual({ a: '1', b: 'two', c: '' });
  });
  it('handles an empty/undefined header', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });
  it('ignores prototype-polluting cookie names', () => {
    const out = parseCookies('__proto__=polluted; constructor=x; prototype=y; ok=1');
    expect(out).toEqual({ ok: '1' });
    // The Object prototype must be untouched.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('tolerates malformed percent-encoding instead of throwing', () => {
    expect(parseCookies('a=%E0%A4%A')).toEqual({ a: '%E0%A4%A' });
  });
});

describe('serializeCookie', () => {
  it('sets HttpOnly + SameSite=Lax by default', () => {
    const c = serializeCookie('s', 'v');
    expect(c).toContain('s=v');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).not.toContain('Secure');
  });
  it('adds Secure when requested', () => {
    expect(serializeCookie('s', 'v', { secure: true })).toContain('Secure');
  });
  it('expires immediately when maxAge is 0', () => {
    const c = serializeCookie('s', '', { maxAgeSeconds: 0 });
    expect(c).toContain('Max-Age=0');
    expect(c).toContain('Expires=');
  });
});

describe('input validation', () => {
  it('validates snowflakes', () => {
    expect(isSnowflake('123456789012345678')).toBe(true);
    expect(isSnowflake('abc')).toBe(false);
    expect(isSnowflake('12')).toBe(false);
    expect(isSnowflake(123 as unknown)).toBe(false);
  });

  it('allowlists enum values', () => {
    expect(asEventType('ban')).toBe('ban');
    expect(asEventType('nonsense')).toBeUndefined();
    expect(asSeverity('high')).toBe('high');
    expect(asSeverity('extreme')).toBeUndefined();
    expect(asActorType('ai')).toBe('ai');
    expect(asActorType('robot')).toBeUndefined();
  });

  it('parses dates and rejects garbage', () => {
    expect(asDate('2025-01-01T00:00:00Z')).toBeInstanceOf(Date);
    expect(asDate('not-a-date')).toBeUndefined();
    expect(asDate('')).toBeUndefined();
  });

  it('clamps bounded integers', () => {
    expect(asBoundedInt('50', 10, 1, 200)).toBe(50);
    expect(asBoundedInt('9999', 10, 1, 200)).toBe(200);
    expect(asBoundedInt('0', 10, 1, 200)).toBe(1);
    expect(asBoundedInt('x', 10, 1, 200)).toBe(10);
  });

  it('trims and caps search terms', () => {
    expect(asSearch('  hi  ')).toBe('hi');
    expect(asSearch('')).toBeUndefined();
    expect(asSearch('a'.repeat(500))?.length).toBe(200);
  });
});
