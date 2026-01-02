import { describe, it, expect } from 'vitest';
import { localize } from '../src/localize';
import type { HomeAssistant } from '../src/types';

// Helper to create mock hass with specific language
function mockHass(language: string): HomeAssistant {
  return {
    language,
    states: {},
    callService: async () => {},
    callWS: async <T>() => ({}) as T,
  };
}

describe('localize', () => {
  describe('language detection', () => {
    it('uses English as default when hass is undefined', () => {
      const result = localize(undefined, 'editor.label.title');
      expect(result).toBe('Label');
    });

    it('uses English for en language', () => {
      const result = localize(mockHass('en'), 'editor.label.title');
      expect(result).toBe('Label');
    });

    it('uses German for de language', () => {
      const result = localize(mockHass('de'), 'editor.label.title');
      expect(result).toBe('Bezeichnung');
    });

    it('uses French for fr language', () => {
      const result = localize(mockHass('fr'), 'editor.label.title');
      expect(result).toBe('Libelle');
    });

    it('handles regional variants (e.g., en-US -> en)', () => {
      const result = localize(mockHass('en-US'), 'editor.label.title');
      expect(result).toBe('Label');
    });

    it('handles regional variants for German (de-AT -> de)', () => {
      const result = localize(mockHass('de-AT'), 'editor.label.title');
      expect(result).toBe('Bezeichnung');
    });
  });

  describe('fallback behavior', () => {
    it('falls back to English when key not found in current language', () => {
      // Use a language that doesn't exist
      const result = localize(mockHass('es'), 'editor.label.title');
      expect(result).toBe('Label');
    });

    it('returns the key when translation not found in any language', () => {
      const result = localize(mockHass('en'), 'nonexistent.key.path');
      expect(result).toBe('nonexistent.key.path');
    });

    it('returns key when path leads to object instead of string', () => {
      // 'editor.label' is an object, not a string
      const result = localize(mockHass('en'), 'editor.label');
      expect(result).toBe('editor.label');
    });
  });

  describe('nested key resolution', () => {
    it('resolves deeply nested keys', () => {
      const result = localize(mockHass('en'), 'editor.sparkline.period_24h');
      expect(result).toBe('24 hours');
    });

    it('resolves section title keys', () => {
      const result = localize(mockHass('en'), 'editor.data.title');
      expect(result).toBe('Data');
    });

    it('handles partial path that does not exist', () => {
      const result = localize(mockHass('en'), 'editor.nonexistent.deep.path');
      expect(result).toBe('editor.nonexistent.deep.path');
    });
  });

  describe('edge cases', () => {
    it('handles empty key', () => {
      const result = localize(mockHass('en'), '');
      expect(result).toBe('');
    });

    it('handles single-part key that does not exist', () => {
      const result = localize(mockHass('en'), 'nonexistent');
      expect(result).toBe('nonexistent');
    });
  });
});
