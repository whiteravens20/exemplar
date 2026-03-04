import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '../types/discord.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user in the server')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to mute').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('duration')
        .setDescription('Mute duration in minutes')
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for muting')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Block manual use - this command is reserved for automated moderation
    await interaction.reply({
      content:
        '❌ Ta komenda jest niedostępna do ręcznego użycia. Bot używa jej automatycznie w ramach moderacji.',
      ephemeral: true,
    });
    return;

    /* RESERVED FOR AUTOMATED USE
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
    const durationMinutes = interaction.options.getInteger('duration') || 60;
    const reason = interaction.options.getString('reason') || 'Nie podano powodu';

    try {
      const member = await interaction.guild.members.fetch(target.id);
      const duration = durationMinutes * 60 * 1000;

      if (!member.moderatable) {
        return interaction.reply({
          content: '❌ Nie mogę wyciszyć tego użytkownika (niewystarczające uprawnienia).',
          ephemeral: true
        });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
          content: '❌ Nie możesz wyciszyć tego użytkownika (hierarchia ról).',
          ephemeral: true
        });
      }

      if (member.id === interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ Nie można wyciszyć właściciela serwera.',
          ephemeral: true
        });
      }

      const MAX_TIMEOUT_MINUTES = 40320; // 28 days
      if (durationMinutes > MAX_TIMEOUT_MINUTES) {
        return interaction.reply({
          content: `❌ Czas trwania nie może przekroczyć ${MAX_TIMEOUT_MINUTES} minut (28 dni).`,
          ephemeral: true
        });
      }

      await member.timeout(duration, reason);
      
      await interaction.reply({
        content: `🔇 **${target.username}** został wyciszony na **${durationMinutes}** minut.\n**Powód:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Nie udało się wyciszyć użytkownika: ${(error as Error).message}`,
        ephemeral: true
      });
    }
    */
  },
};

export default command;
