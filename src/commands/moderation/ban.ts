import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotCommand } from '../../types/discord.js';

const ban: BotCommand = {
  name: 'ban',
  description: 'Ban a user from the server',
  execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const target = interaction.options.getUser('user');
    const reason =
      interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      await interaction.reply({ content: 'User not found', ephemeral: true });
      return;
    }

    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server', ephemeral: true });
        return;
      }
      const member = await interaction.guild.members.fetch(target.id);
      await member.ban({ reason });

      await interaction.reply({
        content: `🚫 **${target.username}** has been banned. Reason: ${reason}`,
        ephemeral: false,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Failed to ban user: ${(error as Error).message}`,
        ephemeral: true,
      });
    }
  },
};

export { ban };
export default { ban };
