import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelType } from 'discord.js';

vi.mock('../src/db/repositories/moderation-log-repository.js', () => ({
  default: { record: vi.fn(async () => true) },
}));

vi.mock('../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  logBindingChange,
  logBindingsForgotten,
  logDatabaseFlush,
  logReactionRole,
  logReactionRoleFailure,
} from '../src/utils/admin-log.js';
import moderationLogRepo from '../src/db/repositories/moderation-log-repository.js';
import logger from '../src/utils/logger.js';
import configManager from '../src/config/config.js';
import { t } from '../src/utils/i18n.js';
import type { ReactionRoleRow } from '../src/types/database.js';

const record = vi.mocked(moderationLogRepo.record);
const MOD_LOG = '900';

function row(overrides: Partial<ReactionRoleRow> = {}): ReactionRoleRow {
  return {
    id: 7,
    guild_id: 'g1',
    channel_id: 'c1',
    message_id: 'm1',
    emoji_key: '👍',
    emoji_display: '👍',
    role_id: 'r1',
    command: null,
    created_by: 'admin',
    created_at: new Date(),
    ...overrides,
  };
}

function setup() {
  const send = vi.fn(async () => undefined);
  const channel = { type: ChannelType.GuildText, send };
  const roles = new Map<string, { id: string; name: string }>([
    ['g1', { id: 'g1', name: '@everyone' }],
    ['r1', { id: 'r1', name: 'Gamer' }],
    ['r2', { id: 'r2', name: 'Artist' }],
  ]);
  const guild: any = {
    id: 'g1',
    roles: { cache: roles },
    channels: { cache: new Map([[MOD_LOG, channel]]) },
  };
  const user = { id: 'u1', tag: 'member' };
  const member: any = {
    id: 'u1',
    user,
    partial: false,
    joinedTimestamp: Date.UTC(2026, 0, 2, 3, 4, 5),
    roles: { cache: new Map([...roles].filter(([id]) => id !== 'r2')) },
  };
  const admin: any = { id: 'a1', tag: 'admin' };
  /** The fields of the embed sent to the mod-log, by name. */
  const sent = () => {
    const embed = send.mock.calls.at(-1)?.[0]?.embeds[0]?.data;
    return {
      title: embed?.title,
      fields: Object.fromEntries((embed?.fields ?? []).map((f: any) => [f.name, f.value])),
    };
  };
  return { guild, member, user, admin, send, sent };
}

beforeEach(() => {
  vi.clearAllMocks();
  configManager.config.moderation.modLogChannelId = MOD_LOG;
});

