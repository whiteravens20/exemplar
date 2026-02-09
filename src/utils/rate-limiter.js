class RateLimiter {
  constructor(maxRequests = 5, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map(); // userId -> [timestamps]
  }

  /**
   * Check if user has exceeded rate limit
   * @param {string} userId - Discord user ID
   * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
   */
  checkLimit(userId) {
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
  reset(userId) {
    this.requests.delete(userId);
  }

  /**
   * Clear old entries periodically to prevent memory leak
   */
  cleanup() {
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
  getStats() {
    return {
      totalUsers: this.requests.size,
      activeUsers: Array.from(this.requests.values()).filter(arr => arr.length > 0).length
    };
  }
}

module.exports = RateLimiter;
