import db from '../connection.js';
import logger from '../../utils/logger.js';
import type {
  ModerationLogEntry,
  ModerationLogFilters,
  ModerationLogPage,
  ModerationLogRow,
  ModerationLogStats,
} from '../../types/database.js';

/** Hard ceiling on how many rows a single query can return. */
export const MAX_QUERY_LIMIT = 200;
const DEFAULT_QUERY_LIMIT = 50;

/**
 * Build the parameterized WHERE clause + ordered params for a log query.
 *
 * Kept as a standalone pure function (no DB access) so the filter → SQL mapping
 * can be unit-tested in isolation. Every dynamic value becomes a `$n`
 * placeholder — user input is never interpolated into the SQL string.
 *
 * Exported for tests.
 */
export function buildLogWhere(filters: ModerationLogFilters): {
  clause: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const push = (sql: string, value: unknown): void => {
    params.push(value);
    conditions.push(sql.replace('$?', `$${params.length}`));
  };

  if (filters.from) push('created_at >= $?', filters.from);
  if (filters.to) push('created_at <= $?', filters.to);
  if (filters.targetUserId) push('target_user_id = $?', filters.targetUserId);
  if (filters.channelId) push('channel_id = $?', filters.channelId);
  if (filters.actorType) push('actor_type = $?', filters.actorType);
  if (filters.eventType) push('event_type = $?', filters.eventType);
  if (filters.severity) push('severity = $?', filters.severity);

  if (filters.search) {
    // Case-insensitive free-text match across the human-readable columns. The
    // pattern is a bound parameter, so `%`/`_` from the user are treated as
    // literal wildcards but never as SQL — no injection surface.
    params.push(`%${filters.search}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(reason ILIKE ${p} OR ai_reasoning ILIKE ${p} OR ` +
        `target_username ILIKE ${p} OR actor_label ILIKE ${p})`
    );
  }

  const clause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
}

/** Clamp a requested limit into the allowed range. Exported for tests. */
export function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || limit === undefined) return DEFAULT_QUERY_LIMIT;
  return Math.max(1, Math.min(MAX_QUERY_LIMIT, Math.floor(limit)));
}

