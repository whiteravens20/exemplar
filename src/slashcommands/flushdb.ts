import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import logger from '../utils/logger.js';
import db from '../db/connection.js';
import conversationRepo from '../db/repositories/conversation-repository.js';
import analyticsRepo from '../db/repositories/analytics-repository.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('flushdb')
      .setDescription('Czyści bazę danych — konwersacje, rate limity, statystyki (admin)')
      .addBooleanOption((option) =>
        option
          .setName('confirm')
          .setDescription('Ustaw na true, aby potwierdzić tę nieodwracalną operację')
          .setRequired(true)
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
        content: '❌ Baza danych niedostępna. Nie można wykonać operacji.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.options.getBoolean('confirm', true)) {
      await interaction.reply({
        content:
          '⚠️ **UWAGA:** Ta operacja usunie wszystkie konwersacje (bot + n8n AI Agent), rate limity i statystyki.\n\nUruchom ponownie z `confirm: true`, aby potwierdzić. Użytkownicy i ostrzeżenia zostają zachowane.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const deletedCount = await conversationRepo.flushAllConversations();
    await db.query('TRUNCATE rate_limits, message_stats, command_usage');

    await analyticsRepo
      .logCommand(interaction.user.id, interaction.user.username, 'flushdb', true, true)
      .catch((err: Error) =>
        logger.error('Failed to log command', { error: err.message })
      );

    await interaction.reply({
      content: `✅ Baza danych została wyczyszczona (zachowano użytkowników i ostrzeżenia).\n📊 Usunięto **${deletedCount}** wiadomości konwersacji (bot + n8n AI Agent).`,
    });

    logger.warn('Database flushed by admin', {
      adminId: interaction.user.id,
      adminUsername: interaction.user.username,
    });
  },
};

export default command;
