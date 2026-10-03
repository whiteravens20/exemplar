import {
  SlashCommandBuilder,
  EmbedBuilder,
  type BaseMessageOptions,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { withAppAvailability } from './shared.js';

function rulesMessage(): BaseMessageOptions {
  // Human-facing rules from the RULES_TEXT env var. This is intentionally
  // separate from MOD_RULES_TEXT (the AI's rulebook): a pointer + Discord link
  // is fine here because people can follow it.
  const rulesText = configManager.config.bot.rulesText.trim();
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(t('commands.rules.title'))
    .setDescription(rulesText || t('commands.rules.notConfigured'))
    .setTimestamp();
  return { embeds: [embed] };
}

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('rules')
      .setDescription(t('commands.rules.description'))
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply(rulesMessage());
    logger.info('Rules command executed', { userId: interaction.user.id });
  },

  async reactionReply() {
    return rulesMessage();
  },
};

export default command;
