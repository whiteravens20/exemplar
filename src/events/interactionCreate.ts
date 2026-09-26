import {
  Events,
  MessageFlags,
  type AutocompleteInteraction,
  type Interaction,
} from 'discord.js';
import logger from '../utils/logger.js';
import configManager from '../config/config.js';
import { t } from '../utils/i18n.js';
import type { BotEvent, SlashCommand } from '../types/discord.js';

/** Suggestions for options declared with `setAutocomplete(true)`; DMs only, like the commands. */
async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const command = interaction.client.commands.get(interaction.commandName);
  try {
    if (command?.autocomplete && !interaction.inGuild()) {
      await command.autocomplete(interaction);
    } else {
      await interaction.respond([]);
    }
  } catch (error) {
    logger.warn('Autocomplete failed', {
      command: interaction.commandName,
      error: (error as Error).message,
    });
  }
}

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      await autocomplete(interaction);
      return;
    }
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

      const errorContent = t('errors.commandFailed');

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
