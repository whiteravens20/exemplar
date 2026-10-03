import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type APIEmbedField,
  type BaseMessageOptions,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandContext, SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { withAppAvailability, getDmAccess } from './shared.js';

/** The help text for `context`, or null when they may not use the bot. */
async function helpMessage(context: CommandContext): Promise<{
  message: BaseMessageOptions;
  restricted: boolean;
  canModerate: boolean;
  isAdmin: boolean;
}> {
  const access = await getDmAccess(context);
  if (!access.isAiAllowed && !access.isAdmin) {
    return {
      message: { content: configManager.config.bot.restrictedResponse },
      restricted: true,
      canModerate: false,
      isAdmin: false,
    };
  }

  // Show only the command groups the invoker can actually use, matching each
  // command's real permission gate: moderation commands need a kick/ban/mute
  // permission; admin commands (/stats, /flushdb, /warnings <user>) need the
  // same staff check as those commands (`isAdmin` = ModerateMembers/Admin).
  const member = access.member;
  const canModerate =
    !!member &&
    member.permissions.any([
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.Administrator,
    ]);

  // Staff without an AI role get here too; the assistant and its commands
  // would refuse them, so those are left out.
  const fields: APIEmbedField[] = [];
  if (access.isAiAllowed) {
    fields.push({
      name: t('commands.help.usage.name'),
      value: t('commands.help.usage.value'),
    });
  }
  fields.push({
    name: t('commands.help.userCommands.name'),
    value: access.isAiAllowed
      ? t('commands.help.userCommands.value')
      : t('commands.help.userCommands.staffValue'),
  });

  if (canModerate) {
    fields.push({
      name: t('commands.help.moderationCommands.name'),
      value: t('commands.help.moderationCommands.value'),
    });
  }

  if (access.isAdmin) {
    fields.push({
      name: t('commands.help.adminCommands.name'),
      value: t('commands.help.adminCommands.value'),
    });
  }

  fields.push({
    name: t('commands.help.note.name'),
    value: t('commands.help.note.value'),
  });

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(t('commands.help.title'))
    .setDescription(
      access.isAiAllowed ? t('commands.help.intro') : t('commands.help.staffIntro')
    )
    .addFields(fields)
    .setTimestamp();

  return {
    message: { embeds: [embed] },
    restricted: false,
    canModerate,
    isAdmin: access.isAdmin,
  };
}

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('help')
      .setDescription(t('commands.help.description'))
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const help = await helpMessage(interaction);
    if (help.restricted) {
      await interaction.reply({ ...help.message, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply(help.message);
    logger.info('Help command executed', {
      userId: interaction.user.id,
      canModerate: help.canModerate,
      isAdmin: help.isAdmin,
    });
  },

  async reactionReply(context) {
    return (await helpMessage(context)).message;
  },
};

export default command;
