import logger from '../utils/logger.js';

/**
 * Custom Response Templates
 *
 * Available categories: mention, restricted, error, success
 * Types/styles: default, friendly, formal, polite, emoji
 */

interface TemplateCategory {
  [type: string]: string;
}

interface Templates {
  mention: TemplateCategory;
  restricted: TemplateCategory;
  error: TemplateCategory;
  success: TemplateCategory;
  [category: string]: TemplateCategory;
}

const templates: Templates = {
  mention: {
    default:
      'Witaj, bracie. Jestem Asystentem Zakonu. Skontaktuj się ze mną poprzez wiadomość prywatną.',
    friendly:
      '👋 Bracie! Asystent Zakonu melduje gotowość. Prześlij mi wiadomość prywatną, a udzielę wsparcia.',
    formal:
      'Pozdrowienia w imię Imperatora. Jestem Asystentem Zakonu. Proszę o przesłanie wiadomości prywatnej w celu rozpoczęcia rozmowy.',
    emoji:
      '🤖 Wezwanie odebrane. Asystent Zakonu czuwa. Wyślij wiadomość prywatną 💬',
  },

  restricted: {
    default:
      'Nie posiadasz uprawnień do korzystania z tej funkcji. Skontaktuj się z przełożonymi Zakonu.',
    friendly:
      '👀 Bracie, twoje uprawnienia są jeszcze niepełne. Zwróć się do moderatorów, by je otrzymać.',
    polite:
      'Doceniam twoją gorliwość, jednak obecnie nie masz pozwolenia na użycie tej funkcji. Skontaktuj się z administracją Zakonu.',
    emoji:
      '🔒 Dostęp zakazany! Skontaktuj się z dowództwem, by odblokować tę funkcję.',
  },

  error: {
    processing:
      '❌ Błąd w przetwarzaniu wiadomości. Spróbuj ponownie później.',
    n8nDown:
      '⚠️ Backend jest chwilowo niedostępny. Spróbuj ponownie za moment.',
    timeout:
      '⏱️ Przekroczono czas oczekiwania. Przetwarzanie trwało zbyt długo.',
    notFound:
      '⚠️ Nie znaleziono workflow w backendzie. Sprawdź konfigurację.',
    generic:
      '💥 Coś poszło nie tak! Spróbuj ponownie lub skontaktuj się z supportem.',
  },

  success: {
    processed: '✅ Wiadomość przetworzona pomyślnie!',
    received: '📩 Wiadomość odebrana i przetworzona!',
    completed: '🎉 Gotowe!',
  },
};

/**
 * Get a template response
 * @param category - e.g., 'mention', 'restricted', 'error'
 * @param type - e.g., 'default', 'friendly', 'formal'
 * @returns Response text
 */
function getTemplate(category: string, type: string = 'default'): string {
  if (!templates[category]) {
    logger.warn(`Unknown template category: ${category}`);
    return templates.error.generic;
  }

  if (!templates[category][type]) {
    logger.warn(`Unknown template type ${type} for category ${category}`);
    return templates[category].default;
  }

  return templates[category][type];
}

export { templates, getTemplate };
