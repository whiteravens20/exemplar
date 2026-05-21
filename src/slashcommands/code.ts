import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import N8NClient from '../utils/n8n-client.js';
import { splitMessage } from '../utils/message-splitter.js';
import { estimateTokens } from '../utils/token-estimator.js';
import { getTemplate } from '../config/response-templates.js';
import conversationRepo from '../db/repositories/conversation-repository.js';
import analyticsRepo from '../db/repositories/analytics-repository.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const n8nClient = new N8NClient(
  configManager.config.n8n.workflowUrl,
  configManager.config.n8n.apiKey
);

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('code')
      .setDescription('Wysyła zapytanie do AI w trybie programistycznym')
      .addStringOption((option) =>
        option
          .setName('message')
          .setDescription('Treść zapytania programistycznego')
          .setRequired(true)
          .setMaxLength(4000)
      )
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

    const message = interaction.options.getString('message', true).trim();
    if (!message) {
      await interaction.reply({
        content: '❌ Podaj treść zapytania.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const conversationContext = await conversationRepo.getRecentMessages(
      interaction.user.id,
      20
    );

    const startTime = Date.now();
    const result = await n8nClient.sendMessage(
      interaction.user.id,
      interaction.user.username,
      message,
      configManager.config.discord.serverId,
      'code',
      conversationContext
    );
    const responseTime = Date.now() - startTime;

    if (!result.success || !result.data?.response) {
      const status = result.status;
      let errorMessage: string;
      if (!result.success && !status) {
        errorMessage = getTemplate('error', 'n8nDown');
      } else if (status === 404) {
        errorMessage = getTemplate('error', 'notFound');
      } else if (status === 401 || status === 403) {
        errorMessage =
          '🔒 Błąd uwierzytelnienia backendu. Sprawdź konfigurację klucza API.';
      } else if (status && status >= 500) {
        errorMessage = getTemplate('error', 'n8nDown');
      } else if (result.error?.includes('timeout')) {
        errorMessage = getTemplate('error', 'timeout');
      } else {
        errorMessage = getTemplate('error', 'processing');
      }
      logger.error('Code command n8n error', {
        userId: interaction.user.id,
        status,
        error: result.error,
      });
      await interaction.editReply({ content: errorMessage });
      return;
    }

    const response = result.data.response;

    await conversationRepo
      .saveMessage(interaction.user.id, interaction.user.username, message, response)
      .catch((err: Error) =>
        logger.error('Failed to save conversation', { error: err.message })
      );

    await analyticsRepo
      .logMessage(
        interaction.user.id,
        interaction.user.username,
        'dm',
        'code',
        responseTime,
        estimateTokens(message + response)
      )
      .catch((err: Error) =>
        logger.error('Failed to log analytics', { error: err.message })
      );

    const chunks = splitMessage(response);
    await interaction.editReply({ content: chunks[0] });
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp({ content: chunk });
    }

    logger.info('Code command processed', {
      userId: interaction.user.id,
      responseLength: response.length,
      chunks: chunks.length,
    });
  },
};

export default command;
