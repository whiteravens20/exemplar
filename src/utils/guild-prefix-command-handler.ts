import {
  EmbedBuilder,
  type Message,
  type GuildMember,
  type User,
  type TextChannel,
  ChannelType,
} from 'discord.js';
import logger from './logger.js';
import { isModeratorOrAdmin } from './permissions.js';
import warningRepo from '../db/repositories/warning-repository.js';
import db from '../db/connection.js';
import configManager from '../config/config.js';

interface CommandResult {
  success: boolean;
  content?: string;
  embed?: EmbedBuilder;
}

// ── Duration parsing ─────────────────────────────────────────────────────────

function parseDuration(input: string): number | null {
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

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ── Validation helpers ─────────────────────────────────────────────────────

function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  if (target.id === moderator.guild.ownerId) return false;
  if (target.id === moderator.id) return false;
  if (target.roles.highest.position >= moderator.roles.highest.position)
    return false;
  return true;
}

function checkBasePermissions(
  member: GuildMember,
  target: GuildMember,
  requiredPerm: bigint
): CommandResult | null {
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

function parseTargetUser(
  message: Message,
  args: string[]
): { user: User; member: GuildMember } | null {
  if (!message.guild) return null;

  let targetId: string | null = null;

  const mentionMatch = args[0]?.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    targetId = mentionMatch[1];
  } else if (/^\d+$/.test(args[0] || '')) {
    targetId = args[0];
  }

  if (!targetId) return null;

  const member = message.guild.members.cache.get(targetId);
  if (!member) return null;

  return { user: member.user, member };
}

// ── Mod-log helper ─────────────────────────────────────────────────────────

