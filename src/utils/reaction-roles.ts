import { PermissionFlagsBits, type GuildMember, type Role } from 'discord.js';
import type { ReactionRoleRow } from '../types/database.js';

/**
 * Reaction roles (issue #24): the pure building blocks — input parsing, role
 * checks, the in-memory binding index and the per-user task queue. The runtime
 * that ties them to Discord and the database is `reaction-role-manager.ts`.
 */

// ── Input parsing ────────────────────────────────────────────────────────────

const SNOWFLAKE = /^\d{17,20}$/;
const MESSAGE_LINK =
  /^https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})\/?$/;
// "Copy ID" on a message with Shift held copies `channelId-messageId`.
const CHANNEL_MESSAGE_PAIR = /^(\d{17,20})-(\d{17,20})$/;
const CUSTOM_EMOJI = /^<a?:\w{2,32}:(\d{17,20})>$/;
const NAME_ID_EMOJI = /^a?:?\w{2,32}:(\d{17,20})$/;
const VARIATION_SELECTOR = /️/g;
const MAX_UNICODE_EMOJI_LENGTH = 32;

export interface MessageRef {
  /** Null when the input carries no guild (a `channel-message` pair). */
  guildId: string | null;
  channelId: string;
  messageId: string;
}

/** Parse a message link or a `channelId-messageId` pair. */
export function parseMessageRef(input: string): MessageRef | null {
  const value = input.trim();
  const link = value.match(MESSAGE_LINK);
  if (link) {
    return {
      guildId: link[1] === '@me' ? null : link[1],
      channelId: link[2],
      messageId: link[3],
    };
  }
  const pair = value.match(CHANNEL_MESSAGE_PAIR);
  if (pair) return { guildId: null, channelId: pair[1], messageId: pair[2] };
  return null;
}

export interface ParsedEmoji {
  /** Lookup key stored on the binding and matched against reaction events. */
  key: string;
  /** Value passed to `message.react()`. */
  react: string;
  custom: boolean;
}

/** Strip variation selectors so `❤` and `❤️` match the same binding. */
export function normaliseUnicodeEmoji(name: string): string {
  return name.replace(VARIATION_SELECTOR, '');
}

/**
 * Parse an emoji as typed by an admin: a custom emoji (`<:name:id>`,
 * `<a:name:id>`, `name:id` or a bare ID) or a Unicode emoji. Whether Discord
 * accepts it is only known once the bot reacts with it.
 */
export function parseEmoji(input: string): ParsedEmoji | null {
  const value = input.trim();
  const custom =
    value.match(CUSTOM_EMOJI) ?? value.match(NAME_ID_EMOJI) ?? value.match(SNOWFLAKE);
  if (custom) {
    return { key: custom[1] ?? custom[0], react: value, custom: true };
  }
  if (
    value.length === 0 ||
    value.length > MAX_UNICODE_EMOJI_LENGTH ||
    /\s/.test(value) ||
    // Every Unicode emoji has a non-ASCII code point; keycaps start with ASCII.
    /^[\x20-\x7e]*$/.test(value)
  ) {
    return null;
  }
  return { key: normaliseUnicodeEmoji(value), react: value, custom: false };
}

/** Key of an emoji reported by a reaction event, matching `ParsedEmoji.key`. */
export function reactionEmojiKey(emoji: {
  id: string | null;
  name: string | null;
}): string | null {
  if (emoji.id) return emoji.id;
  return emoji.name ? normaliseUnicodeEmoji(emoji.name) : null;
}

/** Parse a role mention (`<@&id>`) or ID. Names are resolved by the caller. */
export function parseRoleRef(input: string): string | null {
  const value = input.trim();
  const mention = value.match(/^<@&(\d{17,20})>$/);
  if (mention) return mention[1];
  return SNOWFLAKE.test(value) ? value : null;
}

// ── Role checks ──────────────────────────────────────────────────────────────

export type RoleProblem =
  | 'everyone'
  | 'managed'
  | 'botPermission'
  | 'botHierarchy'
  | 'invokerHierarchy';

