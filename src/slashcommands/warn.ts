import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '../types/discord.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user (reserved for automated moderation)')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to warn').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for warning')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Block all manual use - reserved for bot's automated moderation only
    await interaction.reply({
      content:
        '❌ Ta komenda jest zarezerwowana dla automatycznej moderacji.\n\n**Administratorzy/Moderatorzy:** Użyj `!warn <@user> [powód]` w DM.',
      ephemeral: true,
    });
    return;

    /* RESERVED FOR AUTOMATED BOT MODERATION
    
    This slash command will be used by the bot itself for automated moderation.
    Manual warns should use the !warn prefix command.
    
    Implementation placeholder for future automated moderation system.
    */
  },
};

export default command;
