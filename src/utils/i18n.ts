import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next, { type Resource } from 'i18next';
import logger from './logger.js';
import type en from '../locales/en.json';

/**
 * Localization (issue #15).
 *
 * Every user-facing string lives in `src/locales/<code>.json`, where the file
 * name is the language code. The bot speaks the language of the server it
 * serves, set with BOT_LANGUAGE (default English), out of the languages in
 * LANGUAGES. A key the chosen language lacks falls back to English.
 *
 * BOT_LANGUAGE is read straight from the environment, the way the logger reads
 * LOG_LEVEL, because the config module imports this one for its default texts.
 */

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

export const FALLBACK_LANGUAGE = 'en';

/**
 * The languages the bot offers. A file in `src/locales/` whose code is not
 * listed here is not loaded: a translation is offered once its code is added.
 */
export const LANGUAGES = ['en', 'pl'] as const;

export const LOCALES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'locales'
);

// Plural forms are keyed by CLDR category, e.g. `deleted_one`, `deleted_few`.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Read the `<code>.json` of each language in `codes` from `dir` into an i18next resource map. */
export function loadLocales(
  dir: string = LOCALES_DIR,
  codes: readonly string[] = LANGUAGES
): Resource {
  const resources: Resource = {};
  for (const code of codes) {
    resources[code] = {
      translation: JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), 'utf8')),
    };
  }
  return resources;
}

/**
 * Pick the language for a BOT_LANGUAGE value from the available codes: the
 * code itself (any case, `-` or `_`), then its base language (`pl-PL` → `pl`),
 * then English.
 */
export function resolveLanguage(
  requested: string | undefined,
  available: string[]
): string {
  const normalise = (code: string) => code.trim().replace(/_/g, '-').toLowerCase();
  const wanted = normalise(requested ?? '');
  if (!wanted) return FALLBACK_LANGUAGE;

  const find = (code: string) =>
    available.find((candidate) => normalise(candidate) === code);
  const resolved = find(wanted) ?? find(wanted.split('-')[0]);
  if (resolved) return resolved;

  logger.warn(
    `Unknown BOT_LANGUAGE="${requested}" — falling back to "${FALLBACK_LANGUAGE}"`,
    { available }
  );
  return FALLBACK_LANGUAGE;
}

/** Dotted paths of every string in a translation tree. */
export function flattenKeys(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

/** Keys English has and `language` lacks, each plural key counted once. */
export function missingKeys(resources: Resource, language: string): string[] {
  const baseKeys = (code: string) =>
    new Set(
      flattenKeys(
        (resources[code]?.translation ?? {}) as Record<string, unknown>
      ).map((key) => key.replace(PLURAL_SUFFIX, ''))
    );
  const present = baseKeys(language);
  return [...baseKeys(FALLBACK_LANGUAGE)].filter((key) => !present.has(key));
}

const resources = loadLocales();
const language = resolveLanguage(process.env.BOT_LANGUAGE, Object.keys(resources));

export const i18n = i18next.createInstance();
void i18n.init({
  lng: language,
  fallbackLng: FALLBACK_LANGUAGE,
  resources,
  // The resources are already in memory, so initialise synchronously: slash
  // commands translate their descriptions while their modules load.
  initAsync: false,
  // Output goes to Discord, not HTML — escaping would mangle `&`, `<` and quotes.
  interpolation: { escapeValue: false },
});

const untranslated = missingKeys(resources, language);
if (untranslated.length > 0) {
  logger.warn(
    `Language "${language}" is missing ${untranslated.length} translation(s); English is used for them`,
    { keys: untranslated.slice(0, 20) }
  );
}
logger.info('Bot language', { language });

/** Translate a key into the bot's language. */
export const t = i18n.t;

/**
 * One group of the locale files as a flat `key → text` map, in the bot's
 * language with English for any key it lacks. Plural keys keep their suffix.
 * Feeds the dashboard frontend, which does its own lookups.
 */
export function stringsFor(group: string): Record<string, string> {
  const strings: Record<string, string> = {};
  for (const code of new Set([FALLBACK_LANGUAGE, i18n.language])) {
    const tree: unknown = i18n.getResource(code, 'translation', group);
    if (!tree || typeof tree !== 'object') continue;
    for (const key of flattenKeys(tree as Record<string, unknown>)) {
      strings[key] = String(i18n.getResource(code, 'translation', `${group}.${key}`));
    }
  }
  return strings;
}
