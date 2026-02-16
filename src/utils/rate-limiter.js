const rateLimitRepo = require('../db/repositories/rate-limit-repository');
const logger = require('./logger');

class RateLimiter {
  constructor(maxRequests = 5, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map(); // userId -> [timestamps] (in-memory fallback)
    this._isDbAvailable = true;
  }

  /**
   * Check if user has exceeded rate limit
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object>} { allowed: boolean, remaining: number, resetTime: number }
   */
  async checkLimit(userId) {
    // Try database first
    if (this._isDbAvailable) {
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
            retryAfter: dbResult.allowed ? 0 : Math.ceil((dbResult.resetAt.getTime() - Date.now()) / 1000)
          };
        }

        // Database returned null, mark as unavailable and fall through to in-memory
        this._isDbAvailable = false;
        logger.warn('Database unavailable for rate limiting, using in-memory fallback');
      } catch (error) {
        this._isDbAvailable = false;
        logger.error('Rate limit database check failed, using in-memory fallback', {
          error: error.message
        });
      }
    }

    // In-memory fallback
    return this._checkLimitInMemory(userId);
  }

  /**
   * In-memory rate limit check (fallback)
   * @private
   */
  _checkLimitInMemory(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];

    // Remove old timestamps outside the time window
    const recentRequests = userRequests.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const resetTime = oldestRequest + this.timeWindow;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000) // seconds
      };
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);

    return {
      allowed: true,
      remaining: this.maxRequests - recentRequests.length,
      resetTime: now + this.timeWindow
    };
  }

  /**
   * Reset rate limit for a user (admin override)
   * @param {string} userId - Discord user ID
   */
  async reset(userId) {
    // Try database first
    if (this._isDbAvailable) {
      try {
        await rateLimitRepo.resetUserLimit(userId);
      } catch (error) {
        logger.error('Failed to reset rate limit in database', {
          error: error.message,
          userId
        });
      }
    }

    // Always clear in-memory as well
    this.requests.delete(userId);
  }

  /**
   * Clear old entries periodically to prevent memory leak
   */
  async cleanup() {
    // Database cleanup
    if (this._isDbAvailable) {
      try {
        await rateLimitRepo.cleanup(this.timeWindow);
      } catch (error) {
        logger.error('Failed to cleanup rate limits in database', {
          error: error.message
        });
      }
    }

    // In-memory cleanup
    const now = Date.now();
    for (const [userId, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(
        timestamp => now - timestamp < this.timeWindow
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
  async getStats() {
    let dbStats = null;
    
    if (this._isDbAvailable) {
      try {
        dbStats = await rateLimitRepo.getStats();
      } catch (error) {
        logger.error('Failed to get rate limit stats from database', {
          error: error.message
        });
      }
    }

    return {
      totalUsers: this.requests.size,
      activeUsers: Array.from(this.requests.values()).filter(arr => arr.length > 0).length,
      database: dbStats,
      usingDatabase: this._isDbAvailable
    };
  }

  /**
   * Re-enable database attempts (for testing connection recovery)
   */
  enableDatabase() {
    this._isDbAvailable = true;
  }
}

module.exports = RateLimiter;
