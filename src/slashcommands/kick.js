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
    // Block manual use - this command is reserved for automated moderation
    return interaction.reply({
      content: '❌ Ta komenda jest niedostępna do ręcznego użycia. Bot używa jej automatycznie w ramach moderacji.',
      ephemeral: true
    });

    /* RESERVED FOR AUTOMATED USE
    // Must be used in a guild (server), not in DMs
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Ta komenda może być użyta tylko na serwerze, nie w prywatnych wiadomościach.',
        ephemeral: true
      });
    }

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
      
      // Check if bot can kick the user
      if (!member.kickable) {
        return interaction.reply({
          content: '❌ Nie mogę wyrzucić tego użytkownika (niewystarczające uprawnienia).',
          ephemeral: true
        });
      }

      // Check role hierarchy - moderator cannot kick users with equal or higher roles
      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
          content: '❌ Nie możesz wyrzucić tego użytkownika (hierarchia ról).',
          ephemeral: true
        });
      }

      // Prevent kicking server owner
      if (member.id === interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ Nie można wyrzucić właściciela serwera.',
          ephemeral: true
        });
      }

      await member.kick(reason);
      
      logger.info(`User kicked: ${target.username}`, { userId: target.id, reason });
      
      await interaction.reply({
        content: `✅ **${target.username}** został wyrzucony.\n**Powód:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error kicking user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Nie udało się wyrzucić użytkownika: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
