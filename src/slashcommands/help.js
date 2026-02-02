const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands'),
  
  async execute(interaction) {
    const embed = {
      color: 0x0099FF,
      title: '🤖 AI Assistant Bot - Help',
      description: 'Available commands and features:',
      fields: [
        {
          name: '💬 AI Assistant',
          value: 'Send me a DM to chat with me! I can help with questions and provide information.'
        },
        {
          name: '🛡️ Moderation Commands (Admin Only)',
          value: '`/kick` - Kick a user\n`/ban` - Ban a user\n`/mute` - Mute a user\n`/warn` - Warn a user'
        },
        {
          name: '📌 Features',
          value: '• Mention me in chat for a quick response\n• Send DMs for full AI conversation\n• Full moderation suite for administrators'
        },
        {
          name: '⚠️ Note',
          value: 'AI Assistant access may be restricted to specific roles. If you cannot send messages, contact server administrators.'
        }
      ],
      timestamp: new Date()
    };

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
