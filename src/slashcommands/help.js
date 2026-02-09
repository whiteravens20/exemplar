const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands'),
  
  async execute(interaction) {
    const embed = {
      color: 0x0099FF,
      title: '🤖 AI Assistant Bot - Pomoc',
      description: 'Dostępne komendy i funkcje:',
      fields: [
        {
          name: '💬 Asystent AI',
          value: 'Wyślij mi wiadomość prywatną, aby ze mną porozmawiać! Mogę pomoc z pytaniami i udzielić informacji.'
        },
        {
          name: '🛡️ Komendy Moderacyjne (Tylko Admin)',
          value: '`/kick` - Wyrzuca użytkownika\n`/ban` - Banuje użytkownika\n`/mute` - Wycisza użytkownika\n`/warn` - Ostrzega użytkownika'
        },
        {
          name: '📌 Funkcje',
          value: '• Oznacz mnie na czacie, aby uzyskać szybką odpowiedź\n• Wyślij DM, aby porozmawiać z AI\n• Pełny zestaw narzędzi moderacyjnych dla administratorów'
        },
        {
          name: '⚠️ Uwaga',
          value: 'Dostęp do Asystenta AI może być ograniczony do określonych ról. Jeśli nie możesz wysyłać wiadomości, skontaktuj się z administratorami serwera.'
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
