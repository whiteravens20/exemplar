import { describe, it, expect } from 'vitest';
import {
  signSession,
  verifySession,
  signState,
  verifyState,
  signValue,
  verifyValue,
} from '../src/api/dashboard/session.js';

const SECRET = 'a'.repeat(40);

describe('signValue / verifyValue', () => {
  it('round-trips an object', () => {
    const token = signValue({ hello: 'world', n: 1 }, SECRET);
    expect(verifyValue(token, SECRET)).toEqual({ hello: 'world', n: 1 });
  });

  it('rejects a tampered body', () => {
    const token = signValue({ a: 1 }, SECRET);
    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ a: 2 })).toString('base64url');
    expect(verifyValue(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(verifyValue(`${body}.deadbeef`, SECRET)).toBeNull();
  });

  it('rejects the wrong secret', () => {
    const token = signValue({ a: 1 }, SECRET);
    expect(verifyValue(token, 'b'.repeat(40))).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(verifyValue(undefined, SECRET)).toBeNull();
    expect(verifyValue('', SECRET)).toBeNull();
    expect(verifyValue('nodot', SECRET)).toBeNull();
  });
});

describe('session', () => {
  const base = { userId: '123', username: 'mod', authorized: true, isAdmin: false };

  it('round-trips a session within its TTL', () => {
    const token = signSession(base, SECRET, 3600);
    const payload = verifySession(token, SECRET);
    expect(payload).toMatchObject(base);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects an expired session', () => {
    const token = signSession(base, SECRET, -1);
    expect(verifySession(token, SECRET)).toBeNull();
  });

  it('rejects a payload missing required fields', () => {
    const token = signValue({ userId: '1', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
    expect(verifySession(token, SECRET)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = signSession(base, SECRET, 3600);
    expect(verifySession(token, 'other-secret-xxxxxxxxxxxxxxxxxxxxxxxx')).toBeNull();
  });
});

describe('CSRF state', () => {
  it('accepts a matching nonce within TTL', () => {
    const state = signState('nonce-1', SECRET);
    expect(verifyState(state, 'nonce-1', SECRET)).toBe(true);
  });

  it('rejects a mismatched nonce', () => {
    const state = signState('nonce-1', SECRET);
    expect(verifyState(state, 'nonce-2', SECRET)).toBe(false);
  });

  it('rejects an expired state', () => {
    const state = signState('nonce-1', SECRET, -1);
    expect(verifyState(state, 'nonce-1', SECRET)).toBe(false);
  });

  it('rejects a missing cookie nonce', () => {
    const state = signState('nonce-1', SECRET);
    expect(verifyState(state, undefined, SECRET)).toBe(false);
  });
});
