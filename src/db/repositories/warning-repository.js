const db = require('../connection');
const logger = require('../../utils/logger');

class WarningRepository {
  /**
   * Add a warning for a user
   * @param {string} discordId - Discord user ID
   * @param {string} username - Discord username (optional)
   * @param {string} reason - Warning reason
   * @param {string} issuedBy - Discord ID of the moderator
   * @returns {Promise<number>} Number of active warnings after adding, or 0 on error
   */
  async addWarning(discordId, username, reason, issuedBy) {
    if (!db.isAvailable()) {
      logger.warn('Database unavailable, warning not recorded', { discordId });
      return 0;
    }

    try {
      // Insert warning with 30-day expiry
      await db.query(
        `INSERT INTO warnings (user_id, reason, issued_by, expires_at)
         VALUES (get_or_create_user($1, $2), $3, $4, NOW() + INTERVAL '30 days')`,
        [discordId, username, reason, issuedBy]
      );

      // Get active warning count
      const countResult = await db.query(
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
        activeWarnings: activeCount
      });

      return activeCount;
    } catch (error) {
      logger.error('Failed to add warning', {
        error: error.message,
        discordId,
        reason
      });
      return 0;
    }
  }

  /**
   * Get active warning count for a user
   * @param {string} discordId - Discord user ID
   * @returns {Promise<number>} Number of active warnings
   */
  async getActiveWarnings(discordId) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get warning count');
      return 0;
    }

    try {
      const result = await db.query(
        `SELECT COUNT(*)::INTEGER as count
         FROM warnings w
         JOIN users u ON u.id = w.user_id
         WHERE u.discord_id = $1 AND w.expires_at > NOW()`,
        [discordId]
      );

      return result.rows[0].count;
    } catch (error) {
      logger.error('Failed to get active warnings', {
        error: error.message,
        discordId
      });
      return 0;
    }
  }

  /**
   * Get warning history for a user
   * @param {string} discordId - Discord user ID
   * @param {boolean} includeExpired - Include expired warnings
   * @returns {Promise<Array>} Array of warning objects
   */
  async getWarningHistory(discordId, includeExpired = false) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get warning history');
      return [];
    }

    try {
      const query = includeExpired
        ? `SELECT w.*, u.username as issued_by_username
           FROM warnings w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN users issuer ON issuer.discord_id = w.issued_by
           WHERE u.discord_id = $1
           ORDER BY w.issued_at DESC`
        : `SELECT w.*, u.username as issued_by_username
           FROM warnings w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN users issuer ON issuer.discord_id = w.issued_by
           WHERE u.discord_id = $1 AND w.expires_at > NOW()
           ORDER BY w.issued_at DESC`;

      const result = await db.query(query, [discordId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get warning history', {
        error: error.message,
        discordId
      });
      return [];
    }
  }

  /**
   * Clear all warnings for a user (admin operation)
   * @param {string} discordId - Discord user ID
   * @returns {Promise<number>} Number of deleted rows
   */
  async clearUserWarnings(discordId) {
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
        deletedCount: result.rowCount
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Failed to clear user warnings', {
        error: error.message,
        discordId
      });
      return 0;
    }
  }

  /**
   * Get warning statistics
   * @returns {Promise<Object|null>} Statistics object or null
   */
  async getStats() {
    if (!db.isAvailable()) {
      return null;
    }

    try {
      const result = await db.query(`
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
        error: error.message
      });
      return null;
    }
  }
}

module.exports = new WarningRepository();
