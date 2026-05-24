import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyUnban } from '../utils/moderation-actions.js';
import {
  withAppAvailability,
  resolveGuildInvoker,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Zdejmuje bana z użytkownika na skonfigurowanym serwerze')
      .addStringOption((option) =>
        option
          .setName('user_id')
          .setDescription('ID użytkownika do odbanowania')
          .setRequired(true)
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const base = await resolveGuildInvoker(interaction);
    if (!base.ok) {
      await interaction.reply({ content: base.error, flags: MessageFlags.Ephemeral });
      return;
    }

    if (!base.invoker.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        content: '❌ Nie masz wymaganych uprawnień do użycia tej komendy.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userId = interaction.options.getString('user_id', true).trim();
    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({
        content: '❌ Nieprawidłowe ID użytkownika.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await applyUnban(base.guild, userId, actorFromInteraction(interaction));

    if (result.success && result.embed) {
      await interaction.reply({ embeds: [result.embed] });
    } else {
      await interaction.reply({
        content: result.content ?? '❌ Operacja nie powiodła się.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