class ModerationLogRepository {
  /**
   * Append a moderation event. Fire-and-forget by contract: a logging failure
   * (or an unavailable DB) must never break the moderation action that
   * triggered it, so this swallows errors and returns a boolean.
   */
  async record(entry: ModerationLogEntry): Promise<boolean> {
    if (!db.isAvailable()) {
      logger.debug('Database unavailable, skipping moderation log');
      return false;
    }

    try {
      await db.query(
        `INSERT INTO moderation_logs
           (guild_id, event_type, severity, actor_type, actor_id, actor_label,
            target_user_id, target_username, channel_id, action, reason,
            ai_reasoning, ai_rule, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          entry.guildId ?? null,
          entry.eventType,
          entry.severity ?? 'info',
          entry.actorType ?? 'human',
          entry.actorId ?? null,
          entry.actorLabel ?? null,
          entry.targetUserId ?? null,
          entry.targetUsername ?? null,
          entry.channelId ?? null,
          entry.action ?? null,
          entry.reason ?? null,
          entry.aiReasoning ?? null,
          entry.aiRule ?? null,
          JSON.stringify(entry.metadata ?? {}),
        ]
      );
      return true;
    } catch (error) {
      logger.error('Failed to record moderation log', {
        error: (error as Error).message,
        eventType: entry.eventType,
      });
      return false;
    }
  }

  /** Paginated, filtered query. Returns the page rows plus the total match count. */
  async query(filters: ModerationLogFilters): Promise<ModerationLogPage> {
    if (!db.isAvailable()) return { rows: [], total: 0 };

    const { clause, params } = buildLogWhere(filters);
    const limit = clampLimit(filters.limit);
    const offset = Math.max(0, Math.floor(filters.offset ?? 0));

    try {
      const totalResult = await db.query<{ count: string }>(
        `SELECT COUNT(*)::BIGINT AS count FROM moderation_logs ${clause}`,
        params
      );
      const total = parseInt(totalResult.rows[0]?.count ?? '0', 10);

      const rowsResult = await db.query<ModerationLogRow>(
        `SELECT * FROM moderation_logs ${clause}
         ORDER BY created_at DESC, id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      return { rows: rowsResult.rows, total };
    } catch (error) {
      logger.error('Failed to query moderation logs', {
        error: (error as Error).message,
      });
      return { rows: [], total: 0 };
    }
  }

  /** Single row by id, or null. */
  async getById(id: string): Promise<ModerationLogRow | null> {
    if (!db.isAvailable()) return null;
    try {
      const result = await db.query<ModerationLogRow>(
        'SELECT * FROM moderation_logs WHERE id = $1',
        [id]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      logger.error('Failed to fetch moderation log by id', {
        error: (error as Error).message,
        id,
      });
      return null;
    }
  }

  /** Aggregate stats for the dashboard overview over the last `days` days. */
  async getStats(days: number): Promise<ModerationLogStats> {
    const empty: ModerationLogStats = {
      total: 0,
      byType: {},
      bySeverity: {},
      byActorType: {},
      daily: [],
      topTargets: [],
    };
    if (!db.isAvailable()) return empty;

    const windowClause = "created_at > NOW() - ($1 || ' days')::INTERVAL";

    try {
      const [byType, bySeverity, byActor, daily, topTargets] = await Promise.all([
        db.query<{ key: string; count: string }>(
          `SELECT event_type AS key, COUNT(*)::BIGINT AS count
             FROM moderation_logs WHERE ${windowClause}
             GROUP BY event_type`,
          [days]
        ),
        db.query<{ key: string; count: string }>(
          `SELECT severity AS key, COUNT(*)::BIGINT AS count
             FROM moderation_logs WHERE ${windowClause}
             GROUP BY severity`,
          [days]
        ),
        db.query<{ key: string; count: string }>(
          `SELECT actor_type AS key, COUNT(*)::BIGINT AS count
             FROM moderation_logs WHERE ${windowClause}
             GROUP BY actor_type`,
          [days]
        ),
        db.query<{ day: string; count: string }>(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  COUNT(*)::BIGINT AS count
             FROM moderation_logs WHERE ${windowClause}
             GROUP BY 1 ORDER BY 1`,
          [days]
        ),
        db.query<{ user_id: string; username: string | null; count: string }>(
          `SELECT target_user_id AS user_id,
                  MAX(target_username) AS username,
                  COUNT(*)::BIGINT AS count
             FROM moderation_logs
             WHERE ${windowClause} AND target_user_id IS NOT NULL
             GROUP BY target_user_id
             ORDER BY count DESC
             LIMIT 10`,
          [days]
        ),
      ]);

      const toMap = (rows: Array<{ key: string; count: string }>) =>
        rows.reduce<Record<string, number>>((acc, r) => {
          acc[r.key] = parseInt(r.count, 10);
          return acc;
        }, {});

      const byTypeMap = toMap(byType.rows);
      const total = Object.values(byTypeMap).reduce((a, b) => a + b, 0);

      return {
        total,
        byType: byTypeMap,
        bySeverity: toMap(bySeverity.rows),
        byActorType: toMap(byActor.rows),
        daily: daily.rows.map((r) => ({
          day: r.day,
          count: parseInt(r.count, 10),
        })),
        topTargets: topTargets.rows.map((r) => ({
          userId: r.user_id,
          username: r.username,
          count: parseInt(r.count, 10),
        })),
      };
    } catch (error) {
      logger.error('Failed to compute moderation log stats', {
        error: (error as Error).message,
      });
      return empty;
    }
  }
}

export default new ModerationLogRepository();
