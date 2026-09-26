import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyTimeout, parseDuration } from '../utils/moderation-actions.js';
import { t } from '../utils/i18n.js';
import {
  withAppAvailability,
  resolveModerationContext,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription(t('commands.mute.description'))
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription(t('commands.mute.options.user'))
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('duration')
          .setDescription(t('commands.mute.options.duration'))
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription(t('commands.mute.options.reason'))
          .setMaxLength(512)
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
        content: t('commands.mute.invalidDuration'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reason = interaction.options.getString('reason') ?? t('moderation.noReason');
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
        content: result.content ?? t('errors.operationFailed'),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
