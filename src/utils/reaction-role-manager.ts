import {
  DiscordAPIError,
  RESTJSONErrorCodes,
  type Client,
  type Guild,
  type GuildMember,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js';
import logger from './logger.js';
import { t } from './i18n.js';
import configManager from '../config/config.js';
import { getConfiguredGuild } from './moderation-actions.js';
import reactionRoleRepo from '../db/repositories/reaction-role-repository.js';
import {
  Cooldown,
  KeyedQueue,
  REACTION_COMMAND_COOLDOWN_MS,
  ReactionRoleIndex,
  reactionEmojiKey,
  roleProblem,
} from './reaction-roles.js';
import type { ReactionRoleInput, ReactionRoleRow } from '../types/database.js';

export type ReactionChange = 'add' | 'remove';

/** API errors meaning a bound channel or message no longer exists. */
const GONE_CODES = new Set<unknown>([
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.UnknownMessage,
]);

function isGone(error: unknown): boolean {
  return error instanceof DiscordAPIError && GONE_CODES.has(error.code);
}

/**
 * Runtime for reaction roles (issue #24). Keeps the bindings in memory, grants
 * and revokes roles (or DMs a command's reply) on reaction events, and drops
 * bindings whose message or role has been deleted.
 *
 * Reaction events arrive as partials for uncached messages, so bindings keep
 * working after a restart without fetching every bound message first.
 */
class ReactionRoleManager {
  private readonly index = new ReactionRoleIndex();
  private readonly queue = new KeyedQueue();
  private readonly cooldown = new Cooldown(REACTION_COMMAND_COOLDOWN_MS);

  /** Load the bindings and drop those whose message or role is gone. */
  async load(client: Client): Promise<void> {
    const guild = getConfiguredGuild(client);
    if (!guild) {
      logger.warn('Reaction roles not loaded: configured server unavailable');
      return;
    }
    const rows = await reactionRoleRepo.findAll(guild.id);
    this.index.replace(rows);
    await this.prune(guild, rows);
    logger.info('Reaction roles loaded', { bindings: this.index.size });
  }

  /** Fetch every bound message once, forgetting deleted messages and roles. */
  private async prune(guild: Guild, rows: ReactionRoleRow[]): Promise<void> {
    const goneRoles = [...new Set(rows.map((row) => row.role_id))].filter(
      (roleId): roleId is string => roleId !== null && !guild.roles.cache.has(roleId)
    );
    await this.forgetRoles(goneRoles, 'role deleted while offline');

    const messages = new Map(rows.map((row) => [row.message_id, row.channel_id]));
    const goneMessages: string[] = [];
    for (const [messageId, channelId] of messages) {
      try {
        const channel = await guild.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
          goneMessages.push(messageId);
          continue;
        }
        await channel.messages.fetch(messageId);
      } catch (error) {
        if (isGone(error)) {
          goneMessages.push(messageId);
        } else {
          logger.warn('Could not verify a reaction-role message', {
            channelId,
            messageId,
            error: (error as Error).message,
          });
        }
      }
    }
    await this.forgetMessages(goneMessages, 'message deleted while offline');
  }

  bindings(messageId?: string): ReactionRoleRow[] {
    return this.index.all(messageId);
  }

  binding(id: number): ReactionRoleRow | undefined {
    return this.index.get(id);
  }

  /** Bindings a reaction with `emojiKey` on `messageId` triggers. */
  match(messageId: string, emojiKey: string): ReactionRoleRow[] {
    return this.index.match(messageId, emojiKey);
  }

  /** Persist a binding. Returns null when the exact binding already exists. */
  async bind(input: ReactionRoleInput): Promise<ReactionRoleRow | null> {
    const row = await reactionRoleRepo.create(input);
    if (row) {
      this.index.add(row);
      logger.info('Reaction role bound', {
        bindingId: row.id,
        messageId: row.message_id,
        emoji: row.emoji_display,
        roleId: row.role_id,
        by: row.created_by,
      });
    }
    return row;
  }

  /** Delete a binding by ID. Returns the deleted row, or null if unknown. */
  async unbind(id: number, by: string): Promise<ReactionRoleRow | null> {
    const row = await reactionRoleRepo.delete(id);
    this.index.remove(id);
    if (row) {
      logger.info('Reaction role unbound', {
        bindingId: row.id,
        messageId: row.message_id,
        emoji: row.emoji_display,
        roleId: row.role_id,
        by,
      });
    }
    return row;
  }

  async forgetMessages(messageIds: string[], reason: string): Promise<void> {
    const removed = this.index.removeMessages(messageIds);
    if (removed.length === 0) return;
    await reactionRoleRepo.deleteByMessages(messageIds);
    logger.info('Reaction-role bindings removed', {
      reason,
      bindingIds: removed.map((row) => row.id),
    });
  }

  async forgetRoles(roleIds: string[], reason: string): Promise<void> {
    const removed = this.index.removeRoles(roleIds);
    if (removed.length === 0) return;
    await reactionRoleRepo.deleteByRoles(roleIds);
    logger.info('Reaction-role bindings removed', {
      reason,
      bindingIds: removed.map((row) => row.id),
    });
  }

  /** Entry point for the reaction add/remove events. */
  async handleReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    change: ReactionChange
  ): Promise<void> {
    if (user.id === reaction.client.user.id) return;
    if (reaction.message.guildId !== configManager.config.discord.serverId) return;
    const emojiKey = reactionEmojiKey(reaction.emoji);
    if (!emojiKey) return;
    const messageId = reaction.message.id;
    if (this.index.match(messageId, emojiKey).length === 0) return;

    await this.queue
      .run(user.id, () =>
        this.apply(reaction.client, user.id, messageId, emojiKey, change)
      )
      .catch((error: Error) => {
        logger.error('Reaction role handling failed', {
          userId: user.id,
          messageId,
          error: error.message,
        });
      });
  }

  private async apply(
    client: Client,
    userId: string,
    messageId: string,
    emojiKey: string,
    change: ReactionChange
  ): Promise<void> {
    // Re-read the bindings: one may have been removed while this task queued.
    const bindings = this.index.match(messageId, emojiKey);
    const guild = getConfiguredGuild(client);
    if (bindings.length === 0 || !guild) return;

    // Fetched fresh, not from the cache: discord.js updates the cached member
    // only when the gateway reports a role change, which a quick add → remove
    // can outrun.
    const member = await guild.members
      .fetch({ user: userId, force: true })
      .catch(() => null);
    if (!member || member.user.bot) return;
    const bot = guild.members.me ?? (await guild.members.fetchMe());

    for (const binding of bindings) {
      if (binding.command !== null) {
        // A command binding acts on the reaction only; removing it does nothing.
        if (change === 'add') await this.runCommand(member, binding, binding.command);
      } else if (binding.role_id !== null) {
        await this.applyRole(guild, bot, member, binding, binding.role_id, change);
      }
    }
  }

  private async applyRole(
    guild: Guild,
    bot: GuildMember,
    member: GuildMember,
    binding: ReactionRoleRow,
    roleId: string,
    change: ReactionChange
  ): Promise<void> {
    const context = {
      bindingId: binding.id,
      userId: member.id,
      roleId,
      messageId: binding.message_id,
      emoji: binding.emoji_display,
    };
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      logger.warn('Reaction role skipped: role not found', context);
      return;
    }
    const problem = roleProblem(role, bot);
    if (problem) {
      logger.warn('Reaction role skipped: bot cannot manage the role', {
        ...context,
        problem,
      });
      return;
    }
    const hasRole = member.roles.cache.has(role.id);
    if (change === 'add' ? hasRole : !hasRole) return;

    try {
      if (change === 'add') {
        await member.roles.add(
          role,
          t('reactionRoles.auditGrant', { emoji: binding.emoji_display })
        );
        logger.info('Reaction role granted', context);
      } else {
        await member.roles.remove(
          role,
          t('reactionRoles.auditRevoke', { emoji: binding.emoji_display })
        );
        logger.info('Reaction role revoked', context);
      }
    } catch (error) {
      logger.error('Reaction role update failed', {
        ...context,
        change,
        error: (error as Error).message,
      });
    }
  }

  /** DM the member the reply of the bound command, at most once per cooldown. */
  private async runCommand(
    member: GuildMember,
    binding: ReactionRoleRow,
    commandName: string
  ): Promise<void> {
    const context = {
      bindingId: binding.id,
      userId: member.id,
      command: commandName,
      messageId: binding.message_id,
      emoji: binding.emoji_display,
    };
    const command = member.client.commands.get(commandName);
    if (!command?.reactionReply) {
      logger.warn('Reaction command skipped: command unavailable', context);
      return;
    }
    if (!this.cooldown.take(`${member.id}:${binding.id}`)) {
      logger.debug('Reaction command skipped: cooldown', context);
      return;
    }
    try {
      const reply = await command.reactionReply({ client: member.client, user: member.user });
      await member.send(reply);
      logger.info('Reaction command sent', context);
    } catch (error) {
      // Most often the member does not accept DMs from server members.
      logger.warn('Reaction command failed', {
        ...context,
        error: (error as Error).message,
      });
    }
  }
}

export default new ReactionRoleManager();
