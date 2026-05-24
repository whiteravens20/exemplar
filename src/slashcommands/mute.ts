import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyTimeout, parseDuration } from '../utils/moderation-actions.js';
import {
  withAppAvailability,
  resolveModerationContext,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Wycisza (timeout) użytkownika na skonfigurowanym serwerze')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('Użytkownik do wyciszenia')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('duration')
          .setDescription('Czas wyciszenia, np. 30s, 10m, 1h, 1d (maks. 28 dni)')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Powód wyciszenia')
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

    const durationMs = parseDuration(interaction.options.getString('duration', true));
    if (durationMs === null) {
      await interaction.reply({
        content: '❌ Nieprawidłowy format czasu. Użyj: `30s`, `10m`, `1h`, `1d`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'Nie podano powodu';
    const result = await applyTimeout(
      ctx.targetMember,
      durationMs,
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
