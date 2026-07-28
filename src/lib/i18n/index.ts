import { DEFAULT_LOCALE, type Locale } from "../types";
import { dictionaries, type Dictionary, type DictionaryKey } from "./dictionaries";

export type { Dictionary, DictionaryKey } from "./dictionaries";

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: DictionaryKey, params?: TranslateParams) => string;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/**
 * Builds a `t()` bound to one locale. Usable from server components directly,
 * and handed to the client through the I18nProvider.
 */
export function createTranslator(locale: Locale): Translate {
  const dictionary = getDictionary(locale);

  return (key, params) => {
    const template = dictionary[key];
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, token: string) =>
      token in params ? String(params[token]) : match,
    );
  };
}

/** Picks the right column for a record that carries both name variants. */
export function localized<T extends { nameEn: string; namePt: string }>(
  record: T,
  locale: Locale,
): string {
  return locale === "pt" ? record.namePt : record.nameEn;
}

export function localizedDescription<T extends { descEn: string; descPt: string }>(
  record: T,
  locale: Locale,
): string {
  return locale === "pt" ? record.descPt : record.descEn;
}

export function localizedLabel<T extends { labelEn: string; labelPt: string }>(
  record: T,
  locale: Locale,
): string {
  return locale === "pt" ? record.labelPt : record.labelEn;
}

/** Intl wrappers so dates and numbers follow the chosen locale too. */
const INTL_LOCALE: Record<Locale, string> = { en: "en-US", pt: "pt-BR" };

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: digits,
  }).format(value);
}
