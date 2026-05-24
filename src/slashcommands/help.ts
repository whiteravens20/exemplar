import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import configManager from '../config/config.js';
import logger from '../utils/logger.js';
import { withAppAvailability, getDmAccess } from './shared.js';

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Pokazuje dostępne komendy i sposób korzystania z bota')
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const access = await getDmAccess(interaction);
    if (!access.isAiAllowed) {
      await interaction.reply({
        content: configManager.config.bot.restrictedResponse,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🤖 AI Assistant Bot - Pomoc')
      .setDescription(
        'Witaj! Jestem botem AI. Napisz do mnie w wiadomości prywatnej, aby porozmawiać. Wszystkie komendy `/` działają w DM z botem.'
      )
      .addFields(
        {
          name: '💬 Jak korzystać?',
          value:
            'Po prostu wyślij mi wiadomość prywatną — odpowiem z pomocą AI. Komendy `/` uruchamiasz w tym samym oknie DM.',
        },
        {
          name: '📋 Komendy użytkownika',
          value:
            '• `/help` — ta wiadomość\n• `/code <wiadomość>` — tryb programistyczny\n• `/flushmemory` — wyczyść pamięć konwersacji\n• `/warnings` — pokaż swoje ostrzeżenia',
        },
        {
          name: '👮 Komendy moderacji (wymagane uprawnienia)',
          value:
            '• `/kick`, `/ban`, `/unban`\n• `/mute`, `/unmute`\n• `/warn` — wystaw ostrzeżenie',
        },
        {
          name: '🔐 Komendy administratora',
          value:
            '• `/warnings [user]` — przegląd ostrzeżeń\n• `/stats [days]` — statystyki bota\n• `/flushdb` — wyczyść bazę danych',
        },
        {
          name: '⚠️ Uwaga',
          value:
            'Komenda użyta na kanale serwera nie zostanie wykonana — bot odeśle Cię do DM.',
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    logger.info('Help command executed', { userId: interaction.user.id });
  },
};

export default command;
