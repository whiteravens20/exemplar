import db from '../connection.js';
import logger from '../../utils/logger.js';
import type { GlobalStats, CommandPopularity } from '../../types/database.js';

class AnalyticsRepository {
  /**
   * Log a message interaction
   */
  async logMessage(
    discordId: string,
    username: string,
    messageType: string,
    mode: string,
    responseTimeMs: number,
    tokensEstimated: number
  ): Promise<boolean> {
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
        error: (error as Error).message,
        discordId,
        messageType,
      });
      return false;
    }
  }

  /**
   * Log a command execution
   */
  async logCommand(
    discordId: string,
    username: string,
    commandName: string,
    isAdminCommand: boolean,
    success: boolean
  ): Promise<boolean> {
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
        error: (error as Error).message,
        discordId,
        commandName,
      });
      return false;
    }
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(days: number = 7): Promise<GlobalStats | null> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get global stats');
      return null;
    }

    try {
      const result = await db.query<GlobalStats>(
        'SELECT * FROM get_global_stats($1)',
        [days]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      return null;
    } catch (error) {
      logger.error('Failed to get global stats', {
        error: (error as Error).message,
        days,
      });
      return null;
    }
  }

  /**
   * Get user-specific statistics
   */
  async getUserStats(
    discordId: string,
    days: number = 30
  ): Promise<GlobalStats | null> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot get user stats');
      return null;
    }

    try {
      const result = await db.query<GlobalStats>(
        'SELECT * FROM get_user_stats($1, $2)',
        [discordId, days]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user stats', {
        error: (error as Error).message,
        discordId,
        days,
      });
      return null;
    }
  }

  /**
   * Get command popularity statistics
   */
  async getCommandPopularity(days: number = 7): Promise<CommandPopularity[]> {
    if (!db.isAvailable()) {
      return [];
    }

    try {
      const result = await db.query<CommandPopularity>(
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
        error: (error as Error).message,
        days,
      });
      return [];
    }
  }
}

export default new AnalyticsRepository();
