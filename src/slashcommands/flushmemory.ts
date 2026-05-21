import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import conversationRepo from '../db/repositories/conversation-repository.js';
import analyticsRepo from '../db/repositories/analytics-repository.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('flushmemory')
      .setDescription('Czyści Twoją historię konwersacji (bot + n8n AI Agent)')
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const access = await getDmAccess(interaction);
    if (!access.isAiAllowed) {
      await interaction.reply({
        content: configManager.config.bot.restrictedResponse,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const deletedCount = await conversationRepo.flushUserConversations(
      interaction.user.id
    );

    await analyticsRepo
      .logCommand(interaction.user.id, interaction.user.username, 'flushmemory', false, true)
      .catch((err: Error) =>
        logger.error('Failed to log command', { error: err.message })
      );

    await interaction.reply({
      content: `✅ Twoja pamięć konwersacji została wyczyszczona.\n📊 Usunięto **${deletedCount}** wiadomości (bot + n8n AI Agent).`,
    });

    logger.info('User flushed their conversation memory', {
      userId: interaction.user.id,
      deletedCount,
    });
  },
};

export default command;
