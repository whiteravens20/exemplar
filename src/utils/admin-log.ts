import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
  type TextChannel,
  type User,
} from 'discord.js';
import configManager from '../config/config.js';
import moderationLogRepo from '../db/repositories/moderation-log-repository.js';
import logger from './logger.js';
import { t } from './i18n.js';
import type { BotRoleProblem } from './reaction-roles.js';
import type { ReactionChange } from './reaction-role-manager.js';
import type { Departure } from './member-departure.js';
import type {
  ModerationActorType,
  ModerationEventType,
  ModerationSeverity,
  ReactionRoleRow,
} from '../types/database.js';

/**
 * Entries for the server's staff about what happened besides moderation by the
 * bot: roles handed out through reactions, changes to the reaction-role
 * bindings, a cleared database and members who left. Each one goes to the
 * dashboard's event log and, when MOD_LOG_CHANNEL_ID is set, to the mod-log
 * channel, as moderation does.
 */

/** Why bindings were removed without anyone running /reactionrole remove. */
export type ForgetCause =
  | 'messageDeleted'
  | 'roleDeleted'
  | 'messageDeletedOffline'
  | 'roleDeletedOffline';

/** Why a reaction role could not be granted or removed. */
export type RoleFailure =
  | { kind: 'roleMissing' }
  | { kind: 'problem'; problem: BotRoleProblem }
  | { kind: 'discord'; error: string };

/** Who did something, as the log names them; a partial user may lack a tag. */
interface Who {
  id: string;
  tag: string | null;
}

interface Entry {
  guild: Guild;
  eventType: ModerationEventType;
  severity: ModerationSeverity;
  actorType: ModerationActorType;
  actor?: Who | null;
  /** Shown when there is no actor, or in place of its tag. */
  actorLabel?: string;
  target?: User;
  action: string;
  reason: string;
  metadata: Record<string, unknown>;
  embed: EmbedBuilder;
}

const COLOR = {
  grant: 0x2ecc71,
  revoke: 0x95a5a6,
  failure: 0xe67e22,
  binding: 0x3498db,
  flush: 0xe74c3c,
  left: 0x95a5a6,
  removed: 0xe74c3c,
};

async function write(entry: Entry): Promise<void> {
  const actorLabel = entry.actorLabel ?? entry.actor?.tag ?? entry.actor?.id ?? null;
  await moderationLogRepo.record({
    guildId: entry.guild.id,
    eventType: entry.eventType,
    severity: entry.severity,
    actorType: entry.actorType,
    actorId: entry.actor?.id ?? null,
    actorLabel,
    targetUserId: entry.target?.id ?? null,
    targetUsername: entry.target?.tag ?? null,
    action: entry.action,
    reason: entry.reason,
    metadata: entry.metadata,
  });
  await postToModLog(entry.guild, entry.embed.setTimestamp(), entry.eventType);
}

/** Send an embed to the mod-log channel, when one is configured. */
async function postToModLog(guild: Guild, embed: EmbedBuilder, what: string): Promise<void> {
  const channelId = configManager.config.moderation.modLogChannelId;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  try {
    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to send mod-log entry', {
      error: (error as Error).message,
      entry: what,
    });
  }
}

function messageLink(row: ReactionRoleRow): string {
  return `https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id}`;
}

/** Role mentions that fit in one embed field, whole ones only. */
function mentionList(roleIds: string[]): string {
  let out = '';
  for (const id of roleIds) {
    const next = out ? `${out} <@&${id}>` : `<@&${id}>`;
    if (next.length > 1020) return `${out} …`;
    out = next;
  }
  return out;
}

function userValue(user: Who): string {
  return `${user.tag ?? user.id} (${user.id})`;
}

/** What a binding gives, as the mod-log shows it: a role mention or a command. */
function bindingTarget(guild: Guild, row: ReactionRoleRow): string {
  if (row.command !== null) return `/${row.command}`;
  if (row.role_id !== null && guild.roles.cache.has(row.role_id)) return `<@&${row.role_id}>`;
  return `@${t('commands.reactionrole.deletedRole')}`;
}

/** The same as plain text, for the dashboard, which shows a mention as written. */
function bindingTargetText(guild: Guild, row: ReactionRoleRow): string {
  if (row.command !== null) return `/${row.command}`;
  const role = row.role_id !== null ? guild.roles.cache.get(row.role_id) : undefined;
  return `@${role?.name ?? t('commands.reactionrole.deletedRole')}`;
}

function bindingMetadata(row: ReactionRoleRow): Record<string, unknown> {
  return {
    bindingId: row.id,
    emoji: row.emoji_display,
    roleId: row.role_id,
    command: row.command,
    channelId: row.channel_id,
    messageId: row.message_id,
  };
}