/**
 * Why `bot` cannot hand out `role` — or, when `invoker` is given, why that
 * admin may not bind it (only roles below their own highest role, as Discord
 * itself enforces for role management). Null when the role is assignable.
 */
export function roleProblem(
  role: Role,
  bot: GuildMember,
  invoker?: GuildMember
): RoleProblem | null {
  if (role.id === role.guild.id) return 'everyone';
  if (role.managed) return 'managed';
  if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) return 'botPermission';
  if (bot.roles.highest.position <= role.position) return 'botHierarchy';
  if (
    invoker &&
    invoker.id !== role.guild.ownerId &&
    invoker.roles.highest.position <= role.position
  ) {
    return 'invokerHierarchy';
  }
  return null;
}

// ── Binding index ────────────────────────────────────────────────────────────

/**
 * In-memory copy of the bindings, keyed by message, so a reaction on an
 * unbound message is dismissed without touching the database or the API.
 */
export class ReactionRoleIndex {
  private byMessage = new Map<string, ReactionRoleRow[]>();

  get size(): number {
    let size = 0;
    for (const rows of this.byMessage.values()) size += rows.length;
    return size;
  }

  replace(rows: ReactionRoleRow[]): void {
    this.byMessage.clear();
    for (const row of rows) this.add(row);
  }

  add(row: ReactionRoleRow): void {
    const rows = this.byMessage.get(row.message_id) ?? [];
    this.byMessage.set(row.message_id, [...rows.filter((r) => r.id !== row.id), row]);
  }

  get(id: number): ReactionRoleRow | undefined {
    return this.all().find((row) => row.id === id);
  }

  /** Every binding, in ID order, optionally only those on one message. */
  all(messageId?: string): ReactionRoleRow[] {
    const rows =
      messageId === undefined
        ? [...this.byMessage.values()].flat()
        : (this.byMessage.get(messageId) ?? []);
    return [...rows].sort((a, b) => a.id - b.id);
  }

  /** Bindings a reaction with `emojiKey` on `messageId` triggers. */
  match(messageId: string, emojiKey: string): ReactionRoleRow[] {
    return (this.byMessage.get(messageId) ?? []).filter(
      (row) => row.emoji_key === emojiKey
    );
  }

  remove(id: number): ReactionRoleRow | undefined {
    const row = this.get(id);
    if (row) this.removeWhere((r) => r.id === id);
    return row;
  }

  /** Remove the bindings on the given messages and return them. */
  removeMessages(messageIds: string[]): ReactionRoleRow[] {
    const ids = new Set(messageIds);
    return this.removeWhere((row) => ids.has(row.message_id));
  }

  /** Remove the bindings granting the given roles and return them. */
  removeRoles(roleIds: string[]): ReactionRoleRow[] {
    const ids = new Set(roleIds);
    return this.removeWhere((row) => ids.has(row.role_id));
  }

  private removeWhere(predicate: (row: ReactionRoleRow) => boolean): ReactionRoleRow[] {
    const removed: ReactionRoleRow[] = [];
    for (const [messageId, rows] of this.byMessage) {
      const kept = rows.filter((row) => !predicate(row));
      removed.push(...rows.filter(predicate));
      if (kept.length === 0) this.byMessage.delete(messageId);
      else this.byMessage.set(messageId, kept);
    }
    return removed;
  }
}

// ── Per-key serialisation ────────────────────────────────────────────────────

/**
 * Runs tasks one at a time per key, in submission order. Reaction roles key it
 * by user, so a quick add → remove → add of one member's reactions lands in
 * the order the events arrived instead of racing each other's role updates.
 */
export class KeyedQueue {
  private tails = new Map<string, Promise<void>>();

  get pending(): number {
    return this.tails.size;
  }

  run(key: string, task: () => Promise<void>): Promise<void> {
    const result = (this.tails.get(key) ?? Promise.resolve()).then(task);
    const tail: Promise<void> = result
      .catch(() => undefined)
      .then(() => {
        if (this.tails.get(key) === tail) this.tails.delete(key);
      });
    this.tails.set(key, tail);
    return result;
  }
}
