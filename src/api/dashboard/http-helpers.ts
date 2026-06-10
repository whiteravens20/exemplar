import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type {
  ModerationActorType,
  ModerationEventType,
  ModerationSeverity,
} from '../../types/database.js';

// ── Cookies ──────────────────────────────────────────────────────────────────

/** Parse a `Cookie:` header into a name→value map. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export interface CookieOptions {
  maxAgeSeconds?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
}

/** Serialize a `Set-Cookie` value with safe defaults (HttpOnly, SameSite=Lax). */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? '/'}`);
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
    if (options.maxAgeSeconds === 0) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }
  return parts.join('; ');
}

/** Append a `Set-Cookie` header, preserving any already set. */
export function appendSetCookie(res: Response, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookie]);
  }
}

// ── Security headers ─────────────────────────────────────────────────────────

/**
 * Conservative security headers, set without pulling in `helmet`. The CSP is
 * `self`-only (the frontend ships no inline scripts and no third-party assets);
 * framing is denied to block clickjacking.
 */
export function securityHeaders(secure: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.removeHeader('X-Powered-By');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https://cdn.discordapp.com data:; " +
        "style-src 'self'; script-src 'self'; base-uri 'none'; " +
        "form-action 'self'; frame-ancestors 'none'"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (secure) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }
    next();
  };
}

// ── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Small fixed-window per-IP rate limiter. In-memory only (one bot process), so
 * it's a guard against brute-force/abuse, not a distributed quota. Returns 429
 * with a `Retry-After` header when exceeded.
 */
export function createRateLimiter(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
      if (entry.count > maxPerWindow) {
        res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
    }

    // Opportunistic cleanup so the map can't grow unbounded.
    if (hits.size > 10_000) {
      for (const [key, value] of hits) {
        if (value.resetAt <= now) hits.delete(key);
      }
    }

    next();
  };
}

// ── Input validation ─────────────────────────────────────────────────────────

const SNOWFLAKE = /^\d{17,20}$/;

/** Validate a Discord snowflake (user/channel/guild ID). */
export function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE.test(value);
}

const EVENT_TYPES = new Set<ModerationEventType>([
  'warn',
  'ban',
  'kick',
  'mute',
  'unmute',
  'unban',
  'delete',
  'ai_flag',
  'feedback',
]);
const SEVERITIES = new Set<ModerationSeverity>([
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);
const ACTOR_TYPES = new Set<ModerationActorType>(['human', 'ai', 'system']);

export function asEventType(value: unknown): ModerationEventType | undefined {
  return typeof value === 'string' && EVENT_TYPES.has(value as ModerationEventType)
    ? (value as ModerationEventType)
    : undefined;
}
export function asSeverity(value: unknown): ModerationSeverity | undefined {
  return typeof value === 'string' && SEVERITIES.has(value as ModerationSeverity)
    ? (value as ModerationSeverity)
    : undefined;
}
export function asActorType(value: unknown): ModerationActorType | undefined {
  return typeof value === 'string' && ACTOR_TYPES.has(value as ModerationActorType)
    ? (value as ModerationActorType)
    : undefined;
}

/** Parse an ISO/parseable date string, or undefined if invalid. */
export function asDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Parse a positive integer within [min, max], falling back to `fallback`. */
export function asBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Clamp a free-text search term to a sane length. */
export function asSearch(value: unknown, maxLen = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

/** Cryptographically-random URL-safe nonce for the OAuth `state`. */
export function randomNonce(): string {
  return crypto.randomBytes(24).toString('base64url');
}
