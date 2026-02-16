const db = require('../connection');
const logger = require('../../utils/logger');

class AnalyticsRepository {
  /**
   * Log a message interaction
   * @param {string} discordId - Discord user ID
   * @param {string} username - Discord username (optional)
   * @param {string} messageType - Type: 'dm', 'mention', 'command'
   * @param {string} mode - Mode: 'chat' or 'code'
   * @param {number} responseTimeMs - Response time in milliseconds
   * @param {number} tokensEstimated - Estimated token count
   * @returns {Promise<boolean>} Success status
   */
  async logMessage(discordId, username, messageType, mode, responseTimeMs, tokensEstimated) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, skipping message analytics');
      return false;
    }

    try {
      await db.query(
        `INSERT INTO message_stats (user_id, message_type, mode, response_time_ms, tokens_estimated)
         VALUES (get_or_create_user($1, $2), $3, $4, $5, $6)`,
        [discordId, username, messageType, mode, responseTimeMs, tokensEstimated]
      );

      return true;
    } catch (error) {
      logger.error('Failed to log message analytics', {
        error: error.message,
        discordId,
        messageType
      });
      return false;
    }
  }

  /**
   * Log a command execution
   * @param {string} discordId - Discord user ID
   * @param {string} username - Discord username (optional)
   * @param {string} commandName - Name of the command
   * @param {boolean} isAdminCommand - Whether it's an admin command
   * @param {boolean} success - Whether command executed successfully
   * @returns {Promise<boolean>} Success status
   */
  async logCommand(discordId, username, commandName, isAdminCommand, success) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, skipping command analytics');
      return false;
    }

    try {
      await db.query(
        `INSERT INTO command_usage (user_id, command_name, is_admin_command, success)
         VALUES (get_or_create_user($1, $2), $3, $4, $5)`,
        [discordId, username, commandName, isAdminCommand, success]
      );

      return true;
    } catch (error) {
      logger.error('Failed to log command analytics', {
        error: error.message,
        discordId,
        commandName
      });
      return false;
    }
  }

  /**
   * Get global statistics
   * @param {number} days - Number of days to include
   * @returns {Promise<Object|null>} Statistics object or null
   */
  async getGlobalStats(days = 7) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get global stats');
      return null;
    }

    try {
      const result = await db.query(
        'SELECT * FROM get_global_stats($1)',
        [days]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      return null;
    } catch (error) {
      logger.error('Failed to get global stats', {
        error: error.message,
        days
      });
      return null;
    }
  }

  /**
   * Get user-specific statistics
   * @param {string} discordId - Discord user ID
   * @param {number} days - Number of days to include
   * @returns {Promise<Object|null>} Statistics object or null
   */
  async getUserStats(discordId, days = 30) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get user stats');
      return null;
    }

    try {
      const result = await db.query(
        'SELECT * FROM get_user_stats($1, $2)',
        [discordId, days]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user stats', {
        error: error.message,
        discordId,
        days
      });
      return null;
    }
  }

  /**
   * Get command popularity statistics
   * @param {number} days - Number of days to include
   * @returns {Promise<Array>} Array of command usage stats
   */
  async getCommandPopularity(days = 7) {
    if (!db.isAvailable()) {
      return [];
    }

    try {
      const result = await db.query(
        `SELECT command_name, COUNT(*)::INTEGER as usage_count
         FROM command_usage
         WHERE executed_at > NOW() - ($1 || ' days')::INTERVAL
         GROUP BY command_name
         ORDER BY usage_count DESC
         LIMIT 10`,
        [days]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get command popularity', {
        error: error.message,
        days
      });
      return [];
    }
  }
}

module.exports = new AnalyticsRepository();
