const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { isModeratorOrAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to kick').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for kicking')
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
      
      if (!member.kickable) {
        return interaction.reply({
          content: '❌ I cannot kick this user (insufficient permissions).',
          ephemeral: true
        });
      }

      await member.kick(reason);
      
      logger.info(`User kicked: ${target.username}`, { userId: target.id, reason });
      
      await interaction.reply({
        content: `✅ **${target.username}** has been kicked.\n**Reason:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error kicking user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Failed to kick user: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
