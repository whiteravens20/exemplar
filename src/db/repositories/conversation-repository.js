const db = require('../connection');
const logger = require('../../utils/logger');

class ConversationRepository {
  /**
   * Save a conversation message to database
   * @param {string} discordId - Discord user ID
   * @param {string} username - Discord username (optional)
   * @param {string} userMessage - User's message
   * @param {string} aiResponse - AI's response
   * @returns {Promise<boolean>} Success status
   */
  async saveMessage(discordId, username, userMessage, aiResponse) {
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
        error: error.message,
        discordId
      });
      return false;
    }
  }

  /**
   * Get recent conversation messages for a user
   * @param {string} discordId - Discord user ID
   * @param {number} limit - Number of messages to retrieve (default: 20)
   * @returns {Promise<Array|null>} Array of conversation objects or null on error
   */
  async getRecentMessages(discordId, limit = 20) {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, cannot retrieve conversation history');
      return null;
    }

    try {
      const result = await db.query(
        'SELECT * FROM get_user_context($1, $2)',
        [discordId, limit]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve conversation history', {
        error: error.message,
        discordId
      });
      return null;
    }
  }

  /**
   * Flush conversation history for a specific user
   * @param {string} discordId - Discord user ID
   * @returns {Promise<number>} Number of deleted rows, or 0 on error
   */
  async flushUserConversations(discordId) {
    if (!db.isAvailable()) {
      logger.warn('Database unavailable, cannot flush user conversations');
      return 0;
    }

    try {
      const result = await db.query(
        `DELETE FROM conversations
         WHERE user_id = (SELECT id FROM users WHERE discord_id = $1)`,
        [discordId]
      );
      
      logger.info('User conversations flushed', {
        discordId,
        deletedCount: result.rowCount
      });
      
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to flush user conversations', {
        error: error.message,
        discordId
      });
      return 0;
    }
  }

  /**
   * Flush all conversations (admin operation)
   * @returns {Promise<number>} Number of deleted rows, or 0 on error
   */
  async flushAllConversations() {
    if (!db.isAvailable()) {
      logger.warn('Database unavailable, cannot flush all conversations');
      return 0;
    }

    try {
      const result = await db.query('TRUNCATE conversations');
      
      logger.warn('All conversations flushed', {
        operation: 'admin_flush_all'
      });
      
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to flush all conversations', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Get conversation statistics
   * @returns {Promise<Object|null>} Statistics object or null
   */
  async getStats() {
    if (!db.isAvailable()) {
      return null;
    }

    try {
      const result = await db.query(`
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
        error: error.message
      });
      return null;
    }
  }
}

module.exports = new ConversationRepository();
