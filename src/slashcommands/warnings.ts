import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import db from '../db/connection.js';
import warningRepo from '../db/repositories/warning-repository.js';
import analyticsRepo from '../db/repositories/analytics-repository.js';
import { t } from '../utils/i18n.js';
import type { Warning } from '../types/database.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription(t('commands.warnings.description'))
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription(t('commands.warnings.options.user'))
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const access = await getDmAccess(interaction);
    if (!access.isAiAllowed && !access.isAdmin) {
      await interaction.reply({
        content: configManager.config.bot.restrictedResponse,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!db.isAvailable()) {
      await interaction.reply({
        content: t('commands.warnings.databaseUnavailable'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const requestedUser = interaction.options.getUser('user');
    const targetUser = access.isAdmin ? requestedUser : null;

    let warnings: Warning[];
    let title: string;
    let description: string;

    if (access.isAdmin && !targetUser) {
      warnings = await warningRepo.getAllWarnings(false);
      title = t('commands.warnings.all.title');
      description =
        warnings.length > 0
          ? t('commands.warnings.all.count', { count: warnings.length })
          : t('commands.warnings.all.none');
    } else if (targetUser) {
      warnings = await warningRepo.getWarningHistory(targetUser.id, false);
      title = t('commands.warnings.user.title', { user: targetUser.username });
      description =
        warnings.length > 0
          ? t('commands.warnings.user.count', { count: warnings.length })
          : t('commands.warnings.user.none');
    } else {
      warnings = await warningRepo.getWarningHistory(interaction.user.id, false);
      title = t('commands.warnings.own.title');
      description =
        warnings.length > 0
          ? t('commands.warnings.own.count', { count: warnings.length })
          : t('commands.warnings.own.none');
    }

    await analyticsRepo
      .logCommand(interaction.user.id, interaction.user.username, 'warnings', false, true)
      .catch((err: Error) =>
        logger.error('Failed to log command', { error: err.message })
      );

    if (warnings.length === 0) {
      await interaction.reply({ content: description, flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    for (const [index, warning] of warnings.slice(0, 25).entries()) {
      const expiresAt = new Date(warning.expires_at);
      const issuedAt = new Date(warning.issued_at);
      const daysLeft = Math.ceil(
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const fieldName =
        access.isAdmin && !targetUser
          ? `${warning.username || warning.user_discord_id}`
          : t('commands.warnings.entryTitle', { number: index + 1 });

      const lines = [
        t('commands.warnings.reason', { reason: warning.reason }),
        t('commands.warnings.issued', { date: issuedAt }),
        t('commands.warnings.expiresIn', { count: daysLeft }),
      ];
      if (access.isAdmin && warning.issued_by_username) {
        lines.push(
          t('commands.warnings.issuedBy', { moderator: warning.issued_by_username })
        );
      }
      const fieldValue = lines.join('\n');

      embed.addFields({ name: fieldName, value: fieldValue, inline: false });
    }

    if (warnings.length > 25) {
      embed.setFooter({
        text: t('commands.warnings.footer', { shown: 25, total: warnings.length }),
      });
    }

    await interaction.reply({ embeds: [embed] });
    logger.info('User checked warnings', {
      userId: interaction.user.id,
      isAdmin: access.isAdmin,
      targetId: targetUser?.id ?? null,
      warningCount: warnings.length,
    });
  },
};

export default command;
