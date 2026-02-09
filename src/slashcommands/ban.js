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
        content: '❌ Nie masz uprawnień do użycia tej komendy.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Nie podano powodu';

    try {
      const member = await interaction.guild.members.fetch(target.id);
      
      // Check if bot can ban the user
      if (!member.bannable) {
        return interaction.reply({
          content: '❌ Nie mogę zbanować tego użytkownika (niewystarczające uprawnienia).',
          ephemeral: true
        });
      }

      // Check role hierarchy - moderator cannot ban users with equal or higher roles
      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
          content: '❌ Nie możesz zbanować tego użytkownika (hierarchia ról).',
          ephemeral: true
        });
      }

      // Prevent banning server owner
      if (member.id === interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ Nie można zbanować właściciela serwera.',
          ephemeral: true
        });
      }

      await member.ban({ reason });
      
      logger.info(`User banned: ${target.username}`, { userId: target.id, reason });
      
      await interaction.reply({
        content: `🚫 **${target.username}** został zbanowany.\n**Powód:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error banning user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Nie udało się zbanować użytkownika: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
