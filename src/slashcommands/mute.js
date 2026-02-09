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
        content: '❌ Nie masz uprawnień do użycia tej komendy.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('user');
    const durationMinutes = interaction.options.getInteger('duration') || 60;
    const reason = interaction.options.getString('reason') || 'Nie podano powodu';

    try {
      const member = await interaction.guild.members.fetch(target.id);
      const duration = durationMinutes * 60 * 1000;

      // Check if bot can mute the user
      if (!member.moderatable) {
        return interaction.reply({
          content: '❌ Nie mogę wyciszyć tego użytkownika (niewystarczające uprawnienia).',
          ephemeral: true
        });
      }

      // Check role hierarchy - moderator cannot mute users with equal or higher roles
      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
          content: '❌ Nie możesz wyciszyć tego użytkownika (hierarchia ról).',
          ephemeral: true
        });
      }

      // Prevent muting server owner
      if (member.id === interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ Nie można wyciszyć właściciela serwera.',
          ephemeral: true
        });
      }

      // Validate duration (Discord max: 28 days)
      const MAX_TIMEOUT_MINUTES = 40320; // 28 days
      if (durationMinutes > MAX_TIMEOUT_MINUTES) {
        return interaction.reply({
          content: `❌ Czas trwania nie może przekroczyć ${MAX_TIMEOUT_MINUTES} minut (28 dni).`,
          ephemeral: true
        });
      }

      await member.timeout(duration, reason);
      
      logger.info(`User muted: ${target.username}`, { userId: target.id, duration: durationMinutes, reason });
      
      await interaction.reply({
        content: `🔇 **${target.username}** został wyciszony na **${durationMinutes}** minut.\n**Powód:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error muting user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Nie udało się wyciszyć użytkownika: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
