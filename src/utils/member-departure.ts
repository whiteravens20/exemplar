import {
  AuditLogEvent,
  type Guild,
  type GuildAuditLogsEntry,
  type PartialUser,
  type User,
} from 'discord.js';

/** Why a member is no longer on the server. */
export type Departure =
  | { kind: 'left' }
  | { kind: 'kicked' | 'banned'; executor: User | PartialUser | null; reason: string | null }
  /** Kicked or banned by the bot itself, which logs that as moderation. */
  | { kind: 'byBot' }
  /** The audit log could not be read, most often for want of View Audit Log. */
  | { kind: 'unknown'; error: string };

/** How old a kick or ban entry may be and still explain this departure. */
const MATCH_WINDOW_MS = 15_000;
/** The audit-log entry can trail the gateway event: look again after these pauses. */
const LOOKUP_DELAYS_MS = [0, 1_000, 2_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tell a member who left on their own from one who was kicked or banned, from
 * the server's audit log: Discord sends the same event for all three.
 */
export async function findDeparture(
  guild: Guild,
  userId: string,
  delays: readonly number[] = LOOKUP_DELAYS_MS
): Promise<Departure> {
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    let entries: GuildAuditLogsEntry[];
    try {
      const [kicks, bans] = await Promise.all([
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 }),
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 }),
      ]);
      entries = [...kicks.entries.values(), ...bans.entries.values()];
    } catch (error) {
      return { kind: 'unknown', error: (error as Error).message };
    }
    const match = entries
      .filter(
        (entry) =>
          entry.targetId === userId && Date.now() - entry.createdTimestamp <= MATCH_WINDOW_MS
      )
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0];
    if (match) {
      if (match.executorId === guild.client.user.id) return { kind: 'byBot' };
      return {
        kind: match.action === AuditLogEvent.MemberKick ? 'kicked' : 'banned',
        executor: match.executor,
        reason: match.reason,
      };
    }
  }
  return { kind: 'left' };
}
