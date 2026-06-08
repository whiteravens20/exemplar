import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyWarn, canModerate } from '../utils/moderation-actions.js';
import {
  withAppAvailability,
  resolveGuildInvoker,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Wystawia ostrzeżenie użytkownikowi (zapisywane w bazie)')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('Użytkownik do ostrzeżenia')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Powód ostrzeżenia')
          .setRequired(true)
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const base = await resolveGuildInvoker(interaction);
    if (!base.ok) {
      await interaction.reply({ content: base.error, flags: MessageFlags.Ephemeral });
      return;
    }

    if (!base.invoker.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({
        content: '❌ Nie masz wymaganych uprawnień do użycia tej komendy.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    // If the target is on the server, enforce role hierarchy.
    const targetMember = await base.guild.members
      .fetch(targetUser.id)
      .catch(() => null);
    if (targetMember && !canModerate(base.invoker, targetMember)) {
      await interaction.reply({
        content:
          '❌ Nie możesz ostrzec tego użytkownika (hierarchia ról lub akcja na sobie/właścicielu).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await applyWarn(
      base.guild,
      targetUser,
      reason,
      actorFromInteraction(interaction)
    );

    if (result.success && result.embed) {
      const embeds = [result.embed];
      if (result.autoMute?.embed) embeds.push(result.autoMute.embed);
      if (result.autoBan?.embed) embeds.push(result.autoBan.embed);
      await interaction.reply({ embeds });
    } else {
      await interaction.reply({
        content: result.content ?? '❌ Operacja nie powiodła się.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
