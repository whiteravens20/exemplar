import db from '../connection.js';
import logger from '../../utils/logger.js';
import type { UserContext, ConversationStats } from '../../types/database.js';

class ConversationRepository {
  /**
   * Save a conversation message to database
   */
  async saveMessage(
    discordId: string,
    username: string,
    userMessage: string,
    aiResponse: string
  ): Promise<boolean> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, skipping conversation save');
      return false;
    }

    try {
      await db.query(
        `INSERT INTO conversations (user_id, user_message, ai_response)
         VALUES (get_or_create_user($1, $2), $3, $4)`,
        [discordId, username, userMessage, aiResponse]
      );

      return true;
    } catch (error) {
      logger.error('Failed to save conversation', {
        error: (error as Error).message,
        discordId,
      });
      return false;
    }
  }

  /**
   * Get recent conversation messages for a user
   */
  async getRecentMessages(
    discordId: string,
    limit: number = 20
  ): Promise<UserContext[] | null> {
    if (!db.isAvailable()) {
      logger.debug(
        'Database unavailable, cannot retrieve conversation history'
      );
      return null;
    }

    try {
      const result = await db.query<UserContext>(
        'SELECT * FROM get_user_context($1, $2)',
        [discordId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve conversation history', {
        error: (error as Error).message,
        discordId,
      });
      return null;
    }
  }

  /**
   * Whether n8n keeps its chat memory in this database. The table is created by
   * n8n's Postgres Chat Memory node on first use, and only when its credential
   * points here, so it is absent on a fresh install and when n8n uses another
   * database.
   */
  private async hasN8nMemory(): Promise<boolean> {
    const result = await db.query<{ present: boolean }>(
      "SELECT to_regclass('n8n_chat_histories') IS NOT NULL AS present"
    );
    return result.rows[0]?.present === true;
  }

  /**
   * Flush conversation history for a specific user: the bot's own rows and,
   * when n8n keeps it in this database, the n8n memory. Returns the number of
   * rows deleted, or null when nothing could be flushed.
   */
  async flushUserConversations(discordId: string): Promise<number | null> {
    if (!db.isAvailable()) {
      logger.warn('Database unavailable, cannot flush user conversations');
      return null;
    }

    try {
      const conversationsResult = await db.query(
        `DELETE FROM conversations
         WHERE user_id = (SELECT id FROM users WHERE discord_id = $1)`,
        [discordId]
      );
      const botConversations = conversationsResult.rowCount ?? 0;

      let n8nMemory = 0;
      if (await this.hasN8nMemory()) {
        const n8nResult = await db.query(
          `DELETE FROM n8n_chat_histories
           WHERE session_id = $1`,
          [discordId]
        );
        n8nMemory = n8nResult.rowCount ?? 0;
      }

      const totalDeleted = botConversations + n8nMemory;

      logger.info('User conversations and n8n memory flushed', {
        discordId,
        botConversations,
        n8nMemory,
        totalDeleted,
      });

      return totalDeleted;
    } catch (error) {
      logger.error('Failed to flush user conversations', {
        error: (error as Error).message,
        discordId,
      });
      return null;
    }
  }

  /**
   * Flush all conversations (admin operation). Returns the number of rows
   * deleted, or null when nothing could be flushed.
   */
  async flushAllConversations(): Promise<number | null> {
    if (!db.isAvailable()) {
      logger.warn('Database unavailable, cannot flush all conversations');
      return null;
    }

    try {
      const hasN8nMemory = await this.hasN8nMemory();
      const countResult = await db.query<{
        bot_count: string;
        n8n_count: string;
      }>(
        hasN8nMemory
          ? 'SELECT (SELECT COUNT(*) FROM conversations) as bot_count, (SELECT COUNT(*) FROM n8n_chat_histories) as n8n_count'
          : 'SELECT COUNT(*) as bot_count, 0::bigint as n8n_count FROM conversations'
      );
      const counts = countResult.rows[0];

      await db.query('TRUNCATE conversations');
      if (hasN8nMemory) await db.query('TRUNCATE n8n_chat_histories');

      const totalDeleted =
        parseInt(counts.bot_count) + parseInt(counts.n8n_count);

      logger.warn('All conversations and n8n memory flushed', {
        operation: 'admin_flush_all',
        botConversations: counts.bot_count,
        n8nMemory: counts.n8n_count,
        totalDeleted,
      });

      return totalDeleted;
    } catch (error) {
      logger.error('Failed to flush all conversations', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get conversation statistics
   */
  async getStats(): Promise<ConversationStats | null> {
    if (!db.isAvailable()) {
      return null;
    }

    try {
      const result = await db.query<ConversationStats>(`
        SELECT 
          COUNT(*)::INTEGER as total_messages,
          COUNT(DISTINCT user_id)::INTEGER as unique_users,
          MAX(timestamp) as last_message,
          COUNT(CASE WHEN timestamp > NOW() - INTERVAL '1 hour' THEN 1 END)::INTEGER as messages_last_hour
        FROM conversations
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get conversation stats', {
        error: (error as Error).message,
      });
      return null;
    }
  }
}

export default new ConversationRepository();
