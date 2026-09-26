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
import { t } from '../utils/i18n.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('flushdb')
      .setDescription(t('commands.flushdb.description'))
      .addBooleanOption((option) =>
        option
          .setName('confirm')
          .setDescription(t('commands.flushdb.options.confirm'))
          .setRequired(true)
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
        content: t('commands.flushdb.databaseUnavailable'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.options.getBoolean('confirm', true)) {
      await interaction.reply({
        content: t('commands.flushdb.confirmPrompt'),
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
      content: t('commands.flushdb.done', { count: deletedCount }),
    });

    logger.warn('Database flushed by admin', {
      adminId: interaction.user.id,
      adminUsername: interaction.user.username,
    });
  },
};

export default command;
