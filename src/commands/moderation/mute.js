module.exports = {
  mute: {
    name: 'mute',
    description: 'Mute a user in the server',
    execute: async (interaction) => {
      const target = interaction.options.getUser('user');
      const durationMinutes = interaction.options.getInteger('duration') || 60;
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!target) {
        return interaction.reply({ content: 'User not found', ephemeral: true });
      }

      try {
        const member = await interaction.guild.members.fetch(target.id);
        const duration = durationMinutes * 60 * 1000;

        await member.timeout(duration, reason);
        
        await interaction.reply({
          content: `🔇 **${target.username}** has been muted for ${durationMinutes} minutes. Reason: ${reason}`,
          ephemeral: false
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ Failed to mute user: ${error.message}`,
          ephemeral: true
        });
      }
    }
  }
};
