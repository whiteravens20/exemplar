import db from '../connection.js';
import logger from '../../utils/logger.js';
import type { RateLimitCheckResult, RateLimitStats } from '../../types/database.js';

class RateLimitRepository {
  /**
   * Check and update rate limit for a user
   */
  async checkAndUpdateLimit(
    discordId: string,
    maxRequests: number = 5,
    windowMs: number = 60000
  ): Promise<RateLimitCheckResult | null> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable for rate limit check');
      return null;
    }

    const client = await db.getPool().connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query<{ user_id: number }>(
        'SELECT get_or_create_user($1) as user_id',
        [discordId]
      );
      const userId = userResult.rows[0].user_id;

      const limitResult = await client.query<{
        request_timestamps: number[] | null;
      }>(
        'SELECT request_timestamps FROM rate_limits WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      const now = Date.now();
      const cutoff = now - windowMs;
      let timestamps: number[] = [];

      if (
        limitResult.rows.length > 0 &&
        limitResult.rows[0].request_timestamps
      ) {
        timestamps = limitResult.rows[0].request_timestamps.filter(
          (ts) => ts > cutoff
        );
      }

      const currentCount = timestamps.length;
      const allowed = currentCount < maxRequests;

      if (allowed) {
        timestamps.push(now);

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
        current: timestamps.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to check rate limit', {
        error: (error as Error).message,
        discordId,
      });
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Reset rate limit for a specific user
   */
  async resetUserLimit(discordId: string): Promise<boolean> {
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
        error: (error as Error).message,
        discordId,
      });
      return false;
    }
  }

  /**
   * Get rate limit statistics
   */
  async getStats(): Promise<RateLimitStats | null> {
    if (!db.isAvailable()) {
      return null;
    }

    try {
      const result = await db.query<RateLimitStats>(`
        SELECT 
          COUNT(*)::INTEGER as total_limited_users,
          COUNT(CASE WHEN updated_at > NOW() - INTERVAL '5 minutes' THEN 1 END)::INTEGER as active_last_5min
        FROM rate_limits
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get rate limit stats', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Cleanup expired rate limits
   */
  async cleanup(windowMs: number = 60000): Promise<number> {
    if (!db.isAvailable()) {
      return 0;
    }

    try {
      const windowSeconds = Math.floor(windowMs / 1000);
      const result = await db.query(
        `DELETE FROM rate_limits
         WHERE updated_at < NOW() - make_interval(secs => $1)
         OR jsonb_array_length(request_timestamps) = 0`,
        [windowSeconds]
      );

      logger.debug('Rate limit cleanup completed', {
        deletedCount: result.rowCount,
      });

      return result.rowCount ?? 0;
    } catch (error) {
      logger.error('Failed to cleanup rate limits', {
        error: (error as Error).message,
      });
      return 0;
    }
  }
}

export default new RateLimitRepository();
