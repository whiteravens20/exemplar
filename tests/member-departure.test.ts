import { describe, it, expect, vi } from 'vitest';
import { AuditLogEvent } from 'discord.js';
import { findDeparture } from '../src/utils/member-departure.js';

const NO_WAIT = [0, 0, 0];

interface FakeEntry {
  action: AuditLogEvent;
  targetId: string;
  executorId: string;
  executor: { id: string; tag: string } | null;
  reason: string | null;
  createdTimestamp: number;
}

function entry(action: AuditLogEvent, overrides: Partial<FakeEntry> = {}): FakeEntry {
  return {
    action,
    targetId: 'u1',
    executorId: 'mod',
    executor: { id: 'mod', tag: 'moderator' },
    reason: null,
    createdTimestamp: Date.now() - 1_000,
    ...overrides,
  };
}

/** A guild whose audit log returns `lookups[i]` on the i-th lookup (then the last one). */
function guildWith(...lookups: FakeEntry[][]) {
  let lookup = 0;
  // Each lookup reads kicks and bans; the ban request closes it.
  const fetchAuditLogs = vi.fn(async ({ type }: { type: AuditLogEvent }) => {
    const entries = lookups[Math.min(lookup, lookups.length - 1)].filter((e) => e.action === type);
    if (type === AuditLogEvent.MemberBanAdd) lookup++;
    return { entries: new Map(entries.map((e, i) => [String(i), e])) };
  });
  return { client: { user: { id: 'bot' } }, fetchAuditLogs } as any;
}

describe('findDeparture', () => {
  it('finds a member who left when no kick or ban names them', async () => {
    const guild = guildWith([entry(AuditLogEvent.MemberKick, { targetId: 'someone-else' })]);
    expect(await findDeparture(guild, 'u1', NO_WAIT)).toEqual({ kind: 'left' });
    // It looked on every attempt before deciding.
    expect(guild.fetchAuditLogs).toHaveBeenCalledTimes(6);
  });

  it('finds a kick, with who did it and why', async () => {
    const kick = entry(AuditLogEvent.MemberKick, { reason: 'spam' });
    const guild = guildWith([kick]);
    expect(await findDeparture(guild, 'u1', NO_WAIT)).toEqual({
      kind: 'kicked',
      executor: kick.executor,
      reason: 'spam',
    });
  });

  it('finds a ban', async () => {
    const ban = entry(AuditLogEvent.MemberBanAdd);
    expect(await findDeparture(guildWith([ban]), 'u1', NO_WAIT)).toEqual({
      kind: 'banned',
      executor: ban.executor,
      reason: null,
    });
  });

  it('recognises a kick or ban the bot made itself', async () => {
    const guild = guildWith([entry(AuditLogEvent.MemberBanAdd, { executorId: 'bot' })]);
    expect(await findDeparture(guild, 'u1', NO_WAIT)).toEqual({ kind: 'byBot' });
  });

  it('ignores an old kick of the same member', async () => {
    const old = entry(AuditLogEvent.MemberKick, { createdTimestamp: Date.now() - 60_000 });
    expect(await findDeparture(guildWith([old]), 'u1', NO_WAIT)).toEqual({ kind: 'left' });
  });

  it('takes the newest of several matching entries', async () => {
    const older = entry(AuditLogEvent.MemberKick, { createdTimestamp: Date.now() - 10_000 });
    const newer = entry(AuditLogEvent.MemberBanAdd, { createdTimestamp: Date.now() - 500 });
    expect((await findDeparture(guildWith([older, newer]), 'u1', NO_WAIT)).kind).toBe('banned');
  });

  it('looks again for an entry that arrives after the event', async () => {
    const kick = entry(AuditLogEvent.MemberKick);
    const guild = guildWith([], [kick]);
    expect((await findDeparture(guild, 'u1', NO_WAIT)).kind).toBe('kicked');
    expect(guild.fetchAuditLogs).toHaveBeenCalledTimes(4);
  });

  it('reports an audit log it cannot read', async () => {
    const guild: any = {
      client: { user: { id: 'bot' } },
      fetchAuditLogs: vi.fn(async () => {
        throw new Error('Missing Permissions');
      }),
    };
    expect(await findDeparture(guild, 'u1', NO_WAIT)).toEqual({
      kind: 'unknown',
      error: 'Missing Permissions',
    });
  });
});
