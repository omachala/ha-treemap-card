/**
 * Integration tests for label configuration (replace, prefix, suffix)
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('Label Configuration', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  describe('label.replace regex', () => {
    it('replaces text using simple pattern', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp_living_room', '22.5', { friendly_name: 'Temperature Living Room' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp_living_room'],
        label: {
          replace: 'Temperature //',
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]?.label).toBe('Living Room');
    });

    it('replaces text using regex pattern', async () => {
      const hass = mockHass([
        mockEntity('sensor.room_1_temp', '22.5', { friendly_name: 'Room 1 Temp' }),
        mockEntity('sensor.room_2_temp', '20.0', { friendly_name: 'Room 2 Temp' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.room_*'],
        label: {
          replace: ' Temp$//',
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items.find(i => i.label === 'Room 1')).toBeDefined();
      expect(items.find(i => i.label === 'Room 2')).toBeDefined();
    });

    it('replaces with replacement text', async () => {
      const hass = mockHass([
        mockEntity('sensor.bedroom_temp', '18.0', { friendly_name: 'Bedroom Temp' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.bedroom_temp'],
        label: {
          replace: 'Temp/Temperature',
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]?.label).toBe('Bedroom Temperature');
    });

    it('supports regex flags', async () => {
      const hass = mockHass([mockEntity('sensor.test', '10', { friendly_name: 'AAA BBB AAA' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.test'],
        label: {
          replace: 'AAA/X/g', // Global replace
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]?.label).toBe('X BBB X');
    });

    it('handles invalid regex gracefully', async () => {
      const hass = mockHass([mockEntity('sensor.test', '10', { friendly_name: 'Test Label' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.test'],
        label: {
          replace: '[invalid//', // Invalid regex
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      // Should fall back to original label
      expect(items[0]?.label).toBe('Test Label');
    });
  });

  describe('label.prefix and label.suffix', () => {
    it('adds prefix to label', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '22.5', { friendly_name: 'Kitchen' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        label: { prefix: 'Room: ' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]?.label).toBe('Room: Kitchen');
    });

    it('adds suffix to label', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '22.5', { friendly_name: 'Kitchen' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        label: { suffix: ' (temp)' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]?.label).toBe('Kitchen (temp)');
    });

    it('combines prefix, suffix, and replace', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp_living', '22.5', { friendly_name: 'Temp Living' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp_living'],
        label: {
          replace: 'Temp //',
          prefix: '[ ',
          suffix: ' ]',
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]?.label).toBe('[ Living ]');
    });
  });

  describe('label.show', () => {
    it('hides label when show is false', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '22.5', { friendly_name: 'Kitchen' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        label: { show: false },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const labelEl = shadow?.querySelector('.treemap-label');
      expect(labelEl).toBeNull();
    });
  });

  describe('value.show', () => {
    it('hides value when show is false', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '22.5', { friendly_name: 'Kitchen' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        value: { show: false },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl).toBeNull();
    });
  });

  describe('icon.show', () => {
    it('hides icon when show is false', async () => {
      const hass = mockHass([
        mockEntity('light.test', 'on', {
          friendly_name: 'Test',
          brightness: 255,
          supported_color_modes: ['brightness'],
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['light.test'],
        icon: { show: false },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const iconEl = shadow?.querySelector('.treemap-icon');
      expect(iconEl).toBeNull();
    });
  });
});
