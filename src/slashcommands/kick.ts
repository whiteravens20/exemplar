import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyKick } from '../utils/moderation-actions.js';
import {
  withAppAvailability,
  resolveModerationContext,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Wyrzuca użytkownika ze skonfigurowanego serwera')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('Użytkownik do wyrzucenia')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Powód wyrzucenia')
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ctx = await resolveModerationContext(
      interaction,
      PermissionFlagsBits.KickMembers
    );
    if (!ctx.ok) {
      await interaction.reply({ content: ctx.error, flags: MessageFlags.Ephemeral });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'Nie podano powodu';
    const result = await applyKick(
      ctx.targetMember,
      reason,
      actorFromInteraction(interaction)
    );

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
