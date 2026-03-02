import type { ChatInputCommandInteraction } from 'discord.js';
import type { BotCommand } from '../../types/discord.js';

const mute: BotCommand = {
  name: 'mute',
  description: 'Mute a user in the server',
  execute: async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const target = interaction.options.getUser('user');
    const durationMinutes =
      interaction.options.getInteger('duration') || 60;
    const reason =
      interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      await interaction.reply({ content: 'User not found', ephemeral: true });
      return;
    }

    try {
      const member = await interaction.guild!.members.fetch(target.id);
      const duration = durationMinutes * 60 * 1000;

      await member.timeout(duration, reason);

      await interaction.reply({
        content: `🔇 **${target.username}** has been muted for ${durationMinutes} minutes. Reason: ${reason}`,
        ephemeral: false,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Failed to mute user: ${(error as Error).message}`,
        ephemeral: true,
      });
    }
  },
};

export { mute };
export default { mute };