describe('reaction roles in the admin log', () => {
  it('records a granted role and posts it to the mod-log', async () => {
    const { guild, member, sent } = setup();
    await logReactionRole(guild, member, row(), 'r1', 'add');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: 'g1',
        eventType: 'role_grant',
        severity: 'info',
        actorType: 'system',
        actorLabel: t('reactionRoles.log.actor'),
        targetUserId: 'u1',
        targetUsername: 'member',
        action: 'grant',
        reason: t('reactionRoles.auditGrant', { emoji: '👍' }),
        metadata: expect.objectContaining({ bindingId: 7, roleId: 'r1', roleName: 'Gamer' }),
      })
    );
    const { title, fields } = sent();
    expect(title).toBe(`🎭 ${t('reactionRoles.log.grantedTitle')}`);
    expect(fields[t('moderation.fields.user')]).toBe('member (u1)');
    expect(fields[t('reactionRoles.log.fields.role')]).toBe('<@&r1>');
    expect(fields[t('reactionRoles.log.fields.reaction')]).toBe('👍 https://discord.com/channels/g1/c1/m1');
  });

  it('records a removed role as a revoke', async () => {
    const { guild, member, sent } = setup();
    await logReactionRole(guild, member, row(), 'r1', 'remove');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'role_revoke', action: 'revoke' })
    );
    expect(sent().title).toBe(`🎭 ${t('reactionRoles.log.revokedTitle')}`);
  });

  it('still records an entry without a mod-log channel', async () => {
    const { guild, member, send } = setup();
    configManager.config.moderation.modLogChannelId = undefined;
    await logReactionRole(guild, member, row(), 'r1', 'add');
    expect(record).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('logs and swallows a mod-log channel that refuses the entry', async () => {
    const { guild, member, send } = setup();
    send.mockRejectedValueOnce(new Error('Missing Access'));
    await expect(logReactionRole(guild, member, row(), 'r1', 'add')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send mod-log entry',
      expect.objectContaining({ error: 'Missing Access' })
    );
  });

  it('records a failed grant with the problem in words', async () => {
    const { guild, member, sent } = setup();
    await logReactionRoleFailure(guild, member, row(), 'r1', 'add', {
      kind: 'problem',
      problem: 'botHierarchy',
    });
    const problem = t('reactionRoles.log.problems.botHierarchy');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'role_failed',
        severity: 'medium',
        action: 'grant',
        reason: problem,
      })
    );
    const { title, fields } = sent();
    expect(title).toBe(`⚠️ ${t('reactionRoles.log.grantFailedTitle')}`);
    expect(fields[t('moderation.fields.problem')]).toBe(problem);
  });

  it("records Discord's refusal and a missing role", async () => {
    const { guild, member, sent } = setup();
    await logReactionRoleFailure(guild, member, row(), 'r1', 'remove', {
      kind: 'discord',
      error: 'Missing Permissions',
    });
    expect(sent().title).toBe(`⚠️ ${t('reactionRoles.log.revokeFailedTitle')}`);
    expect(sent().fields[t('moderation.fields.problem')]).toBe(
      t('reactionRoles.log.problems.discord', { error: 'Missing Permissions' })
    );

    await logReactionRoleFailure(guild, member, row({ role_id: 'gone' }), 'gone', 'add', {
      kind: 'roleMissing',
    });
    // A mention of a deleted role would show as "@deleted-role"; the ID says which.
    expect(sent().fields[t('reactionRoles.log.fields.role')]).toBe('gone');
    expect(sent().fields[t('moderation.fields.problem')]).toBe(
      t('reactionRoles.log.problems.roleMissing')
    );
  });

  it('records who added or removed a binding and what it gives', async () => {
    const { guild, admin, sent } = setup();
    await logBindingChange(guild, row(), admin, 'add');
    expect(record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: 'reaction_role',
        actorType: 'human',
        actorId: 'a1',
        actorLabel: 'admin',
        action: 'bind',
        reason: '#7: 👍 → @Gamer',
      })
    );
    expect(sent().title).toBe(`🎭 ${t('reactionRoles.log.boundTitle')}`);
    expect(sent().fields[t('moderation.fields.moderator')]).toBe('admin (a1)');

    await logBindingChange(guild, row({ role_id: null, command: 'rules' }), admin, 'remove');
    expect(record).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'unbind', reason: '#7: 👍 → /rules' })
    );
    expect(sent().title).toBe(`🎭 ${t('reactionRoles.log.unboundTitle')}`);
    expect(sent().fields[t('reactionRoles.log.fields.gives')]).toBe('/rules');

    // The dashboard shows a mention as written, so its text names the role.
    await logBindingChange(guild, row({ role_id: 'gone' }), admin, 'remove');
    expect(record).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: `#7: 👍 → @${t('commands.reactionrole.deletedRole')}` })
    );
  });

  it('lists dropped bindings with the cause, a deleted role by name', async () => {
    const { guild, sent } = setup();
    await logBindingsForgotten(guild, [row(), row({ id: 8, role_id: 'gone' })], 'roleDeleted');
    const reason = t('reactionRoles.log.forgetCause.roleDeleted');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'reaction_role', actorType: 'system', action: 'forget', reason })
    );
    expect(sent().fields[t('reactionRoles.log.fields.bindings')]).toBe(
      `#7: 👍 → <@&r1>\n#8: 👍 → @${t('commands.reactionrole.deletedRole')}`
    );
    expect(sent().fields[t('moderation.fields.reason')]).toBe(reason);
  });

  it('keeps a long list of dropped bindings within an embed field', async () => {
    const { guild, sent } = setup();
    const rows = Array.from({ length: 100 }, (_, i) => row({ id: 1000 + i }));
    await logBindingsForgotten(guild, rows, 'messageDeleted');
    expect(sent().fields[t('reactionRoles.log.fields.bindings')].length).toBeLessThanOrEqual(1024);
  });

  it('writes nothing for an empty list', async () => {
    const { guild, send } = setup();
    await logBindingsForgotten(guild, [], 'messageDeleted');
    expect(record).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('a cleared database in the admin log', () => {
  it('records the admin and what was deleted', async () => {
    const { guild, admin, sent } = setup();
    await logDatabaseFlush(guild, admin, 12);
    const reason = t('commands.flushdb.logDeleted', { count: 12 });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'data_flush',
        severity: 'high',
        actorType: 'human',
        actorId: 'a1',
        action: 'flush',
        reason,
        metadata: { conversationMessages: 12 },
      })
    );
    expect(sent().title).toBe(`🧹 ${t('commands.flushdb.logTitle')}`);
    expect(sent().fields[t('commands.flushdb.logDeletedField')]).toBe(reason);
  });
});
