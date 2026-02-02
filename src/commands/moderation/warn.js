module.exports = {
  warn: {
    name: 'warn',
    description: 'Warn a user',
    execute: async (interaction) => {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!target) {
        return interaction.reply({ content: 'User not found', ephemeral: true });
      }

      try {
        // Try to send DM to the user
        const dm = await target.createDM();
        await dm.send({
          content: `⚠️ You have been warned on **${interaction.guild.name}**\n\n**Reason:** ${reason}\n\nPlease follow the server rules.`
        });

        await interaction.reply({
          content: `⚠️ **${target.username}** has been warned. Reason: ${reason}`,
          ephemeral: false
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ Failed to warn user: ${error.message}`,
          ephemeral: true
        });
      }
    }
  }
};
