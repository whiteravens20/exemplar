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
import type { Warning } from '../types/database.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Pokazuje aktywne ostrzeżenia (Twoje lub — dla adminów — wybranego użytkownika)')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('Użytkownik do sprawdzenia (tylko dla administratorów)')
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
        content: '❌ Baza danych niedostępna. Nie można pobrać ostrzeżeń.',
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
      title = '⚠️ Wszystkie Aktywne Ostrzeżenia';
      description =
        warnings.length > 0
          ? `Znaleziono **${warnings.length}** aktywnych ostrzeżeń.`
          : 'Brak aktywnych ostrzeżeń w systemie.';
    } else if (targetUser) {
      warnings = await warningRepo.getWarningHistory(targetUser.id, false);
      title = `⚠️ Ostrzeżenia: ${targetUser.username}`;
      description =
        warnings.length > 0
          ? `Użytkownik ma **${warnings.length}** aktywnych ostrzeżeń.`
          : 'Użytkownik nie ma aktywnych ostrzeżeń.';
    } else {
      warnings = await warningRepo.getWarningHistory(interaction.user.id, false);
      title = '⚠️ Twoje Ostrzeżenia';
      description =
        warnings.length > 0
          ? `Masz **${warnings.length}** aktywnych ostrzeżeń.`
          : 'Nie masz aktywnych ostrzeżeń! ✅';
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
          : `Ostrzeżenie ${index + 1}`;

      let fieldValue = `**Powód:** ${warning.reason}\n**Wydano:** ${issuedAt.toLocaleDateString('pl-PL')}\n**Wygasa za:** ${daysLeft} dni`;
      if (access.isAdmin && warning.issued_by_username) {
        fieldValue += `\n**Wydane przez:** ${warning.issued_by_username}`;
      }

      embed.addFields({ name: fieldName, value: fieldValue, inline: false });
    }

    if (warnings.length > 25) {
      embed.setFooter({ text: `Pokazano 25 z ${warnings.length} ostrzeżeń` });
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
