const { SlashCommandBuilder } = require('discord.js');

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
    */
  }
};
