import { describe, it, expect } from 'vitest';
import {
  KeyedQueue,
  ReactionRoleIndex,
  normaliseUnicodeEmoji,
  parseEmoji,
  parseMessageRef,
  parseRoleRef,
  reactionEmojiKey,
  roleProblem,
} from '../src/utils/reaction-roles.js';
import type { ReactionRoleRow } from '../src/types/database.js';

const GUILD = '111111111111111111';
const CHANNEL = '222222222222222222';
const MESSAGE = '333333333333333333';
const EMOJI = '444444444444444444';
const ROLE = '555555555555555555';

describe('parseMessageRef', () => {
  it('parses a message link', () => {
    expect(
      parseMessageRef(`https://discord.com/channels/${GUILD}/${CHANNEL}/${MESSAGE}`)
    ).toEqual({ guildId: GUILD, channelId: CHANNEL, messageId: MESSAGE });
  });

  it('accepts ptb, canary and discordapp.com links', () => {
    for (const host of ['ptb.discord.com', 'canary.discord.com', 'discordapp.com']) {
      expect(
        parseMessageRef(`https://${host}/channels/${GUILD}/${CHANNEL}/${MESSAGE}`)
      ).toEqual({ guildId: GUILD, channelId: CHANNEL, messageId: MESSAGE });
    }
  });

  it('parses a channelId-messageId pair', () => {
    expect(parseMessageRef(` ${CHANNEL}-${MESSAGE} `)).toEqual({
      guildId: null,
      channelId: CHANNEL,
      messageId: MESSAGE,
    });
  });

  it('rejects anything else', () => {
    expect(parseMessageRef(MESSAGE)).toBeNull();
    expect(parseMessageRef('https://example.com/channels/1/2/3')).toBeNull();
    expect(
      parseMessageRef(`https://discord.com/channels/${GUILD}/${CHANNEL}`)
    ).toBeNull();
    expect(parseMessageRef('')).toBeNull();
  });
});

describe('parseEmoji', () => {
  it('parses custom emoji in every accepted form', () => {
    for (const input of [
      `<:pog:${EMOJI}>`,
      `<a:dance:${EMOJI}>`,
      `pog:${EMOJI}`,
      `a:dance:${EMOJI}`,
      EMOJI,
    ]) {
      expect(parseEmoji(input), input).toEqual({ key: EMOJI, react: input, custom: true });
    }
  });

  it('parses Unicode emoji, keyed without variation selectors', () => {
    expect(parseEmoji('👍')).toEqual({ key: '👍', react: '👍', custom: false });
    expect(parseEmoji('❤️')).toEqual({ key: '❤', react: '❤️', custom: false });
    expect(parseEmoji('1️⃣')?.key).toBe('1⃣');
    expect(parseEmoji('👨‍👩‍👧')?.custom).toBe(false);
    expect(parseEmoji('🇵🇱')?.key).toBe('🇵🇱');
  });

  it('rejects text, whitespace and empty input', () => {
    expect(parseEmoji('')).toBeNull();
    expect(parseEmoji('thumbsup')).toBeNull();
    expect(parseEmoji(':thumbsup:')).toBeNull();
    expect(parseEmoji('👍 👎')).toBeNull();
    expect(parseEmoji('👍'.repeat(20))).toBeNull();
  });
});

describe('reactionEmojiKey', () => {
  it('uses the ID of a custom emoji', () => {
    expect(reactionEmojiKey({ id: EMOJI, name: 'pog' })).toBe(EMOJI);
  });

  it('matches the key parseEmoji gives the same Unicode emoji', () => {
    for (const emoji of ['❤', '❤️', '👍', '1️⃣']) {
      expect(reactionEmojiKey({ id: null, name: emoji })).toBe(parseEmoji(emoji)?.key);
    }
  });

  it('returns null without an ID or name', () => {
    expect(reactionEmojiKey({ id: null, name: null })).toBeNull();
  });

  it('strips only variation selectors', () => {
    expect(normaliseUnicodeEmoji('☺️')).toBe('☺');
  });
});

describe('parseRoleRef', () => {
  it('parses a mention or an ID', () => {
    expect(parseRoleRef(`<@&${ROLE}>`)).toBe(ROLE);
    expect(parseRoleRef(` ${ROLE} `)).toBe(ROLE);
  });

  it('leaves names to the caller', () => {
    expect(parseRoleRef('Members')).toBeNull();
    expect(parseRoleRef(`<@${ROLE}>`)).toBeNull();
  });
});