async function sendModLog(
  message: Message,
  action: string,
  target: User,
  reason: string,
  moderator: User
): Promise<void> {
  const modLogChannelId = configManager.config.moderation.modLogChannelId;
  if (!modLogChannelId || !message.guild) return;

  try {
    const channel = message.guild.channels.cache.get(modLogChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`🔨 ${action}`)
      .addFields(
        { name: 'Użytkownik', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
        { name: 'Kanał', value: `<#${message.channel.id}>`, inline: true },
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

// ── Standardized embed builder ─────────────────────────────────────────────

function buildModEmbed(
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

  if (extraFields) {
    embed.addFields(extraFields);
  }

  return embed;
}

// ── Command handlers ───────────────────────────────────────────────────────

async function handleKick(message: Message, args: string[]): Promise<CommandResult> {
  if (!message.guild || !message.member) {
    return { success: false, content: '❌ Ta komenda działa tylko na serwerze.' };
  }

  const parsed = parseTargetUser(message, args);
  if (!parsed) {
    return {
      success: false,
      content:
        '❌ **Użycie:** `!kick <@user> [powód]`\n**Przykład:** `!kick @JanKowalski Spam`',
    };
  }

  const { user, member: targetMember } = parsed;
  const reason = args.slice(1).join(' ') || 'Nie podano powodu';

  const permCheck = checkBasePermissions(message.member, targetMember, 'KickMembers');
  if (permCheck) return permCheck;

  if (!targetMember.kickable) {
    return { success: false, content: '❌ Nie mogę wyrzucić tego użytkownika.' };
  }

  await targetMember.kick(reason);
  await sendModLog(message, 'Kick', user, reason, message.author);

  return {
    success: true,
    embed: buildModEmbed('Wyrzucono', user, reason, 0xf39c12),
  };
}

async function handleBan(message: Message, args: string[]): Promise<CommandResult> {
  if (!message.guild || !message.member) {
    return { success: false, content: '❌ Ta komenda działa tylko na serwerze.' };
  }

  const parsed = parseTargetUser(message, args);
  if (!parsed) {
    return {
      success: false,
      content:
        '❌ **Użycie:** `!ban <@user> [powód]`\n**Przykład:** `!ban @JanKowalski Spam`',
    };
  }

  const { user, member: targetMember } = parsed;
  const reason = args.slice(1).join(' ') || 'Nie podano powodu';

  const permCheck = checkBasePermissions(message.member, targetMember, 'BanMembers');
  if (permCheck) return permCheck;

  if (!targetMember.bannable) {
    return { success: false, content: '❌ Nie mogę zbanować tego użytkownika.' };
  }

  await targetMember.ban({ reason, deleteMessageDays: 0 });
  await sendModLog(message, 'Ban', user, reason, message.author);

  return {
    success: true,
    embed: buildModEmbed('Zbanowano', user, reason, 0xe74c3c),
  };
}

async function handleUnban(message: Message, args: string[]): Promise<CommandResult> {
  if (!message.guild || !message.member) {
    return { success: false, content: '❌ Ta komenda działa tylko na serwerze.' };
  }

  if (!message.member.permissions.has('BanMembers')) {
    return {
      success: false,
      content: '❌ Nie masz wymaganych uprawnień do użycia tej komendy.',
    };
  }

  let targetId: string | null = null;
  const mentionMatch = args[0]?.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    targetId = mentionMatch[1];
  } else if (/^\d+$/.test(args[0] || '')) {
    targetId = args[0];
  }

  if (!targetId) {
    return {
      success: false,
      content: '❌ **Użycie:** `!unban <userID>`\n**Przykład:** `!unban 123456789012345678`',
    };
  }

  try {
    await message.guild.bans.remove(targetId);
    const user = await message.client.users.fetch(targetId);
    await sendModLog(message, 'Unban', user, 'Odbanowano', message.author);
    return {
      success: true,
      embed: buildModEmbed('Odbanowano', user, 'Odbanowano', 0x2ecc71),
    };
  } catch (error) {
    return {
      success: false,
      content: '❌ Nie udało się odbanować użytkownika. Upewnij się, że ID jest prawidłowe.',
    };
  }
}

async function handleWarn(message: Message, args: string[]): Promise<CommandResult> {
  if (!message.guild || !message.member) {
    return { success: false, content: '❌ Ta komenda działa tylko na serwerze.' };
  }

  if (!db.isAvailable()) {
    return {
      success: false,
      content: '❌ Baza danych niedostępna. Ostrzeżenia nie mogą być zapisane.',
    };
  }

  const parsed = parseTargetUser(message, args);
  if (!parsed) {
    return {
      success: false,
      content:
        '❌ **Użycie:** `!warn <@user> [powód]`\n**Przykład:** `!warn @JanKowalski Spam`',
    };
  }

  const { user, member: targetMember } = parsed;
  const reason = args.slice(1).join(' ') || 'Nie podano powodu';

  const permCheck = checkBasePermissions(message.member, targetMember, 'ModerateMembers');
  if (permCheck) return permCheck;

  if (user.bot) {
    return { success: false, content: '❌ Nie można ostrzec bota.' };
  }

  let dmSent = false;
  try {
    const dm = await user.createDM();
    await dm.send({
      embeds: [
        {
          color: 0xffaa00,
          title: '⚠️ Ostrzeżenie',
          description: 'Otrzymałeś ostrzeżenie od moderacji',
          fields: [{ name: 'Powód', value: reason }],
          footer: {
            text: 'Kontynuowanie niewłaściwego zachowania może skutkować dalszymi sankcjami',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
    dmSent = true;
  } catch (dmError) {
    logger.warn('Could not send DM to warned user', {
      userId: user.id,
      error: (dmError as Error).message,
    });
  }

  const activeWarnings = await warningRepo.addWarning(
    user.id,
    user.username,
    reason,
    message.author.id
  );

  await sendModLog(message, 'Warn', user, reason, message.author);

  const embed = buildModEmbed('Ostrzeżenie wydane', user, reason, 0xffaa00, [
    { name: 'Aktywne ostrzeżenia', value: `${activeWarnings}`, inline: true },
    { name: 'DM', value: dmSent ? '✅ Doręczono' : '⚠️ Nie doręczono', inline: true },
  ]);

  return { success: true, embed };
}

async function handleMute(message: Message, args: string[]): Promise<CommandResult> {
  if (!message.guild || !message.member) {
    return { success: false, content: '❌ Ta komenda działa tylko na serwerze.' };
  }

  const parsed = parseTargetUser(message, args);
  if (!parsed) {
    return {
      success: false,
      content:
        '❌ **Użycie:** `!mute <@user> <czas> [powód]`\n**Przykład:** `!mute @JanKowalski 10m Spam`',
    };
  }

  const { user, member: targetMember } = parsed;

  const permCheck = checkBasePermissions(message.member, targetMember, 'ModerateMembers');
  if (permCheck) return permCheck;

  if (!targetMember.moderatable) {
    return { success: false, content: '❌ Nie mogę wyciszyć tego użytkownika.' };
  }

  const durationArg = args[1];
  if (!durationArg) {
    return {
      success: false,
      content:
        '❌ Podaj czas wyciszenia. Format: `10m`, `1h`, `1d`\n**Przykład:** `!mute @JanKowalski 10m Spam`',
    };
  }

  const durationMs = parseDuration(durationArg);
  if (!durationMs) {
    return {
      success: false,
      content:
        '❌ Nieprawidłowy format czasu. Użyj: `10s`, `10m`, `1h`, `1d`',
    };
  }

  const reason = args.slice(2).join(' ') || 'Nie podano powodu';

  const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
  if (durationMs > MAX_TIMEOUT_MS) {
    return {
      success: false,
      content: '❌ Maksymalny czas wyciszenia to 28 dni.',
    };
  }

  await targetMember.timeout(durationMs, reason);
  await sendModLog(message, 'Mute (Timeout)', user, reason, message.author);

  return {
    success: true,
    embed: buildModEmbed('Wyciszono', user, reason, 0x9b59b6, [
      { name: 'Czas', value: formatDuration(durationMs), inline: true },
      { name: 'Wygasa', value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
    ]),
  };
}

async function handleUnmute(message: Message, args: string[]): Promise<CommandResult> {
  if (!message.guild || !message.member) {
    return { success: false, content: '❌ Ta komenda działa tylko na serwerze.' };
  }

  const parsed = parseTargetUser(message, args);
  if (!parsed) {
    return {
      success: false,
      content:
        '❌ **Użycie:** `!unmute <@user>`\n**Przykład:** `!unmute @JanKowalski`',
    };
  }

  const { user, member: targetMember } = parsed;

  const permCheck = checkBasePermissions(message.member, targetMember, 'ModerateMembers');
  if (permCheck) return permCheck;

  if (!targetMember.moderatable) {
    return { success: false, content: '❌ Nie mogę wyłączyć wyciszenia tego użytkownika.' };
  }

  if (!targetMember.communicationDisabledUntil) {
    return { success: false, content: '❌ Ten użytkownik nie jest obecnie wyciszony.' };
  }

  await targetMember.timeout(null, 'Wyciszenie zdjęte przez moderatora');
  await sendModLog(message, 'Unmute', user, 'Wyciszenie zdjęte', message.author);

  return {
    success: true,
    embed: buildModEmbed('Wyciszenie zdjęte', user, 'Wyciszenie zdjęte', 0x2ecc71),
  };
}

// ── Router ─────────────────────────────────────────────────────────────────

const COMMAND_MAP: Record<string, (message: Message, args: string[]) => Promise<CommandResult>> = {
  kick: handleKick,
  ban: handleBan,
  unban: handleUnban,
  warn: handleWarn,
  mute: handleMute,
  unmute: handleUnmute,
};

async function handleGuildPrefixCommand(message: Message): Promise<void> {
  const content = message.content.trim();
  const prefix = configManager.config.bot.prefix;

  if (!content.startsWith(prefix)) return;

  const withoutPrefix = content.slice(prefix.length).trim();
  const parts = withoutPrefix.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  logger.info('Guild prefix command received', {
    userId: message.author.id,
    command,
    args,
    guildId: message.guild?.id,
    channelId: message.channel.id,
  });

  const handler = COMMAND_MAP[command];
  if (!handler) {
    return;
  }

  if (!message.member) {
    await message.reply({
      content: '❌ Nie można zweryfikować uprawnień.',
    });
    return;
  }

  if (!isModeratorOrAdmin(message.member)) {
    await message.reply({
      content:
        '❌ Nie masz uprawnień do użycia tej komendy. Wymagane: Administrator lub Moderator.',
    });
    return;
  }

  try {
    const result = await handler(message, args);

    if (result.embed) {
      await message.reply({ embeds: [result.embed] });
    } else if (result.content) {
      await message.reply({ content: result.content });
    }

    if (result.success) {
      logger.info('Guild prefix command executed', {
        command,
        userId: message.author.id,
        guildId: message.guild?.id,
      });
    } else {
      logger.warn('Guild prefix command failed', {
        command,
        userId: message.author.id,
        reason: result.content,
      });
    }
  } catch (error) {
    logger.error('Error executing guild prefix command', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      command,
      userId: message.author.id,
    });

    await message.reply({
      content: '❌ Wystąpił błąd podczas wykonywania komendy. Sprawdź logi.',
    });
  }
}

export { handleGuildPrefixCommand };

// ── Test exports ───────────────────────────────────────────────────────────
export { parseDuration, formatDuration, canModerate, parseTargetUser, checkBasePermissions };
