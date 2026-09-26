import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type APIEmbedField,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('help')
      .setDescription(t('commands.help.description'))
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const access = await getDmAccess(interaction);
    if (!access.isAiAllowed && !access.isAdmin) {
      await interaction.reply({
        content: configManager.config.bot.restrictedResponse,
        flags: MessageFlags.Ephemeral,
      });
      return;
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

    const fields: APIEmbedField[] = [
      {
        name: t('commands.help.usage.name'),
        value: t('commands.help.usage.value'),
      },
      {
        name: t('commands.help.userCommands.name'),
        value: t('commands.help.userCommands.value'),
      },
    ];

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
      .setDescription(t('commands.help.intro'))
      .addFields(fields)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    logger.info('Help command executed', {
      userId: interaction.user.id,
      canModerate,
      isAdmin: access.isAdmin,
    });
  },
};

export default command;
