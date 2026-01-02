/**
 * Localization helper for treemap-card
 *
 * Uses Home Assistant's language setting with English fallback.
 */

import type { HomeAssistant } from './types';
import * as de from './translations/de.json';
import * as en from './translations/en.json';
import * as fr from './translations/fr.json';

// Type for nested translation object
interface TranslationObject {
  [key: string]: string | TranslationObject;
}

// Available translations - automatically selected based on hass.language
const translations: Record<string, TranslationObject> = {
  de,
  en,
  fr,
};

/**
 * Check if value is a translation object (not a string)
 */
function isTranslationObject(value: string | TranslationObject): value is TranslationObject {
  return typeof value === 'object' && value !== null;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: TranslationObject, path: string): string | undefined {
  const keys = path.split('.');
  let current: string | TranslationObject | undefined = obj;

  for (const key of keys) {
    if (current && isTranslationObject(current) && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Get the language code from Home Assistant
 * Falls back to 'en' if not available
 */
function getLanguage(hass?: HomeAssistant): string {
  // HA provides language in hass.language (e.g., 'en', 'de', 'fr')
  const lang = hass?.language ?? 'en';
  // Handle regional variants (e.g., 'en-US' -> 'en')
  return lang.split('-')[0] ?? 'en';
}

/**
 * Localize a string using the current language
 *
 * @param hass - Home Assistant instance (for language detection)
 * @param key - Translation key using dot notation (e.g., 'editor.label.title')
 * @returns Translated string or the key if not found
 *
 * @example
 * localize(hass, 'editor.label.title') // Returns 'Label' in English
 */
export function localize(hass: HomeAssistant | undefined, key: string): string {
  const lang = getLanguage(hass);

  // Try the current language
  const langTranslations = translations[lang];
  if (langTranslations) {
    const value = getNestedValue(langTranslations, key);
    if (value) return value;
  }

  // Fall back to English
  if (lang !== 'en') {
    const enTranslations = translations['en'];
    if (enTranslations) {
      const value = getNestedValue(enTranslations, key);
      if (value) return value;
    }
  }

  // Return the key if no translation found (helps debugging)
  return key;
}
