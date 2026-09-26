import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

vi.mock('../src/db/repositories/reaction-role-repository.js', () => ({
  default: {
    create: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    deleteByMessages: vi.fn(),
    deleteByRoles: vi.fn(),
  },
}));

vi.mock('../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import reactionRoles from '../src/utils/reaction-role-manager.js';
import reactionRoleRepo from '../src/db/repositories/reaction-role-repository.js';
import configManager from '../src/config/config.js';
import type { ReactionRoleRow } from '../src/types/database.js';

const repo = vi.mocked(reactionRoleRepo);
const GUILD = 'guild';

function row(id: number, messageId: string, emojiKey: string, roleId: string): ReactionRoleRow {
  return {
    id,
    guild_id: GUILD,
    channel_id: 'channel',
    message_id: messageId,
    emoji_key: emojiKey,
    emoji_display: emojiKey,
    role_id: roleId,
    created_by: 'admin',
    created_at: new Date(),
  };
}

function goneError(code: number) {
  return new DiscordAPIError(
    { code, message: 'Unknown' },
    code,
    404,
    'GET',
    '/channels',
    {}
  );
}

/** A fake guild with roles r1..r3 (positions 1..3), r-high above the bot, and one member. */
function setup(options: { memberRoles?: string[]; goneMessages?: string[] } = {}) {
  const guild: any = { id: GUILD, ownerId: 'owner' };
  const roles = [
    { id: 'r1', position: 1 },
    { id: 'r2', position: 2 },
    { id: 'r3', position: 3 },
    { id: 'r-high', position: 20 },
  ].map((role) => ({ ...role, guild, managed: false }));
  guild.roles = { cache: new Map(roles.map((role) => [role.id, role])) };

  const held = new Set(options.memberRoles ?? []);
  const calls: string[] = [];
  const member: any = {
    user: { bot: false },
    roles: {
      cache: held,
      add: vi.fn(async (role: { id: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        held.add(role.id);
        calls.push(`add ${role.id}`);
      }),
      remove: vi.fn(async (role: { id: string }) => {
        held.delete(role.id);
        calls.push(`remove ${role.id}`);
      }),
    },
  };
  const bot = { permissions: { has: () => true }, roles: { highest: { position: 10 } } };
  const gone = new Set(options.goneMessages ?? []);
  guild.members = { fetch: vi.fn(async () => member), me: bot };
  guild.channels = {
    fetch: vi.fn(async () => ({
      isTextBased: () => true,
      messages: {
        fetch: async (id: string) => {
          if (gone.has(id)) throw goneError(RESTJSONErrorCodes.UnknownMessage);
          return { id };
        },
      },
    })),
  };
  const client: any = { user: { id: 'bot' }, guilds: { cache: new Map([[GUILD, guild]]) } };

  const react = (messageId: string, emoji: string, change: 'add' | 'remove', userId = 'user') =>
    reactionRoles.handleReaction(
      {
        client,
        message: { id: messageId, guildId: GUILD },
        emoji: { id: null, name: emoji },
      } as any,
      { id: userId } as any,
      change
    );

  return { client, guild, member, held, calls, react };
}

const bindings = [
  row(1, 'm1', '👍', 'r1'),
  row(2, 'm1', '🎮', 'r2'), // second emoji on the same message
  row(3, 'm2', '👍', 'r3'), // same emoji, another message
  row(4, 'm2', '🎮', 'r1'), // same role, another message
  row(5, 'm3', '🔥', 'r-high'), // role above the bot
];

beforeAll(() => {
  configManager.config.discord.serverId = GUILD;
});

beforeEach(async () => {
  vi.clearAllMocks();
  repo.findAll.mockResolvedValue(bindings);
  await reactionRoles.load(setup().client);
});

describe('ReactionRoleManager', () => {
  it('grants the mapped role on reaction add and revokes it on remove', async () => {
    const { react, held, calls } = setup();
    await react('m1', '👍', 'add');
    expect([...held]).toEqual(['r1']);
    await react('m1', '👍', 'remove');
    expect([...held]).toEqual([]);
    expect(calls).toEqual(['add r1', 'remove r1']);
  });

  it('treats several emoji on one message independently', async () => {
    const { react, held } = setup();
    await react('m1', '🎮', 'add');
    expect([...held]).toEqual(['r2']);
    await react('m1', '👍', 'add');
    expect([...held].sort()).toEqual(['r1', 'r2']);
    await react('m1', '🎮', 'remove');
    expect([...held]).toEqual(['r1']);
  });

  it('maps the same emoji on different messages to different roles', async () => {
    const { react, held } = setup();
    await react('m2', '👍', 'add');
    expect([...held]).toEqual(['r3']);
  });

  it('matches Unicode emoji with or without a variation selector', async () => {
    repo.findAll.mockResolvedValue([row(9, 'm9', '❤', 'r1')]);
    const { client, react, held } = setup();
    await reactionRoles.load(client);
    await react('m9', '❤️', 'add');
    expect([...held]).toEqual(['r1']);
  });

  it('skips roles the member already has or does not have', async () => {
    const { react, member } = setup({ memberRoles: ['r1'] });
    await react('m1', '👍', 'add');
    await react('m1', '🎮', 'remove');
    expect(member.roles.add).not.toHaveBeenCalled();
    expect(member.roles.remove).not.toHaveBeenCalled();
  });

  it('never assigns a role at or above the bot', async () => {
    const { react, member } = setup();
    await react('m3', '🔥', 'add');
    expect(member.roles.add).not.toHaveBeenCalled();
  });

  it('ignores the bot itself, other servers and unbound reactions without API calls', async () => {
    const { react, guild, client } = setup();
    await react('m1', '👍', 'add', 'bot');
    await react('m1', '🔥', 'add');
    await react('unbound', '👍', 'add');
    await reactionRoles.handleReaction(
      { client, message: { id: 'm1', guildId: 'other' }, emoji: { id: null, name: '👍' } } as any,
      { id: 'user' } as any,
      'add'
    );
    expect(guild.members.fetch).not.toHaveBeenCalled();
  });

  it('ignores reactions from bots', async () => {
    const { react, member } = setup();
    member.user.bot = true;
    await react('m1', '👍', 'add');
    expect(member.roles.add).not.toHaveBeenCalled();
  });

  it('applies rapid add/remove of one member in event order', async () => {
    const { react, held, calls } = setup();
    await Promise.all([
      react('m1', '👍', 'add'),
      react('m1', '👍', 'remove'),
      react('m1', '👍', 'add'),
    ]);
    expect(calls).toEqual(['add r1', 'remove r1', 'add r1']);
    expect([...held]).toEqual(['r1']);
  });

  it('keeps applying other bindings when one role update fails', async () => {
    repo.findAll.mockResolvedValue([row(1, 'm1', '👍', 'r1'), row(2, 'm1', '👍', 'r2')]);
    const { client, react, member, held } = setup();
    await reactionRoles.load(client);
    member.roles.add.mockRejectedValueOnce(new Error('Missing Permissions'));
    await react('m1', '👍', 'add');
    expect(member.roles.add).toHaveBeenCalledTimes(2);
    expect([...held]).toEqual(['r2']);
  });

  it('drops bindings whose message or role was deleted while offline', async () => {
    repo.findAll.mockResolvedValue([
      row(1, 'm1', '👍', 'r1'),
      row(2, 'gone', '👍', 'r1'),
      row(3, 'm1', '🎮', 'deleted-role'),
    ]);
    const { client } = setup({ goneMessages: ['gone'] });
    await reactionRoles.load(client);
    expect(repo.deleteByMessages).toHaveBeenCalledWith(['gone']);
    expect(repo.deleteByRoles).toHaveBeenCalledWith(['deleted-role']);
    expect(reactionRoles.bindings().map((r) => r.id)).toEqual([1]);
  });

  it('keeps bindings when a message cannot be verified for another reason', async () => {
    repo.findAll.mockResolvedValue([row(1, 'm1', '👍', 'r1')]);
    const { client, guild } = setup();
    guild.channels.fetch.mockRejectedValueOnce(goneError(RESTJSONErrorCodes.MissingAccess));
    await reactionRoles.load(client);
    expect(repo.deleteByMessages).not.toHaveBeenCalled();
    expect(reactionRoles.bindings()).toHaveLength(1);
  });

  it('touches the database on message or role deletion only when bound', async () => {
    await reactionRoles.forgetMessages(['unbound'], 'message deleted');
    await reactionRoles.forgetRoles(['r3'], 'role deleted');
    expect(repo.deleteByMessages).not.toHaveBeenCalled();
    expect(repo.deleteByRoles).toHaveBeenCalledWith(['r3']);
    expect(reactionRoles.match('m2', '👍')).toEqual([]);
  });

  it('adds and removes bindings through bind and unbind', async () => {
    const created = row(10, 'm4', '✅', 'r2');
    repo.create.mockResolvedValueOnce(created).mockResolvedValueOnce(null);
    expect(await reactionRoles.bind(created)).toBe(created);
    expect(await reactionRoles.bind(created)).toBeNull();
    expect(reactionRoles.match('m4', '✅')).toEqual([created]);

    repo.delete.mockResolvedValueOnce(created);
    expect(await reactionRoles.unbind(10, 'admin')).toBe(created);
    expect(reactionRoles.binding(10)).toBeUndefined();
  });
});
