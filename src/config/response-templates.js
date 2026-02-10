/**
 * Custom Response Templates
 * 
 * Use these templates to customize bot responses
 * 
 * Available categories:
 * - mention: Responses to mentions in public channels
 * - restricted: When user doesn't have permissions
 * - error: Various error types (n8n down, timeout, processing, generic)
 * - success: Success confirmations
 * 
 * Types (styles):
 * - default: Standard style
 * - friendly: Friendly, casual
 * - formal: Formal, professional
 * - polite: Polite
 * - emoji: With more emojis
 * 
 * Usage in code:
 *   const { getTemplate } = require('./response-templates');
 *   const msg = getTemplate('error', 'n8nDown');
 */

const templates = {
  // Responses for mentions
  mention: {
    default: 'Witaj, bracie. Jestem Asystentem Zakonu. Skontaktuj się ze mną poprzez wiadomość prywatną.',
    friendly: '👋 Bracie! Asystent Zakonu melduje gotowość. Prześlij mi wiadomość prywatną, a udzielę wsparcia.',
    formal: 'Pozdrowienia w imię Imperatora. Jestem Asystentem Zakonu. Proszę o przesłanie wiadomości prywatnej w celu rozpoczęcia rozmowy.',
    emoji: '🤖 Wezwanie odebrane. Asystent Zakonu czuwa. Wyślij wiadomość prywatną 💬'
  },

  // Responses for access denied
  restricted: {
    default: 'Nie posiadasz uprawnień do korzystania z tej funkcji. Skontaktuj się z przełożonymi Zakonu.',
    friendly: '👀 Bracie, twoje uprawnienia są jeszcze niepełne. Zwróć się do moderatorów, by je otrzymać.',
    polite: 'Doceniam twoją gorliwość, jednak obecnie nie masz pozwolenia na użycie tej funkcji. Skontaktuj się z administracją Zakonu.',
    emoji: '🔒 Dostęp zakazany! Skontaktuj się z dowództwem, by odblokować tę funkcję.'
  },

  // Error responses
  error: {
    processing: '❌ Błąd w przetwarzaniu wiadomości. Spróbuj ponownie później.',
    n8nDown: '⚠️ Backend jest chwilowo niedostępny. Spróbuj ponownie za moment.',
    timeout: '⏱️ Przekroczono czas oczekiwania. Przetwarzanie trwało zbyt długo.',
    notFound: '⚠️ Nie znaleziono workflow w backendzie. Sprawdź konfigurację.',
    generic: '💥 Coś poszło nie tak! Spróbuj ponownie lub skontaktuj się z supportem.'
  },

  // Success responses
  success: {
    processed: '✅ Wiadomość przetworzona pomyślnie!',
    received: '📩 Wiadomość odebrana i przetworzona!',
    completed: '🎉 Gotowe!'
  }
};

/**
 * Get a template response
 * @param {string} category - e.g., 'mention', 'restricted', 'error'
 * @param {string} type - e.g., 'default', 'friendly', 'formal'
 * @returns {string} Response text
 */
function getTemplate(category, type = 'default') {
  if (!templates[category]) {
    console.warn(`Unknown template category: ${category}`);
    return templates.error.generic;
  }
  
  if (!templates[category][type]) {
    console.warn(`Unknown template type ${type} for category ${category}`);
    return templates[category].default;
  }
  
  return templates[category][type];
}

module.exports = {
  templates,
  getTemplate
};
