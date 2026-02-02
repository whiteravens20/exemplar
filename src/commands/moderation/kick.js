module.exports = {
  kick: {
    name: 'kick',
    description: 'Kick a user from the server',
    execute: async (interaction) => {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!target) {
        return interaction.reply({ content: 'User not found', ephemeral: true });
      }

      try {
        const member = await interaction.guild.members.fetch(target.id);
        await member.kick(reason);
        
        await interaction.reply({
          content: `✅ **${target.username}** has been kicked. Reason: ${reason}`,
          ephemeral: false
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ Failed to kick user: ${error.message}`,
          ephemeral: true
        });
      }
    }
  }
};
