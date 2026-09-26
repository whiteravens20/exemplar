import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyWarn, canModerate } from '../utils/moderation-actions.js';
import { t } from '../utils/i18n.js';
import {
  withAppAvailability,
  resolveGuildInvoker,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription(t('commands.warn.description'))
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription(t('commands.warn.options.user'))
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription(t('commands.warn.options.reason'))
          .setMaxLength(512)
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
        content: t('errors.missingPermission'),
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
        content: t('commands.warn.cannotWarn'),
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
        content: result.content ?? t('errors.operationFailed'),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
