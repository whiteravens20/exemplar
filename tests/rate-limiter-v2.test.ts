import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../src/db/repositories/rate-limit-repository.js', () => ({
  default: {
    checkAndUpdateLimit: vi.fn(),
    resetUserLimit: vi.fn(),
    cleanup: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import RateLimiter from '../src/utils/rate-limiter.js';
import rateLimitRepo from '../src/db/repositories/rate-limit-repository.js';

const mockedRepo = vi.mocked(rateLimitRepo);

describe('RateLimiter - in-memory fallback', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Force in-memory mode by making DB return null
    mockedRepo.checkAndUpdateLimit.mockResolvedValue(null);
    limiter = new RateLimiter(3, 60000);
  });

  it('should allow requests within limit', async () => {
    const result = await limiter.checkLimit('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should decrement remaining with each request', async () => {
    await limiter.checkLimit('user1');
    const result = await limiter.checkLimit('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('should block when limit is exceeded', async () => {
    await limiter.checkLimit('user1');
    await limiter.checkLimit('user1');
    await limiter.checkLimit('user1');

    const result = await limiter.checkLimit('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track users independently', async () => {
    await limiter.checkLimit('user1');
    await limiter.checkLimit('user1');
    await limiter.checkLimit('user1');

    const result = await limiter.checkLimit('user2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should reset rate limit for user', async () => {
    await limiter.checkLimit('user1');
    await limiter.checkLimit('user1');
    await limiter.checkLimit('user1');

    await limiter.reset('user1');

    const result = await limiter.checkLimit('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should cleanup expired entries', async () => {
    // Create a limiter with very short window
    const shortLimiter = new RateLimiter(3, 1);
    mockedRepo.checkAndUpdateLimit.mockResolvedValue(null);

    await shortLimiter.checkLimit('user1');

    // Wait for entries to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    await shortLimiter.cleanup();

    const result = await shortLimiter.checkLimit('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});

describe('RateLimiter - database mode', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    limiter = new RateLimiter(5, 60000);
  });

  it('should use database when available', async () => {
    mockedRepo.checkAndUpdateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: new Date(Date.now() + 60000),
      current: 1,
    });

    const result = await limiter.checkLimit('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(mockedRepo.checkAndUpdateLimit).toHaveBeenCalledWith('user1', 5, 60000);
  });

  it('should fallback to in-memory when DB fails', async () => {
    mockedRepo.checkAndUpdateLimit.mockRejectedValueOnce(new Error('DB down'));

    const result = await limiter.checkLimit('user1');
    // Falls back to in-memory, which should allow
    expect(result.allowed).toBe(true);
  });

  it('should return retryAfter when DB says blocked', async () => {
    const resetAt = new Date(Date.now() + 30000);
    mockedRepo.checkAndUpdateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt,
      current: 5,
    });

    const result = await limiter.checkLimit('user1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should get stats from database', async () => {
    mockedRepo.getStats.mockResolvedValue({
      total_limited_users: 10,
      active_last_5min: 3,
    });

    const stats = await limiter.getStats();
    expect(stats.usingDatabase).toBe(true);
    expect(stats.database).toEqual({
      total_limited_users: 10,
      active_last_5min: 3,
    });
  });
});
