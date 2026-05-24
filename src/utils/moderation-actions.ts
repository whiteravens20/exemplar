import {
  EmbedBuilder,
  ChannelType,
  type Client,
  type Guild,
  type GuildMember,
  type User,
  type TextChannel,
} from 'discord.js';
import logger from './logger.js';
import warningRepo from '../db/repositories/warning-repository.js';
import db from '../db/connection.js';
import configManager from '../config/config.js';

/**
 * Shared moderation action layer.
 *
 * These functions perform moderation actions and are deliberately
 * caller-agnostic: they take a resolved guild/target plus an `Actor`
 * descriptor, and never depend on a slash `interaction` or a `Message`.
 * Both the slash command handlers and the future AI-driven automated
 * moderation path (issue #16) call into this module.
 */

/** Who is performing the action — a human moderator or an automated source. */
export interface Actor {
  /** Discord user ID (used for the `issued_by` column on warnings). */
  id: string;
  /** Human-readable label shown in the mod-log (e.g. a tag or "AI moderation"). */
  label: string;
}

export interface ActionResult {
  success: boolean;
  /** Plain-text message — used for failures / denials. */
  content?: string;
  /** Success embed. */
  embed?: EmbedBuilder;
}

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

// ── Duration parsing ─────────────────────────────────────────────────────────

export function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ── Guild / member resolution ────────────────────────────────────────────────

/** Resolve the single configured server (`DISCORD_SERVER_ID`). */
export function getConfiguredGuild(client: Client): Guild | null {
  const serverId = configManager.config.discord.serverId;
  return client.guilds.cache.get(serverId) ?? null;
}

/** Fetch a user as a member of the given guild, or null if not a member. */
export async function resolveInvokingMember(
  guild: Guild,
  userId: string
): Promise<GuildMember | null> {
  return guild.members.fetch(userId).catch(() => null);
}

// ── Validation helpers ───────────────────────────────────────────────────────

export function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  if (target.id === moderator.guild.ownerId) return false;
  if (target.id === moderator.id) return false;
  if (target.roles.highest.position >= moderator.roles.highest.position)
    return false;
  return true;
}

/**
 * Check that `member` holds `requiredPerm` and outranks `target`.
 * Returns an error `ActionResult` on failure, or `null` when the check passes.
 */
export function checkBasePermissions(
  member: GuildMember,
  target: GuildMember,
  requiredPerm: bigint
): ActionResult | null {
  if (!member.permissions.has(requiredPerm)) {
    return {
      success: false,
      content: '❌ Nie masz wymaganych uprawnień do użycia tej komendy.',
    };
  }
  if (!canModerate(member, target)) {
    if (target.id === member.id) {
      return {
        success: false,
        content: '❌ Nie możesz wykonać tej akcji na sobie.',
      };
    }
    if (target.id === member.guild.ownerId) {
      return {
        success: false,
        content: '❌ Nie możesz wykonać tej akcji na właścicielu serwera.',
      };
    }
    return {
      success: false,
      content:
        '❌ Nie możesz wykonać tej akcji na tym użytkowniku (hierarchia ról lub uprawnienia).',
    };
  }
  return null;
}

// ── Mod-log + embeds ─────────────────────────────────────────────────────────

async function sendModLog(
  guild: Guild,
  action: string,
  target: User,
  reason: string,
  actor: Actor
): Promise<void> {
  const modLogChannelId = configManager.config.moderation.modLogChannelId;
  if (!modLogChannelId) return;

  try {
    const channel = guild.channels.cache.get(modLogChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`🔨 ${action}`)
      .addFields(
        { name: 'Użytkownik', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: actor.label, inline: true },
        { name: 'Powód', value: reason || 'Nie podano powodu' }
      )
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to send mod-log entry', {
      error: (error as Error).message,
      action,
      targetId: target.id,
    });
  }
}

export function buildModEmbed(
  action: string,
  target: User,
  reason: string,
  color: number,
  extraFields?: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`✅ ${action}`)
    .addFields(
      { name: 'Użytkownik', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Powód', value: reason || 'Nie podano powodu', inline: true }
    )
    .setTimestamp();

  if (extraFields) embed.addFields(extraFields);
  return embed;
}