/** A member got or lost a role by reacting. */
export async function logReactionRole(
  guild: Guild,
  member: GuildMember,
  row: ReactionRoleRow,
  roleId: string,
  change: ReactionChange
): Promise<void> {
  const grant = change === 'add';
  const roleName = guild.roles.cache.get(roleId)?.name ?? roleId;
  await write({
    guild,
    eventType: grant ? 'role_grant' : 'role_revoke',
    severity: 'info',
    actorType: 'system',
    actorLabel: t('reactionRoles.log.actor'),
    target: member.user,
    action: grant ? 'grant' : 'revoke',
    reason: t(grant ? 'reactionRoles.auditGrant' : 'reactionRoles.auditRevoke', {
      emoji: row.emoji_display,
    }),
    metadata: { ...bindingMetadata(row), roleName },
    embed: new EmbedBuilder()
      .setColor(grant ? COLOR.grant : COLOR.revoke)
      .setTitle(`🎭 ${t(grant ? 'reactionRoles.log.grantedTitle' : 'reactionRoles.log.revokedTitle')}`)
      .addFields(
        { name: t('moderation.fields.user'), value: userValue(member.user), inline: true },
        { name: t('reactionRoles.log.fields.role'), value: `<@&${roleId}>`, inline: true },
        { name: t('reactionRoles.log.fields.reaction'), value: `${row.emoji_display} ${messageLink(row)}` }
      ),
  });
}

function failureText(failure: RoleFailure): string {
  switch (failure.kind) {
    case 'roleMissing':
      return t('reactionRoles.log.problems.roleMissing');
    case 'problem':
      return t(`reactionRoles.log.problems.${failure.problem}`);
    case 'discord':
      return t('reactionRoles.log.problems.discord', { error: failure.error });
  }
}

/** A reaction should have granted or removed a role and could not. */
export async function logReactionRoleFailure(
  guild: Guild,
  member: GuildMember,
  row: ReactionRoleRow,
  roleId: string,
  change: ReactionChange,
  failure: RoleFailure
): Promise<void> {
  const grant = change === 'add';
  const problem = failureText(failure);
  await write({
    guild,
    eventType: 'role_failed',
    severity: 'medium',
    actorType: 'system',
    actorLabel: t('reactionRoles.log.actor'),
    target: member.user,
    action: grant ? 'grant' : 'revoke',
    reason: problem,
    metadata: bindingMetadata(row),
    embed: new EmbedBuilder()
      .setColor(COLOR.failure)
      .setTitle(
        `⚠️ ${t(grant ? 'reactionRoles.log.grantFailedTitle' : 'reactionRoles.log.revokeFailedTitle')}`
      )
      .addFields(
        { name: t('moderation.fields.user'), value: userValue(member.user), inline: true },
        {
          name: t('reactionRoles.log.fields.role'),
          value: failure.kind === 'roleMissing' ? roleId : `<@&${roleId}>`,
          inline: true,
        },
        { name: t('reactionRoles.log.fields.reaction'), value: `${row.emoji_display} ${messageLink(row)}` },
        { name: t('moderation.fields.problem'), value: problem.slice(0, 1024) }
      ),
  });
}

/** A member of staff added or removed a binding with /reactionrole. */
export async function logBindingChange(
  guild: Guild,
  row: ReactionRoleRow,
  actor: User,
  change: ReactionChange
): Promise<void> {
  const added = change === 'add';
  const target = bindingTarget(guild, row);
  await write({
    guild,
    eventType: 'reaction_role',
    severity: 'low',
    actorType: 'human',
    actor,
    action: added ? 'bind' : 'unbind',
    reason: `#${row.id}: ${row.emoji_display} → ${bindingTargetText(guild, row)}`,
    metadata: bindingMetadata(row),
    embed: new EmbedBuilder()
      .setColor(COLOR.binding)
      .setTitle(`🎭 ${t(added ? 'reactionRoles.log.boundTitle' : 'reactionRoles.log.unboundTitle')}`)
      .addFields(
        { name: t('reactionRoles.log.fields.binding'), value: `#${row.id}`, inline: true },
        { name: t('moderation.fields.moderator'), value: userValue(actor), inline: true },
        { name: t('reactionRoles.log.fields.gives'), value: target, inline: true },
        { name: t('reactionRoles.log.fields.reaction'), value: `${row.emoji_display} ${messageLink(row)}` }
      ),
  });
}

