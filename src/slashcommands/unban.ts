import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import { applyUnban } from '../utils/moderation-actions.js';
import { t } from '../utils/i18n.js';
import {
  withAppAvailability,
  resolveGuildInvoker,
  actorFromInteraction,
} from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('unban')
      .setDescription(t('commands.unban.description'))
      .addStringOption((option) =>
        option
          .setName('user_id')
          .setDescription(t('commands.unban.options.userId'))
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
        content: t('errors.missingPermission'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userId = interaction.options.getString('user_id', true).trim();
    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({
        content: t('commands.unban.invalidId'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await applyUnban(base.guild, userId, actorFromInteraction(interaction));

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
