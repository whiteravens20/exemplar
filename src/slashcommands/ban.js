const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { isModeratorOrAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to ban').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for banning')
    ),
  
  async execute(interaction) {
    if (!isModeratorOrAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(target.id);
      
      if (!member.bannable) {
        return interaction.reply({
          content: '❌ I cannot ban this user (insufficient permissions).',
          ephemeral: true
        });
      }

      await member.ban({ reason });
      
      logger.info(`User banned: ${target.username}`, { userId: target.id, reason });
      
      await interaction.reply({
        content: `🚫 **${target.username}** has been banned.\n**Reason:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error banning user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Failed to ban user: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
