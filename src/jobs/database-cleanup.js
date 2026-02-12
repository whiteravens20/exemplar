const logger = require('../utils/logger');
const db = require('../db/connection');

class DatabaseCleanupJob {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.runIntervalMs = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Start the cleanup job
   */
  start() {
    if (this.intervalId) {
      logger.warn('Database cleanup job already running');
      return;
    }

    logger.info('Starting database cleanup job', {
      intervalMinutes: this.runIntervalMs / (60 * 1000)
    });

    // Run immediately on start
    this.run();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.run();
    }, this.runIntervalMs);
  }

  /**
   * Stop the cleanup job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Database cleanup job stopped');
    }
  }

  /**
   * Run cleanup operations
   */
  async run() {
    if (this.isRunning) {
      logger.debug('Cleanup job already in progress, skipping');
      return;
    }

    if (!db.isAvailable()) {
      logger.debug('Database unavailable, skipping cleanup');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Running database cleanup...');

      // Cleanup old conversations (24H retention)
      const conversationsDeleted = await this.cleanupConversations();

      // Cleanup expired warnings
      const warningsDeleted = await this.cleanupWarnings();

      // Cleanup old analytics (90D retention)
      const analyticsDeleted = await this.cleanupAnalytics();

      const duration = Date.now() - startTime;

      logger.info('Database cleanup completed', {
        durationMs: duration,
        conversationsDeleted,
        warningsDeleted,
        statsDeleted: analyticsDeleted.stats,
        commandsDeleted: analyticsDeleted.commands
      });
    } catch (error) {
      logger.error('Database cleanup failed', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Cleanup old conversations
   */
  async cleanupConversations() {
    try {
      const result = await db.query('SELECT cleanup_old_conversations()');
      const deleted = result.rows[0]?.cleanup_old_conversations || 0;
      
      if (deleted > 0) {
        logger.debug('Cleaned up old conversations', { deleted });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup conversations', { error: error.message });
      return 0;
    }
  }

  /**
   * Cleanup expired warnings
   */
  async cleanupWarnings() {
    try {
      const result = await db.query('SELECT cleanup_expired_warnings()');
      const deleted = result.rows[0]?.cleanup_expired_warnings || 0;
      
      if (deleted > 0) {
        logger.debug('Cleaned up expired warnings', { deleted });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup warnings', { error: error.message });
      return 0;
    }
  }

  /**
   * Cleanup old analytics
   */
  async cleanupAnalytics() {
    try {
      const result = await db.query('SELECT * FROM cleanup_old_analytics()');
      const stats = result.rows[0]?.stats_deleted || 0;
      const commands = result.rows[0]?.commands_deleted || 0;
      
      if (stats > 0 || commands > 0) {
        logger.debug('Cleaned up old analytics', { stats, commands });
      }
      
      return { stats, commands };
    } catch (error) {
      logger.error('Failed to cleanup analytics', { error: error.message });
      return { stats: 0, commands: 0 };
    }
  }
}

module.exports = new DatabaseCleanupJob();
