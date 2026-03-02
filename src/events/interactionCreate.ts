import { Events, ChannelType, type ChatInputCommandInteraction } from 'discord.js';
import logger from '../utils/logger.js';
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

    // Only allow slash commands in DMs - silently ignore on channels
    if (interaction.channel?.type !== ChannelType.DM) {
      logger.info('Slash command ignored in channel', {
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
        guildId: interaction.guildId,
      });
    } catch (error) {
      logger.error('Command execution error', {
        command: interaction.commandName,
        error: (error as Error).message,
      });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ Wystąpił błąd podczas wykonywania tej komendy!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: '❌ Wystąpił błąd podczas wykonywania tej komendy!',
          ephemeral: true,
        });
      }
    }
  },
};

export default event;