/** Bindings dropped because their message or role is gone. */
export async function logBindingsForgotten(
  guild: Guild,
  rows: ReactionRoleRow[],
  cause: ForgetCause
): Promise<void> {
  if (rows.length === 0) return;
  const reason = t(`reactionRoles.log.forgetCause.${cause}`);
  const lines = rows.map(
    (row) => `#${row.id}: ${row.emoji_display} → ${bindingTarget(guild, row)}`
  );
  let list = lines.join('\n');
  if (list.length > 1024) list = `${list.slice(0, 1020)}\n…`;
  await write({
    guild,
    eventType: 'reaction_role',
    severity: 'low',
    actorType: 'system',
    actorLabel: t('reactionRoles.log.actor'),
    action: 'forget',
    reason,
    metadata: { cause, bindings: rows.map(bindingMetadata) },
    embed: new EmbedBuilder()
      .setColor(COLOR.revoke)
      .setTitle(`🗑️ ${t('reactionRoles.log.forgottenTitle')}`)
      .addFields(
        { name: t('reactionRoles.log.fields.bindings'), value: list },
        { name: t('moderation.fields.reason'), value: reason }
      ),
  });
}

/** An admin cleared the bot's data with /flushdb. */
export async function logDatabaseFlush(
  guild: Guild,
  actor: User,
  conversationMessages: number
): Promise<void> {
  const reason = t('commands.flushdb.logDeleted', { count: conversationMessages });
  await write({
    guild,
    eventType: 'data_flush',
    severity: 'high',
    actorType: 'human',
    actor,
    action: 'flush',
    reason,
    metadata: { conversationMessages },
    embed: new EmbedBuilder()
      .setColor(COLOR.flush)
      .setTitle(`🧹 ${t('commands.flushdb.logTitle')}`)
      .addFields(
        { name: t('moderation.fields.moderator'), value: userValue(actor) },
        { name: t('commands.flushdb.logDeletedField'), value: reason }
      ),
  });
}

function departureText(departure: Exclude<Departure, { kind: 'byBot' }>): string {
  switch (departure.kind) {
    case 'left':
      return t('memberLeave.left');
    case 'kicked':
    case 'banned': {
      const moderator = departure.executor?.tag ?? t('memberLeave.unknownModerator');
      return departure.reason
        ? t(`memberLeave.${departure.kind}Reason`, { moderator, reason: departure.reason })
        : t(`memberLeave.${departure.kind}`, { moderator });
    }
    case 'unknown':
      return t('memberLeave.unknown', { error: departure.error });
  }
}

/**
 * A member left the server, on their own or removed by someone other than the
 * bot (the bot logs its own kicks and bans as moderation).
 */
export async function logMemberLeave(
  guild: Guild,
  member: GuildMember | PartialGuildMember,
  departure: Exclude<Departure, { kind: 'byBot' }>
): Promise<void> {
  const cause = departureText(departure);
  const removed = departure.kind === 'kicked' || departure.kind === 'banned';
  // A member the bot had not cached arrives without join date or roles.
  const roles = member.partial
    ? null
    : [...member.roles.cache.values()].filter((role) => role.id !== guild.id);
  const joinedAt = member.joinedTimestamp;
  await write({
    guild,
    eventType: 'member_leave',
    severity: removed ? 'medium' : departure.kind === 'left' ? 'info' : 'low',
    actorType: departure.kind === 'unknown' ? 'system' : 'human',
    actor: removed ? departure.executor : departure.kind === 'left' ? member.user : null,
    actorLabel: removed && !departure.executor ? t('memberLeave.unknownModerator') : undefined,
    target: member.user,
    action: { left: 'left', kicked: 'kick', banned: 'ban', unknown: 'unknown' }[departure.kind],
    reason: cause,
    metadata: {
      joinedAt: joinedAt ? new Date(joinedAt).toISOString() : null,
      roles: roles?.map((role) => ({ id: role.id, name: role.name })) ?? null,
    },
    embed: new EmbedBuilder()
      .setColor(removed ? COLOR.removed : departure.kind === 'left' ? COLOR.left : COLOR.failure)
      .setTitle(`📤 ${t('memberLeave.title')}`)
      .addFields(
        { name: t('moderation.fields.user'), value: userValue(member.user), inline: true },
        {
          name: t('memberLeave.fields.joined'),
          value: joinedAt ? `<t:${Math.floor(joinedAt / 1000)}:R>` : t('memberLeave.notKnown'),
          inline: true,
        },
        { name: t('memberLeave.fields.cause'), value: cause.slice(0, 1024) },
        {
          name: t('memberLeave.fields.roles'),
          value:
            roles === null
              ? t('memberLeave.notKnown')
              : roles.length === 0
                ? t('memberLeave.noRoles')
                : mentionList(roles.map((role) => role.id)),
        }
      ),
  });
}
