const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const warningRepo = require('../db/repositories/warning-repository');
const analyticsRepo = require('../db/repositories/analytics-repository');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View your active warnings'),
  
  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      
      // Log command usage
      await analyticsRepo.logCommand(
        userId,
        interaction.user.username,
        'warnings',
        false,
        true
      ).catch(err => logger.error('Failed to log command', { error: err.message }));

      // Get warning history
      const warnings = await warningRepo.getWarningHistory(userId, false); // Active only
      
      if (warnings.length === 0) {
        return interaction.reply({
          content: '✅ Nie masz aktywnych ostrzeżeń!',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('⚠️ Twoje Ostrzeżenia')
        .setDescription(`Masz **${warnings.length}** aktywnych ostrzeżeń.`)
        .setTimestamp();

      warnings.forEach((warning, index) => {
        const expiresAt = new Date(warning.expires_at);
        const issuedAt = new Date(warning.issued_at);
        const daysLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
        
        embed.addFields({
          name: `Ostrzeżenie ${index + 1}`,
          value: `**Powód:** ${warning.reason}\n**Wydano:** ${issuedAt.toLocaleDateString('pl-PL')}\n**Wygasa za:** ${daysLeft} dni`,
          inline: false
        });
      });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      logger.info('User checked warnings', { userId, warningCount: warnings.length });
    } catch (error) {
      logger.error('Error fetching user warnings', { 
        error: error.message,
        userId: interaction.user.id 
      });
      
      await analyticsRepo.logCommand(
        interaction.user.id,
        interaction.user.username,
        'warnings',
        false,
        false
      ).catch(err => logger.error('Failed to log command', { error: err.message }));
      
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas pobierania ostrzeżeń. Spróbuj ponownie później.',
        ephemeral: true
      });
    }
  }
};
