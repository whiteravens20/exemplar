import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyBan } from '../utils/moderation-actions.js';
import {
  withAppAvailability,
  resolveModerationContext,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Banuje użytkownika na skonfigurowanym serwerze')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('Użytkownik do zbanowania')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Powód bana').setMaxLength(512)
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ctx = await resolveModerationContext(
      interaction,
      PermissionFlagsBits.BanMembers
    );
    if (!ctx.ok) {
      await interaction.reply({ content: ctx.error, flags: MessageFlags.Ephemeral });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'Nie podano powodu';
    const result = await applyBan(
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
