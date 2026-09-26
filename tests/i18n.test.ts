import { describe, it, expect, afterEach } from 'vitest';
import {
  FALLBACK_LANGUAGE,
  flattenKeys,
  i18n,
  loadLocales,
  missingKeys,
  resolveLanguage,
  t,
} from '../src/utils/i18n.js';

const resources = loadLocales();
const languages = Object.keys(resources);
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Every string of a language, keyed by its dotted path. */
function strings(language: string): Map<string, string> {
  const tree = resources[language].translation as Record<string, unknown>;
  return new Map(
    flattenKeys(tree).map((key) => [
      key,
      String(i18n.getResource(language, 'translation', key)),
    ])
  );
}

/** Group a language's keys by their base key (plural suffix stripped). */
function byBaseKey(values: Map<string, string>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const key of values.keys()) {
    const base = key.replace(PLURAL_SUFFIX, '');
    groups.set(base, [...(groups.get(base) ?? []), key]);
  }
  return groups;
}

/** Interpolation variables used by a base key's forms, except `count`. */
function placeholders(values: Map<string, string>, keys: string[]): string[] {
  const names = new Set<string>();
  for (const key of keys) {
    for (const match of (values.get(key) ?? '').matchAll(/\{\{\s*(\w+)/g)) {
      if (match[1] !== 'count') names.add(match[1]);
    }
  }
  return [...names].sort();
}

afterEach(async () => {
  await i18n.changeLanguage(FALLBACK_LANGUAGE);
});

describe('locale files', () => {
  it('ship English and Polish', () => {
    expect(languages).toEqual(expect.arrayContaining(['en', 'pl']));
  });

  const englishValues = strings(FALLBACK_LANGUAGE);
  const english = byBaseKey(englishValues);

  describe.each(languages)('%s', (language) => {
    const values = strings(language);
    const groups = byBaseKey(values);

    it('has exactly the keys of the English file', () => {
      expect(missingKeys(resources, language)).toEqual([]);
      expect([...groups.keys()].filter((key) => !english.has(key))).toEqual([]);
    });

    it("has every plural form the language's rules need", () => {
      const categories = new Intl.PluralRules(language)
        .resolvedOptions()
        .pluralCategories.map(String)
        .sort();
      for (const [base, keys] of english) {
        if (!keys.some((key) => PLURAL_SUFFIX.test(key))) continue;
        const forms = (groups.get(base) ?? [])
          .map((key) => key.match(PLURAL_SUFFIX)?.[1] ?? '(none)')
          .sort();
        expect(forms, base).toEqual(categories);
      }
    });

    it('uses the same placeholders as English', () => {
      for (const [base, keys] of groups) {
        expect(placeholders(values, keys), base).toEqual(
          placeholders(englishValues, english.get(base) ?? [])
        );
      }
    });

    it('keeps slash command descriptions within Discord limits', () => {
      for (const [key, value] of values) {
        if (!/^commands\.\w+\.(description|options\.\w+)$/.test(key)) continue;
        expect(value.length, key).toBeGreaterThan(0);
        expect(value.length, key).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe('resolveLanguage', () => {
  const available = ['en', 'pl'];

  it('returns an available code in any case or separator', () => {
    expect(resolveLanguage('pl', available)).toBe('pl');
    expect(resolveLanguage(' PL ', available)).toBe('pl');
    expect(resolveLanguage('pl-PL', available)).toBe('pl');
    expect(resolveLanguage('pl_PL', available)).toBe('pl');
  });

  it('prefers a regional file over its base language', () => {
    expect(resolveLanguage('pt_br', ['en', 'pt', 'pt-BR'])).toBe('pt-BR');
  });

  it('falls back to English when unset or unknown', () => {
    expect(resolveLanguage(undefined, available)).toBe('en');
    expect(resolveLanguage('', available)).toBe('en');
    expect(resolveLanguage('xx', available)).toBe('en');
  });
});

describe('missingKeys', () => {
  it('lists English keys a language lacks, plural keys once', () => {
    const partial = {
      en: { translation: { a: 'A', b: { c_one: 'C', c_other: 'Cs' }, d: 'D' } },
      xx: { translation: { a: 'x', d: 'y' } },
    };
    expect(missingKeys(partial, 'xx')).toEqual(['b.c']);
  });
});

describe('t', () => {
  it('falls back to English for a key the language lacks', async () => {
    i18n.addResourceBundle('xx', 'translation', {
      commands: { help: { title: 'XX help' } },
    });
    await i18n.changeLanguage('xx');
    expect(t('commands.help.title')).toBe('XX help');
    expect(t('commands.help.note.name')).toBe(
      i18n.getResource('en', 'translation', 'commands.help.note.name')
    );
    i18n.removeResourceBundle('xx', 'translation');
  });

  it('picks English plural forms', () => {
    expect(t('commands.warnings.own.count', { count: 1 })).toBe(
      'You have **1** active warning.'
    );
    expect(t('commands.warnings.own.count', { count: 2 })).toBe(
      'You have **2** active warnings.'
    );
  });

  it('picks Polish plural forms', async () => {
    await i18n.changeLanguage('pl');
    const own = (count: number) => t('commands.warnings.own.count', { count });
    expect(own(1)).toBe('Masz **1** aktywne ostrzeżenie.');
    expect(own(3)).toBe('Masz **3** aktywne ostrzeżenia.');
    expect(own(5)).toBe('Masz **5** aktywnych ostrzeżeń.');
    expect(own(12)).toBe('Masz **12** aktywnych ostrzeżeń.');
    expect(own(22)).toBe('Masz **22** aktywne ostrzeżenia.');
  });

  it('formats numbers and dates for the language', async () => {
    const date = new Date(2026, 8, 26);
    const overview = () =>
      t('commands.stats.embed.overview.value', {
        messages: 12345,
        users: 7,
        avgMs: 1066.45,
      });

    expect(t('commands.warnings.issued', { date })).toBe('**Issued:** 9/26/2026');
    expect(overview()).toContain('12,345');
    expect(overview()).toContain('1,066ms');

    await i18n.changeLanguage('pl');
    expect(t('commands.warnings.issued', { date })).toBe('**Wydano:** 26.09.2026');
    expect(overview()).toContain('12\u00a0345');
  });

  it('inserts values verbatim', () => {
    const reason = '<b>&"x"</b> $t(commands.help.title) {{reason}}';
    expect(t('commands.warnings.reason', { reason })).toBe(`**Reason:** ${reason}`);
  });
});