/**
 * DM the moderated user with the action, reason and any extra detail
 * (e.g. duration). Returns whether the DM was delivered. Must be called
 * *before* a kick/ban — afterwards the bot shares no guild with the user.
 */
async function notifyTarget(
  user: User,
  guildName: string,
  title: string,
  color: number,
  reason: string,
  extraFields: { name: string; value: string }[] = [],
  footer?: string
): Promise<boolean> {
  if (user.bot) return false;
  try {
    const dm = await user.createDM();
    await dm.send({
      embeds: [
        {
          color,
          title,
          fields: [
            { name: 'Serwer', value: guildName },
            { name: 'Powód', value: reason || 'Nie podano powodu' },
            ...extraFields,
          ],
          ...(footer ? { footer: { text: footer } } : {}),
          timestamp: new Date().toISOString(),
        },
      ],
    });
    return true;
  } catch (error) {
    logger.warn('Could not DM moderated user', {
      userId: user.id,
      error: (error as Error).message,
    });
    return false;
  }
}

/** Field shown on the moderator-facing embed reporting DM delivery. */
function dmStatusField(dmSent: boolean): { name: string; value: string; inline: boolean } {
  return {
    name: 'DM',
    value: dmSent ? '✅ Doręczono' : '⚠️ Nie doręczono',
    inline: true,
  };
}

// ── Actions ──────────────────────────────────────────────────────────────────

export async function applyKick(
  target: GuildMember,
  reason: string,
  actor: Actor
): Promise<ActionResult> {
  if (!target.kickable) {
    return { success: false, content: '❌ Nie mogę wyrzucić tego użytkownika.' };
  }
  // DM before kicking — afterwards the bot shares no guild with the user.
  const dmSent = await notifyTarget(
    target.user,
    target.guild.name,
    '👢 Zostałeś wyrzucony z serwera',
    0xf39c12,
    reason
  );
  try {
    await target.kick(reason);
  } catch (error) {
    logger.error('Kick failed', { targetId: target.id, error: (error as Error).message });
    return {
      success: false,
      content: `❌ Nie udało się wyrzucić użytkownika: ${(error as Error).message}`,
    };
  }
  await sendModLog(target.guild, 'Kick', target.user, reason, actor);
  return {
    success: true,
    embed: buildModEmbed('Wyrzucono', target.user, reason, 0xf39c12, [
      dmStatusField(dmSent),
    ]),
  };
}

export async function applyBan(
  target: GuildMember,
  reason: string,
  actor: Actor
): Promise<ActionResult> {
  if (!target.bannable) {
    return { success: false, content: '❌ Nie mogę zbanować tego użytkownika.' };
  }
  // DM before banning — afterwards the bot shares no guild with the user.
  const dmSent = await notifyTarget(
    target.user,
    target.guild.name,
    '🚫 Zostałeś zbanowany na serwerze',
    0xe74c3c,
    reason,
    [{ name: 'Czas trwania', value: 'Permanentny' }]
  );
  try {
    await target.ban({ reason, deleteMessageDays: 0 });
  } catch (error) {
    logger.error('Ban failed', { targetId: target.id, error: (error as Error).message });
    return {
      success: false,
      content: `❌ Nie udało się zbanować użytkownika: ${(error as Error).message}`,
    };
  }
  await sendModLog(target.guild, 'Ban', target.user, reason, actor);
  return {
    success: true,
    embed: buildModEmbed('Zbanowano', target.user, reason, 0xe74c3c, [
      dmStatusField(dmSent),
    ]),
  };
}

export async function applyUnban(
  guild: Guild,
  userId: string,
  actor: Actor
): Promise<ActionResult> {
  try {
    await guild.bans.remove(userId);
    const user = await guild.client.users.fetch(userId);
    await sendModLog(guild, 'Unban', user, 'Odbanowano', actor);
    return {
      success: true,
      embed: buildModEmbed('Odbanowano', user, 'Odbanowano', 0x2ecc71),
    };
  } catch (error) {
    logger.warn('Unban failed', { userId, error: (error as Error).message });
    return {
      success: false,
      content:
        '❌ Nie udało się odbanować użytkownika. Upewnij się, że ID jest prawidłowe.',
    };
  }
}

