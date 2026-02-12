const { SlashCommandBuilder } = require('discord.js');
const { isModeratorOrAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');
const warningRepo = require('../db/repositories/warning-repository');
const analyticsRepo = require('../db/repositories/analytics-repository');

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

      // Save warning to database
      const activeWarnings = await warningRepo.addWarning(
        target.id,
        target.username,
        reason,
        interaction.user.id
      );

      // Log command usage
      await analyticsRepo.logCommand(
        interaction.user.id,
        interaction.user.username,
        'warn',
        false,
        true
      ).catch(err => logger.error('Failed to log command', { error: err.message }));

      logger.info(`User warned: ${target.username}`, { 
        userId: target.id, 
        reason, 
        dmSent,
        activeWarnings 
      });
      
      const dmStatus = dmSent ? '' : ' (DM nie doręczono - użytkownik może mieć wyłączone wiadomości prywatne)';
      const warningStatus = activeWarnings > 0 ? `\n**Aktywne ostrzeżenia:** ${activeWarnings}` : '';
      
      await interaction.reply({
        content: `⚠️ **${target.username}** został ostrzeony${dmStatus}.\n**Powód:** ${reason}${warningStatus}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error warning user', { error: error.message, userId: target.id });
      
      // Log failed command
      await analyticsRepo.logCommand(
        interaction.user.id,
        interaction.user.username,
        'warn',
        false,
        false
      ).catch(err => logger.error('Failed to log command', { error: err.message }));
      
      await interaction.reply({
        content: `❌ Nie udało się ostrzec użytkownika: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
  }
};
