module.exports = {
  ban: {
    name: 'ban',
    description: 'Ban a user from the server',
    execute: async (interaction) => {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!target) {
        return interaction.reply({ content: 'User not found', ephemeral: true });
      }

      try {
        const member = await interaction.guild.members.fetch(target.id);
        await member.ban({ reason });
        
        await interaction.reply({
          content: `🚫 **${target.username}** has been banned. Reason: ${reason}`,
          ephemeral: false
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ Failed to ban user: ${error.message}`,
          ephemeral: true
        });
      }
    }
  }
};
