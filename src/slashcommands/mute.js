const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { isModeratorOrAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user in the server')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to mute').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('duration').setDescription('Mute duration in minutes').setMinValue(1)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for muting')
    ),
  
  async execute(interaction) {
    if (!isModeratorOrAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('user');
    const durationMinutes = interaction.options.getInteger('duration') || 60;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(target.id);
      const duration = durationMinutes * 60 * 1000;

      if (!member.moderatable) {
        return interaction.reply({
          content: '❌ I cannot mute this user (insufficient permissions).',
          ephemeral: true
        });
      }

      await member.timeout(duration, reason);
      
      logger.info(`User muted: ${target.username}`, { userId: target.id, duration: durationMinutes, reason });
      
      await interaction.reply({
        content: `🔇 **${target.username}** has been muted for **${durationMinutes}** minutes.\n**Reason:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error muting user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Failed to mute user: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
