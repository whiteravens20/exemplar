import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '../types/discord.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to kick').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for kicking')
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
    const reason = interaction.options.getString('reason') || 'Nie podano powodu';

    try {
      const member = await interaction.guild.members.fetch(target.id);
      
      if (!member.kickable) {
        return interaction.reply({
          content: '❌ Nie mogę wyrzucić tego użytkownika (niewystarczające uprawnienia).',
          ephemeral: true
        });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
          content: '❌ Nie możesz wyrzucić tego użytkownika (hierarchia ról).',
          ephemeral: true
        });
      }

      if (member.id === interaction.guild.ownerId) {
        return interaction.reply({
          content: '❌ Nie można wyrzucić właściciela serwera.',
          ephemeral: true
        });
      }

      await member.kick(reason);
      
      await interaction.reply({
        content: `✅ **${target.username}** został wyrzucony.\n**Powód:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Nie udało się wyrzucić użytkownika: ${(error as Error).message}`,
        ephemeral: true
      });
    }
    */
  },
};

export default command;
