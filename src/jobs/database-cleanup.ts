import logger from '../utils/logger.js';
import db from '../db/connection.js';

interface AnalyticsCleanupResult {
  stats: number;
  commands: number;
}

class DatabaseCleanupJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private readonly runIntervalMs = 60 * 60 * 1000; // 1 hour

  /**
   * Start the cleanup job
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Database cleanup job already running');
      return;
    }

    logger.info('Starting database cleanup job', {
      intervalMinutes: this.runIntervalMs / (60 * 1000),
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
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Database cleanup job stopped');
    }
  }

  /**
   * Run cleanup operations
   */
  async run(): Promise<void> {
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

      // Warnings are intentionally not deleted — the lifetime warn count is
      // load-bearing for the auto-ban escalation (issue #16). The
      // cleanup_expired_warnings() SQL function stays defined for manual use
      // but is no longer scheduled here.

      // Cleanup old analytics (90D retention)
      const analyticsDeleted = await this.cleanupAnalytics();

      // Cleanup old dashboard moderation logs (90D retention)
      const modLogsDeleted = await this.cleanupModerationLogs();

      const duration = Date.now() - startTime;

      logger.info('Database cleanup completed', {
        durationMs: duration,
        conversationsDeleted,
        statsDeleted: analyticsDeleted.stats,
        commandsDeleted: analyticsDeleted.commands,
        moderationLogsDeleted: modLogsDeleted,
      });
    } catch (error) {
      logger.error('Database cleanup failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Cleanup old conversations
   */
  private async cleanupConversations(): Promise<number> {
    try {
      const result = await db.query<{
        cleanup_old_conversations: number;
      }>('SELECT cleanup_old_conversations()');
      const deleted = result.rows[0]?.cleanup_old_conversations || 0;

      if (deleted > 0) {
        logger.debug('Cleaned up old conversations', { deleted });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup conversations', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Cleanup old analytics
   */
  private async cleanupAnalytics(): Promise<AnalyticsCleanupResult> {
    try {
      const result = await db.query<{
        stats_deleted: number;
        commands_deleted: number;
      }>('SELECT * FROM cleanup_old_analytics()');
      const stats = result.rows[0]?.stats_deleted || 0;
      const commands = result.rows[0]?.commands_deleted || 0;

      if (stats > 0 || commands > 0) {
        logger.debug('Cleaned up old analytics', { stats, commands });
      }

      return { stats, commands };
    } catch (error) {
      logger.error('Failed to cleanup analytics', {
        error: (error as Error).message,
      });
      return { stats: 0, commands: 0 };
    }
  }

  /**
   * Cleanup old dashboard moderation logs (90-day retention).
   */
  private async cleanupModerationLogs(): Promise<number> {
    try {
      const result = await db.query<{ cleanup_old_moderation_logs: number }>(
        'SELECT cleanup_old_moderation_logs($1)',
        [90]
      );
      const deleted = result.rows[0]?.cleanup_old_moderation_logs || 0;

      if (deleted > 0) {
        logger.debug('Cleaned up old moderation logs', { deleted });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup moderation logs', {
        error: (error as Error).message,
      });
      return 0;
    }
  }
}

export default new DatabaseCleanupJob();
