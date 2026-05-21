import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyUntimeout } from '../utils/moderation-actions.js';
import {
  withAppAvailability,
  resolveModerationContext,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Zdejmuje wyciszenie z użytkownika na skonfigurowanym serwerze')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('Użytkownik, z którego zdjąć wyciszenie')
          .setRequired(true)
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ctx = await resolveModerationContext(
      interaction,
      PermissionFlagsBits.ModerateMembers
    );
    if (!ctx.ok) {
      await interaction.reply({ content: ctx.error, flags: MessageFlags.Ephemeral });
      return;
    }

    const result = await applyUntimeout(
      ctx.targetMember,
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
