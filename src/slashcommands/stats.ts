import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import logger from '../utils/logger.js';
import db from '../db/connection.js';
import analyticsRepo from '../db/repositories/analytics-repository.js';
import { formatStatsEmbed, type StatsData } from '../utils/stats-embed.js';
import { t } from '../utils/i18n.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription(t('commands.stats.description'))
      .addIntegerOption((option) =>
        option
          .setName('days')
          .setDescription(t('commands.stats.options.days'))
          .setMinValue(1)
          .setMaxValue(90)
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const access = await getDmAccess(interaction);
    if (!access.isAdmin) {
      await interaction.reply({
        content: t('errors.adminOnly'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!db.isAvailable()) {
      await interaction.reply({
        content: t('commands.stats.databaseUnavailable'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const days = interaction.options.getInteger('days') ?? 7;
    const stats = await analyticsRepo.getGlobalStats(days);
    if (!stats) {
      await interaction.reply({
        content: t('commands.stats.fetchFailed'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await analyticsRepo
      .logCommand(interaction.user.id, interaction.user.username, 'stats', true, true)
      .catch((err: Error) =>
        logger.error('Failed to log command', { error: err.message })
      );

    await interaction.reply({
      embeds: [formatStatsEmbed(stats as StatsData, days)],
    });
    logger.info('Admin viewed stats', { adminId: interaction.user.id, days });
  },
};

export default command;
