import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import { withAppAvailability } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('rules')
      .setDescription('Pokazuje regulamin serwera')
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Human-facing rules from the RULES_TEXT env var. This is intentionally
    // separate from MOD_RULES_TEXT (the AI's rulebook): a pointer + Discord link
    // is fine here because people can follow it.
    const rulesText = configManager.config.bot.rulesText.trim();
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📜 Regulamin serwera')
      .setDescription(
        rulesText ||
          'Regulamin nie został jeszcze skonfigurowany. Skontaktuj się z administracją serwera.'
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    logger.info('Rules command executed', { userId: interaction.user.id });
  },
};

export default command;
