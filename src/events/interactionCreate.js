const { Events, ChannelType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn('Unknown command', { command: interaction.commandName });
      return;
    }

    // Only allow slash commands in DMs - silently ignore on channels
    if (interaction.channel.type !== ChannelType.DM) {
      logger.info('Slash command ignored in channel', {
        command: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId
      });
      return;
    }

    try {
      await command.execute(interaction);
      logger.info('Command executed', {
        command: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId
      });
    } catch (error) {
      logger.error('Command execution error', {
        command: interaction.commandName,
        error: error.message
      });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ There was an error while executing this command!',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ There was an error while executing this command!',
          ephemeral: true
        });
      }
    }
  }
};
