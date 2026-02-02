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
    if (!isModeratorOrAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      // Try to send DM to the user
      const dm = await target.createDM();
      await dm.send({
        embeds: [{
          color: 0xFFAA00,
          title: '⚠️ Warning',
          description: `You have been warned on **${interaction.guild.name}**`,
          fields: [
            {
              name: 'Reason',
              value: reason
            }
          ],
          timestamp: new Date()
        }]
      });

      logger.info(`User warned: ${target.username}`, { userId: target.id, reason });
      
      await interaction.reply({
        content: `⚠️ **${target.username}** has been warned.\n**Reason:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error warning user', { error: error.message, userId: target.id });
      await interaction.reply({
        content: `❌ Failed to warn user: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
