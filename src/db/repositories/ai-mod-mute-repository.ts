import db from '../connection.js';
import logger from '../../utils/logger.js';

export interface AiModMuteRow {
  user_discord_id: string;
  applied_at: Date;
  expires_at: Date;
}

class AiModMuteRepository {
  async upsert(discordId: string, expiresAt: Date): Promise<void> {
    if (!db.isAvailable()) return;
    try {
      await db.query(
        `INSERT INTO ai_mod_active_mutes (user_discord_id, expires_at)
         VALUES ($1, $2)
         ON CONFLICT (user_discord_id)
         DO UPDATE SET expires_at = EXCLUDED.expires_at, applied_at = NOW()`,
        [discordId, expiresAt]
      );
    } catch (error) {
      logger.error('Failed to upsert ai_mod_active_mutes row', {
        error: (error as Error).message,
        discordId,
      });
    }
  }

  async delete(discordId: string): Promise<void> {
    if (!db.isAvailable()) return;
    try {
      await db.query(
        `DELETE FROM ai_mod_active_mutes WHERE user_discord_id = $1`,
        [discordId]
      );
    } catch (error) {
      logger.error('Failed to delete ai_mod_active_mutes row', {
        error: (error as Error).message,
        discordId,
      });
    }
  }

  async findAll(): Promise<AiModMuteRow[]> {
    if (!db.isAvailable()) return [];
    try {
      const result = await db.query<AiModMuteRow>(
        `SELECT user_discord_id, applied_at, expires_at FROM ai_mod_active_mutes`
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to list ai_mod_active_mutes rows', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  async exists(discordId: string): Promise<boolean> {
    if (!db.isAvailable()) return false;
    try {
      const result = await db.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM ai_mod_active_mutes WHERE user_discord_id = $1
         ) AS exists`,
        [discordId]
      );
      return result.rows[0]?.exists ?? false;
    } catch (error) {
      logger.error('Failed to check ai_mod_active_mutes existence', {
        error: (error as Error).message,
        discordId,
      });
      return false;
    }
  }
}

export default new AiModMuteRepository();
