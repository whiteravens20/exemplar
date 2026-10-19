import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type TextChannel,
  type User,
} from 'discord.js';
import configManager from '../config/config.js';
import moderationLogRepo from '../db/repositories/moderation-log-repository.js';
import logger from './logger.js';
import { t } from './i18n.js';
import type { BotRoleProblem } from './reaction-roles.js';
import type { ReactionChange } from './reaction-role-manager.js';
import type {
  ModerationActorType,
  ModerationEventType,
  ModerationSeverity,
  ReactionRoleRow,
} from '../types/database.js';

/**
 * Entries for the server's staff about what happened besides moderation by the
 * bot: roles handed out through reactions, changes to the reaction-role
 * bindings and a cleared database. Each one goes to the dashboard's event log
 * and, when MOD_LOG_CHANNEL_ID is set, to the mod-log channel, as moderation
 * does.
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

interface Entry {
  guild: Guild;
  eventType: ModerationEventType;
  severity: ModerationSeverity;
  actorType: ModerationActorType;
  actor?: User;
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
};

async function write(entry: Entry): Promise<void> {
  const actorLabel = entry.actorLabel ?? entry.actor?.tag ?? null;
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

function userValue(user: User): string {
  return `${user.tag} (${user.id})`;
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
