import rateLimitRepo from '../db/repositories/rate-limit-repository.js';
import logger from './logger.js';
import type { RateLimitStats } from '../types/database.js';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface RateLimiterStats {
  totalUsers: number;
  activeUsers: number;
  database: RateLimitStats | null;
  usingDatabase: boolean;
}

// After a failed database check, stay on the in-memory fallback this long
// before trying the database again.
const DB_RETRY_MS = 60 * 1000;

class RateLimiter {
  private maxRequests: number;
  private timeWindow: number;
  private requests: Map<string, number[]>;
  /** Epoch ms before which database checks are skipped; 0 = try now. */
  private dbRetryAt = 0;

  constructor(maxRequests: number = 5, timeWindow: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map();
  }

  private get useDatabase(): boolean {
    return Date.now() >= this.dbRetryAt;
  }

  /**
   * Check if user has exceeded rate limit
   */
  async checkLimit(userId: string): Promise<RateLimitResult> {
    if (this.useDatabase) {
      try {
        const dbResult = await rateLimitRepo.checkAndUpdateLimit(
          userId,
          this.maxRequests,
          this.timeWindow
        );

        if (dbResult !== null) {
          return {
            allowed: dbResult.allowed,
            remaining: dbResult.remaining,
            resetTime: dbResult.resetAt.getTime(),
            retryAfter: dbResult.allowed
              ? 0
              : Math.ceil(
                  (dbResult.resetAt.getTime() - Date.now()) / 1000
                ),
          };
        }

        this.dbRetryAt = Date.now() + DB_RETRY_MS;
        logger.warn(
          'Database unavailable for rate limiting, using in-memory fallback'
        );
      } catch (error) {
        this.dbRetryAt = Date.now() + DB_RETRY_MS;
        logger.error(
          'Rate limit database check failed, using in-memory fallback',
          {
            error: (error as Error).message,
          }
        );
      }
    }

    return this._checkLimitInMemory(userId);
  }

  /**
   * In-memory rate limit check (fallback)
   */
  private _checkLimitInMemory(userId: string): RateLimitResult {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];

    const recentRequests = userRequests.filter(
      (timestamp) => now - timestamp < this.timeWindow
    );

    if (recentRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const resetTime = oldestRequest + this.timeWindow;

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }

    recentRequests.push(now);
    this.requests.set(userId, recentRequests);

    return {
      allowed: true,
      remaining: this.maxRequests - recentRequests.length,
      resetTime: now + this.timeWindow,
    };
  }

  /**
   * Reset rate limit for a user (admin override)
   */
  async reset(userId: string): Promise<void> {
    if (this.useDatabase) {
      try {
        await rateLimitRepo.resetUserLimit(userId);
      } catch (error) {
        logger.error('Failed to reset rate limit in database', {
          error: (error as Error).message,
          userId,
        });
      }
    }

    this.requests.delete(userId);
  }

  /**
   * Clear old entries periodically to prevent memory leak
   */
  async cleanup(): Promise<void> {
    if (this.useDatabase) {
      try {
        await rateLimitRepo.cleanup(this.timeWindow);
      } catch (error) {
        logger.error('Failed to cleanup rate limits in database', {
          error: (error as Error).message,
        });
      }
    }

    const now = Date.now();
    for (const [userId, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(
        (timestamp) => now - timestamp < this.timeWindow
      );

      if (recentRequests.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, recentRequests);
      }
    }
  }

  /**
   * Get stats for monitoring
   */
  async getStats(): Promise<RateLimiterStats> {
    let dbStats: RateLimitStats | null = null;

    if (this.useDatabase) {
      try {
        dbStats = await rateLimitRepo.getStats();
      } catch (error) {
        logger.error('Failed to get rate limit stats from database', {
          error: (error as Error).message,
        });
      }
    }

    return {
      totalUsers: this.requests.size,
      activeUsers: Array.from(this.requests.values()).filter(
        (arr) => arr.length > 0
      ).length,
      database: dbStats,
      usingDatabase: dbStats !== null,
    };
  }
}

export default RateLimiter;
