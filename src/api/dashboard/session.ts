import crypto from 'node:crypto';

/**
 * Stateless, signed-cookie sessions for the dashboard.
 *
 * A cookie value is `base64url(JSON payload) . base64url(HMAC-SHA256)`. There is
 * no server-side session store — the signature is the integrity guarantee and
 * `exp` bounds the lifetime. Verification is constant-time
 * (`crypto.timingSafeEqual`) and rejects tampered, malformed, or expired tokens.
 *
 * The functions here are pure (no I/O, no global state) so they are trivially
 * unit-testable.
 */

export interface SessionPayload {
  userId: string;
  username: string;
  /** Whether the user passed the dashboard RBAC check at login. */
  authorized: boolean;
  /** Whether the user is a guild owner/admin (vs. allowed-role only). */
  isAdmin: boolean;
  /** Expiry as epoch seconds. */
  exp: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function hmac(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

/** Sign an arbitrary JSON-serializable object into a `body.signature` token. */
export function signValue(value: unknown, secret: string): string {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${body}.${hmac(body, secret)}`;
}

/**
 * Verify a `body.signature` token and return the parsed payload, or `null` if
 * the signature is invalid or the body is not valid JSON. Does **not** check
 * expiry — callers that need it (sessions) do so explicitly.
 */
export function verifyValue<T = unknown>(
  token: string | undefined,
  secret: string
): T | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = hmac(body, secret);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Build a signed session token for the given user. */
export function signSession(
  data: Omit<SessionPayload, 'exp'>,
  secret: string,
  ttlSeconds: number
): string {
  const payload: SessionPayload = { ...data, exp: nowSeconds() + ttlSeconds };
  return signValue(payload, secret);
}

/**
 * Verify a session token: valid signature, well-formed shape, and not expired.
 * Returns the payload or `null`.
 */
export function verifySession(
  token: string | undefined,
  secret: string
): SessionPayload | null {
  const payload = verifyValue<Partial<SessionPayload>>(token, secret);
  if (!payload) return null;
  if (
    typeof payload.userId !== 'string' ||
    typeof payload.username !== 'string' ||
    typeof payload.authorized !== 'boolean' ||
    typeof payload.isAdmin !== 'boolean' ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }
  if (payload.exp < nowSeconds()) return null;
  return payload as SessionPayload;
}

/** Sign a short-lived CSRF `state` nonce for the OAuth round-trip. */
export function signState(
  nonce: string,
  secret: string,
  ttlSeconds = 600
): string {
  return signValue({ nonce, exp: nowSeconds() + ttlSeconds }, secret);
}

/** Verify a CSRF `state` token and confirm it matches `expectedNonce`. */
export function verifyState(
  token: string | undefined,
  expectedNonce: string | undefined,
  secret: string
): boolean {
  const payload = verifyValue<{ nonce?: string; exp?: number }>(token, secret);
  if (!payload || typeof payload.nonce !== 'string') return false;
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds()) return false;
  if (!expectedNonce) return false;
  const a = Buffer.from(payload.nonce);
  const b = Buffer.from(expectedNonce);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
