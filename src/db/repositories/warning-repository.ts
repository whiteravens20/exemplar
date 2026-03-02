import db from '../connection.js';
import logger from '../../utils/logger.js';
import type { Warning, WarningStats } from '../../types/database.js';

class WarningRepository {
  /**
   * Add a warning for a user
   */
  async addWarning(
    discordId: string,
    username: string,
    reason: string,
    issuedBy: string
  ): Promise<number> {
    if (!db.isAvailable()) {
      logger.warn('Database unavailable, warning not recorded', { discordId });
      return 0;
    }

    try {
      await db.query(
        `INSERT INTO warnings (user_id, reason, issued_by, expires_at)
         VALUES (get_or_create_user($1, $2), $3, $4, NOW() + INTERVAL '30 days')`,
        [discordId, username, reason, issuedBy]
      );

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*)::INTEGER as count
         FROM warnings w
         JOIN users u ON u.id = w.user_id
         WHERE u.discord_id = $1 AND w.expires_at > NOW()`,
        [discordId]
      );

      const activeCount = countResult.rows[0].count;

      logger.info('Warning added', {
        discordId,
        reason,
        issuedBy,
        activeWarnings: activeCount,
      });

      return activeCount;
    } catch (error) {
      logger.error('Failed to add warning', {
        error: (error as Error).message,
        discordId,
        reason,
      });
      return 0;
    }
  }

  /**
   * Get active warning count for a user
   */
  async getActiveWarnings(discordId: string): Promise<number> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get warning count');
      return 0;
    }

    try {
      const result = await db.query<{ count: number }>(
        `SELECT COUNT(*)::INTEGER as count
         FROM warnings w
         JOIN users u ON u.id = w.user_id
         WHERE u.discord_id = $1 AND w.expires_at > NOW()`,
        [discordId]
      );

      return result.rows[0].count;
    } catch (error) {
      logger.error('Failed to get active warnings', {
        error: (error as Error).message,
        discordId,
      });
      return 0;
    }
  }

  /**
   * Get warning history for a user
   */
  async getWarningHistory(
    discordId: string,
    includeExpired: boolean = false
  ): Promise<Warning[]> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get warning history');
      return [];
    }

    try {
      const query = includeExpired
        ? `SELECT w.*, u.username as issued_by_username, u.discord_id as user_discord_id
           FROM warnings w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN users issuer ON issuer.discord_id = w.issued_by
           WHERE u.discord_id = $1
           ORDER BY w.issued_at DESC`
        : `SELECT w.*, u.username as issued_by_username, u.discord_id as user_discord_id
           FROM warnings w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN users issuer ON issuer.discord_id = w.issued_by
           WHERE u.discord_id = $1 AND w.expires_at > NOW()
           ORDER BY w.issued_at DESC`;

      const result = await db.query<Warning>(query, [discordId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get warning history', {
        error: (error as Error).message,
        discordId,
      });
      return [];
    }
  }

  /**
   * Get all warnings (admin operation)
   */
  async getAllWarnings(includeExpired: boolean = false): Promise<Warning[]> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get all warnings');
      return [];
    }

    try {
      const query = includeExpired
        ? `SELECT w.*, u.username, u.discord_id as user_discord_id,
                  issuer.username as issued_by_username
           FROM warnings w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN users issuer ON issuer.discord_id = w.issued_by
           ORDER BY w.issued_at DESC`
        : `SELECT w.*, u.username, u.discord_id as user_discord_id,
                  issuer.username as issued_by_username
           FROM warnings w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN users issuer ON issuer.discord_id = w.issued_by
           WHERE w.expires_at > NOW()
           ORDER BY w.issued_at DESC`;

      const result = await db.query<Warning>(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get all warnings', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Clear all warnings for a user (admin operation)
   */
  async clearUserWarnings(discordId: string): Promise<number> {
    if (!db.isAvailable()) {
      logger.warn('Database unavailable, cannot clear warnings');
      return 0;
    }

    try {
      const result = await db.query(
        `DELETE FROM warnings
         WHERE user_id = (SELECT id FROM users WHERE discord_id = $1)`,
        [discordId]
      );

      logger.warn('User warnings cleared', {
        discordId,
        deletedCount: result.rowCount,
      });

      return result.rowCount ?? 0;
    } catch (error) {
      logger.error('Failed to clear user warnings', {
        error: (error as Error).message,
        discordId,
      });
      return 0;
    }
  }

  /**
   * Get warning statistics
   */
  async getStats(): Promise<WarningStats | null> {
    if (!db.isAvailable()) {
      return null;
    }

    try {
      const result = await db.query<WarningStats>(`
        SELECT 
          COUNT(*)::INTEGER as total_warnings,
          COUNT(CASE WHEN expires_at > NOW() THEN 1 END)::INTEGER as active_warnings,
          COUNT(DISTINCT user_id)::INTEGER as users_with_warnings,
          COUNT(CASE WHEN issued_at > NOW() - INTERVAL '7 days' THEN 1 END)::INTEGER as warnings_last_week
        FROM warnings
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get warning stats', {
        error: (error as Error).message,
      });
      return null;
    }
  }
}

export default new WarningRepository();