export async function applyTimeout(
  target: GuildMember,
  durationMs: number,
  reason: string,
  actor: Actor
): Promise<ActionResult> {
  if (!target.moderatable) {
    return { success: false, content: '❌ Nie mogę wyciszyć tego użytkownika.' };
  }
  if (durationMs <= 0 || durationMs > MAX_TIMEOUT_MS) {
    return { success: false, content: '❌ Maksymalny czas wyciszenia to 28 dni.' };
  }
  const expiresUnix = Math.floor((Date.now() + durationMs) / 1000);
  const dmSent = await notifyTarget(
    target.user,
    target.guild.name,
    '🔇 Zostałeś wyciszony na serwerze',
    0x9b59b6,
    reason,
    [
      { name: 'Czas trwania', value: formatDuration(durationMs) },
      { name: 'Wygasa', value: `<t:${expiresUnix}:R>` },
    ]
  );
  try {
    await target.timeout(durationMs, reason);
  } catch (error) {
    logger.error('Timeout failed', { targetId: target.id, error: (error as Error).message });
    return {
      success: false,
      content: `❌ Nie udało się wyciszyć użytkownika: ${(error as Error).message}`,
    };
  }
  await sendModLog(target.guild, 'Mute (Timeout)', target.user, reason, actor);
  return {
    success: true,
    embed: buildModEmbed('Wyciszono', target.user, reason, 0x9b59b6, [
      { name: 'Czas', value: formatDuration(durationMs), inline: true },
      { name: 'Wygasa', value: `<t:${expiresUnix}:R>`, inline: true },
      dmStatusField(dmSent),
    ]),
  };
}

export async function applyUntimeout(
  target: GuildMember,
  actor: Actor
): Promise<ActionResult> {
  if (!target.moderatable) {
    return {
      success: false,
      content: '❌ Nie mogę wyłączyć wyciszenia tego użytkownika.',
    };
  }
  if (!target.communicationDisabledUntil) {
    return { success: false, content: '❌ Ten użytkownik nie jest obecnie wyciszony.' };
  }
  try {
    await target.timeout(null, 'Wyciszenie zdjęte przez moderatora');
  } catch (error) {
    logger.error('Untimeout failed', { targetId: target.id, error: (error as Error).message });
    return {
      success: false,
      content: `❌ Nie udało się zdjąć wyciszenia: ${(error as Error).message}`,
    };
  }
  await sendModLog(target.guild, 'Unmute', target.user, 'Wyciszenie zdjęte', actor);
  return {
    success: true,
    embed: buildModEmbed('Wyciszenie zdjęte', target.user, 'Wyciszenie zdjęte', 0x2ecc71),
  };
}

export async function applyWarn(
  guild: Guild,
  target: User,
  reason: string,
  actor: Actor
): Promise<ActionResult> {
  if (!db.isAvailable()) {
    return {
      success: false,
      content: '❌ Baza danych niedostępna. Ostrzeżenia nie mogą być zapisane.',
    };
  }
  if (target.bot) {
    return { success: false, content: '❌ Nie można ostrzec bota.' };
  }

  const dmSent = await notifyTarget(
    target,
    guild.name,
    '⚠️ Otrzymałeś ostrzeżenie',
    0xffaa00,
    reason,
    [{ name: 'Wygasa', value: 'za 30 dni' }],
    'Kontynuowanie niewłaściwego zachowania może skutkować dalszymi sankcjami'
  );

  const activeWarnings = await warningRepo.addWarning(
    target.id,
    target.username,
    reason,
    actor.id
  );

  await sendModLog(guild, 'Warn', target, reason, actor);

  return {
    success: true,
    embed: buildModEmbed('Ostrzeżenie wydane', target, reason, 0xffaa00, [
      { name: 'Aktywne ostrzeżenia', value: `${activeWarnings}`, inline: true },
      { name: 'DM', value: dmSent ? '✅ Doręczono' : '⚠️ Nie doręczono', inline: true },
    ]),
  };
}
