import db from '../connection.js';
import logger from '../../utils/logger.js';
import type { ReactionRoleInput, ReactionRoleRow } from '../../types/database.js';

const COLUMNS =
  'id, guild_id, channel_id, message_id, emoji_key, emoji_display, role_id, created_by, created_at';

/**
 * Reaction-role bindings. Writes throw so the admin command can report the
 * failure; the bulk reads and cleanups used by the runtime log and degrade.
 */
class ReactionRoleRepository {
  /** Insert a binding. Returns null when the exact binding already exists. */
  async create(input: ReactionRoleInput): Promise<ReactionRoleRow | null> {
    const result = await db.query<ReactionRoleRow>(
      `INSERT INTO reaction_roles
         (guild_id, channel_id, message_id, emoji_key, emoji_display, role_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ON CONSTRAINT uq_reaction_roles_binding DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        input.guild_id,
        input.channel_id,
        input.message_id,
        input.emoji_key,
        input.emoji_display,
        input.role_id,
        input.created_by,
      ]
    );
    return result.rows[0] ?? null;
  }

  /** Delete one binding by ID. Returns the deleted row, or null if none. */
  async delete(id: number): Promise<ReactionRoleRow | null> {
    const result = await db.query<ReactionRoleRow>(
      `DELETE FROM reaction_roles WHERE id = $1 RETURNING ${COLUMNS}`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findAll(guildId: string): Promise<ReactionRoleRow[]> {
    if (!db.isAvailable()) return [];
    try {
      const result = await db.query<ReactionRoleRow>(
        `SELECT ${COLUMNS} FROM reaction_roles WHERE guild_id = $1 ORDER BY id`,
        [guildId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to load reaction roles', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /** Delete every binding on the given messages. Returns the count deleted. */
  async deleteByMessages(messageIds: string[]): Promise<number> {
    return this.deleteWhere('message_id', messageIds);
  }

  /** Delete every binding granting the given roles. Returns the count deleted. */
  async deleteByRoles(roleIds: string[]): Promise<number> {
    return this.deleteWhere('role_id', roleIds);
  }

  private async deleteWhere(
    column: 'message_id' | 'role_id',
    ids: string[]
  ): Promise<number> {
    if (!db.isAvailable() || ids.length === 0) return 0;
    try {
      const result = await db.query(
        `DELETE FROM reaction_roles WHERE ${column} = ANY($1::varchar[])`,
        [ids]
      );
      return result.rowCount ?? 0;
    } catch (error) {
      logger.error('Failed to delete reaction roles', {
        error: (error as Error).message,
        column,
      });
      return 0;
    }
  }
}

export default new ReactionRoleRepository();
