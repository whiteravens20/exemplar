import { Events, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import logger from '../utils/logger.js';
import configManager from '../config/config.js';
import type { BotEvent, SlashCommand } from '../types/discord.js';

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(
      interaction.commandName
    ) as SlashCommand | undefined;

    if (!command) {
      logger.warn('Unknown command', { command: interaction.commandName });
      return;
    }

    // Commands execute only in DMs with the bot. Used in a guild channel, the
    // bot answers with the mention response instead of running the command.
    if (interaction.inGuild()) {
      await interaction.reply({
        content: configManager.config.bot.mentionResponse,
        flags: MessageFlags.Ephemeral,
      });
      logger.info('Slash command used in channel - returned mention response', {
        command: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
      return;
    }

    try {
      await command.execute(interaction);
      logger.info('Command executed', {
        command: interaction.commandName,
        userId: interaction.user.id,
      });
    } catch (error) {
      logger.error('Command execution error', {
        command: interaction.commandName,
        error: (error as Error).message,
      });

      const errorContent = '❌ Wystąpił błąd podczas wykonywania tej komendy!';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorContent,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: errorContent,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

export default event;
