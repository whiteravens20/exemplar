const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands'),
  
  async execute(interaction) {
    const embed = {
      color: 0x0099FF,
      title: '🤖 AI Assistant Bot - Pomoc',
      description: 'Witaj! Jestem botem AI dostępnym tylko w wiadomościach prywatnych.',
      fields: [
        {
          name: '💬 Jak ze mnie korzystać?',
          value: 'Wyślij mi wiadomość prywatną (DM), aby ze mną porozmawiać! Mogę pomóc z pytaniami i udzielić informacji.'
        },
        {
          name: '⚡ Tryb kodowania',
          value: 'Użyj `!code` przed swoją wiadomością, aby przełączyć na tryb pomocy programistycznej.\n**Przykład:** `!code napisz funkcję do sortowania tablicy`'
        },
        {
          name: '📋 Dostępne komendy w DM',
          value: '• `!help` - Pokazuje pomoc\n• `!code <pytanie>` - Tryb programistyczny'
        },
        {
          name: '📌 Funkcje',
          value: '• Oznacz mnie (@mention) na kanale, aby otrzymać informację o bocie\n• Wszystkie komendy działają tylko w DM\n• Bot automatycznie moderuje serwer'
        },
        {
          name: '⚠️ Uwaga',
          value: 'Dostęp do bota może być ograniczony do określonych ról. Jeśli nie możesz wysyłać wiadomości, skontaktuj się z administratorami serwera.'
        }
      ],
      timestamp: new Date()
    };

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
