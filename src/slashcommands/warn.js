const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { isModeratorOrAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to warn').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for warning')
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
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      // Check role hierarchy if member is in guild
      if (member) {
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          return interaction.reply({
            content: '❌ Nie możesz ostrzec tego użytkownika (hierarchia ról).',
            ephemeral: true
          });
        }

        if (member.id === interaction.guild.ownerId) {
          return interaction.reply({
            content: '❌ Nie można ostrzec właściciela serwera.',
            ephemeral: true
          });
        }
      }

      // Try to send DM to the user
      let dmSent = false;
      try {
        const dm = await target.createDM();
        await dm.send({
          embeds: [{
            color: 0xFFAA00,
            title: '⚠️ Ostrzeżenie',
            description: `Otrzymałeś ostrzeżenie na **${interaction.guild.name}**`,
            fields: [
              {
                name: 'Powód',
                value: reason
              }
            ],
            timestamp: new Date()
          }]
        });
        dmSent = true;
      } catch (dmError) {
        logger.warn('Could not send DM to user', { 
          userId: target.id, 
          error: dmError.message 
        });
      }

      logger.info(`User warned: ${target.username}`, { userId: target.id, reason, dmSent });
      
      const dmStatus = dmSent ? '' : ' (DM nie doręczono - użytkownik może mieć wyłączone wiadomości prywatne)';
      await interaction.reply({
        content: `⚠️ **${target.username}** został ostrzeony${dmStatus}.\n**Powód:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error warning user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Nie udało się ostrzec użytkownika: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
