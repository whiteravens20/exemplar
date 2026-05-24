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
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Pokazuje statystyki użycia bota (tylko administratorzy)')
      .addIntegerOption((option) =>
        option
          .setName('days')
          .setDescription('Liczba dni do uwzględnienia (1-90, domyślnie 7)')
          .setMinValue(1)
          .setMaxValue(90)
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const access = await getDmAccess(interaction);
    if (!access.isAdmin) {
      await interaction.reply({
        content:
          '❌ Nie masz uprawnień do użycia tej komendy. Wymagane: Administrator lub Moderator.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!db.isAvailable()) {
      await interaction.reply({
        content: '❌ Baza danych niedostępna. Nie można pobrać statystyk.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const days = interaction.options.getInteger('days') ?? 7;
    const stats = await analyticsRepo.getGlobalStats(days);
    if (!stats) {
      await interaction.reply({
        content: '❌ Nie udało się pobrać statystyk. Spróbuj ponownie później.',
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
