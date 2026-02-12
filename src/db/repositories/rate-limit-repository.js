const db = require('../connection');
const logger = require('../../utils/logger');

class RateLimitRepository {
  /**
   * Check and update rate limit for a user
   * @param {string} discordId - Discord user ID
   * @param {number} maxRequests - Maximum requests allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<Object|null>} { allowed: boolean, remaining: number, resetAt: Date } or null on error
   */
  async checkAndUpdateLimit(discordId, maxRequests = 5, windowMs = 60000) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable for rate limit check');
      return null;
    }

    const client = await db.getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Get or create user
      const userResult = await client.query(
        'SELECT get_or_create_user($1) as user_id',
        [discordId]
      );
      const userId = userResult.rows[0].user_id;

      // Get current rate limit data
      const limitResult = await client.query(
        'SELECT request_timestamps FROM rate_limits WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      const now = Date.now();
      const cutoff = now - windowMs;
      let timestamps = [];

      if (limitResult.rows.length > 0 && limitResult.rows[0].request_timestamps) {
        // Filter out old timestamps
        timestamps = limitResult.rows[0].request_timestamps
          .filter(ts => ts > cutoff);
      }

      const currentCount = timestamps.length;
      const allowed = currentCount < maxRequests;

      if (allowed) {
        // Add current timestamp
        timestamps.push(now);

        // Upsert rate limit record
        await client.query(
          `INSERT INTO rate_limits (user_id, request_timestamps, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET request_timestamps = $2, updated_at = NOW()`,
          [userId, JSON.stringify(timestamps)]
        );
      }

      await client.query('COMMIT');

      const remaining = Math.max(0, maxRequests - timestamps.length);
      const resetAt = new Date(Math.min(...timestamps) + windowMs);

      return {
        allowed,
        remaining,
        resetAt,
        current: timestamps.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to check rate limit', {
        error: error.message,
        discordId
      });
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Reset rate limit for a specific user
   * @param {string} discordId - Discord user ID
   * @returns {Promise<boolean>} Success status
   */
  async resetUserLimit(discordId) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable for rate limit reset');
      return false;
    }

    try {
      await db.query(
        `DELETE FROM rate_limits
         WHERE user_id = (SELECT id FROM users WHERE discord_id = $1)`,
        [discordId]
      );
      
      logger.info('Rate limit reset for user', { discordId });
      return true;
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        error: error.message,
        discordId
      });
      return false;
    }
  }

  /**
   * Get rate limit statistics
   * @returns {Promise<Object|null>} Statistics object or null
   */
  async getStats() {
    if (!db.isAvailable()) {
      return null;
    }

    try {
      const result = await db.query(`
        SELECT 
          COUNT(*)::INTEGER as total_limited_users,
          COUNT(CASE WHEN updated_at > NOW() - INTERVAL '5 minutes' THEN 1 END)::INTEGER as active_last_5min
        FROM rate_limits
      `);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get rate limit stats', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Cleanup expired rate limits (older than window)
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<number>} Number of deleted rows
   */
  async cleanup(windowMs = 60000) {
    if (!db.isAvailable()) {
      return 0;
    }

    try {
      const cutoffTime = Date.now() - windowMs;
      const result = await db.query(
        `DELETE FROM rate_limits
         WHERE updated_at < NOW() - INTERVAL '${windowMs / 1000} seconds'
         OR jsonb_array_length(request_timestamps) = 0`
      );
      
      logger.debug('Rate limit cleanup completed', {
        deletedCount: result.rowCount
      });
      
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to cleanup rate limits', {
        error: error.message
      });
      return 0;
    }
  }
}

module.exports = new RateLimitRepository();