describe('roleProblem', () => {
  const guild = { id: GUILD, ownerId: 'owner' };
  const role = (position: number, extra: object = {}) =>
    ({ id: ROLE, guild, position, managed: false, ...extra }) as any;
  const member = (id: string, position: number, manageRoles = true) =>
    ({
      id,
      permissions: { has: () => manageRoles },
      roles: { highest: { position } },
    }) as any;
  const bot = member('bot', 10);

  it('passes a role below the bot and the invoker', () => {
    expect(roleProblem(role(5), bot)).toBeNull();
    expect(roleProblem(role(5), bot, member('admin', 6))).toBeNull();
  });

  it('rejects @everyone and managed roles', () => {
    expect(roleProblem(role(0, { id: GUILD }), bot)).toBe('everyone');
    expect(roleProblem(role(5, { managed: true }), bot)).toBe('managed');
  });

  it('rejects when the bot lacks Manage Roles or ranks too low', () => {
    expect(roleProblem(role(5), member('bot', 10, false))).toBe('botPermission');
    expect(roleProblem(role(10), bot)).toBe('botHierarchy');
    expect(roleProblem(role(11), bot)).toBe('botHierarchy');
  });

  it('rejects a role at or above the invoker, except for the owner', () => {
    expect(roleProblem(role(5), bot, member('admin', 5))).toBe('invokerHierarchy');
    expect(roleProblem(role(5), bot, member('owner', 1))).toBeNull();
  });
});

describe('ReactionRoleIndex', () => {
  const row = (
    id: number,
    messageId: string,
    emojiKey: string,
    roleId: string
  ): ReactionRoleRow => ({
    id,
    guild_id: GUILD,
    channel_id: CHANNEL,
    message_id: messageId,
    emoji_key: emojiKey,
    emoji_display: emojiKey,
    role_id: roleId,
    created_by: 'admin',
    created_at: new Date(),
  });

  // Every combination the issue asks for.
  const rows = [
    row(1, 'm1', '👍', 'r1'),
    row(2, 'm1', '🎮', 'r2'), // several emoji on one message
    row(3, 'm2', '👍', 'r3'), // same emoji, another message, another role
    row(4, 'm2', '🎮', 'r1'), // same role from another message
  ];

  it('matches bindings by message and emoji', () => {
    const index = new ReactionRoleIndex();
    index.replace(rows);
    expect(index.size).toBe(4);
    expect(index.match('m1', '👍').map((r) => r.role_id)).toEqual(['r1']);
    expect(index.match('m1', '🎮').map((r) => r.role_id)).toEqual(['r2']);
    expect(index.match('m2', '👍').map((r) => r.role_id)).toEqual(['r3']);
    expect(index.match('m2', '🎮').map((r) => r.role_id)).toEqual(['r1']);
    expect(index.match('m3', '👍')).toEqual([]);
    expect(index.match('m1', '🔥')).toEqual([]);
  });

  it('lists all bindings in ID order, or those on one message', () => {
    const index = new ReactionRoleIndex();
    index.replace([...rows].reverse());
    expect(index.all().map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(index.all('m2').map((r) => r.id)).toEqual([3, 4]);
    expect(index.get(3)?.role_id).toBe('r3');
  });

  it('removes by ID, message and role', () => {
    const index = new ReactionRoleIndex();
    index.replace(rows);
    expect(index.remove(2)?.id).toBe(2);
    expect(index.remove(2)).toBeUndefined();
    expect(index.removeRoles(['r1']).map((r) => r.id)).toEqual([1, 4]);
    expect(index.removeMessages(['m2']).map((r) => r.id)).toEqual([3]);
    expect(index.size).toBe(0);
    expect(index.all()).toEqual([]);
  });

  it('does not duplicate a row added twice', () => {
    const index = new ReactionRoleIndex();
    index.add(rows[0]);
    index.add(rows[0]);
    expect(index.size).toBe(1);
  });
});

describe('KeyedQueue', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  it('runs tasks of one key in order, one at a time', async () => {
    const queue = new KeyedQueue();
    const log: string[] = [];
    const task = (name: string, delay: number) => async () => {
      log.push(`start ${name}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      log.push(`end ${name}`);
    };
    await Promise.all([
      queue.run('user', task('add', 20)),
      queue.run('user', task('remove', 1)),
    ]);
    expect(log).toEqual(['start add', 'end add', 'start remove', 'end remove']);
    expect(queue.pending).toBe(0);
  });

  it('runs different keys concurrently', async () => {
    const queue = new KeyedQueue();
    const log: string[] = [];
    let release!: () => void;
    const blocked = queue.run('a', () => new Promise<void>((r) => (release = r)));
    await queue.run('b', async () => void log.push('b'));
    expect(log).toEqual(['b']);
    release();
    await blocked;
  });

  it('keeps going after a failed task', async () => {
    const queue = new KeyedQueue();
    const failed = queue.run('user', async () => {
      throw new Error('boom');
    });
    let ran = false;
    const next = queue.run('user', async () => {
      ran = true;
    });
    await expect(failed).rejects.toThrow('boom');
    await next;
    await tick();
    expect(ran).toBe(true);
    expect(queue.pending).toBe(0);
  });
});
