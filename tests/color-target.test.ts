/**
 * Integration tests for color.apply_to feature
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('color.target', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  describe('target: background (default)', () => {
    it('applies calculated color to background by default', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '50', { friendly_name: 'Temperature' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const temp = items.find(i => i.label === 'Temperature');

      expect(temp).toBeDefined();
      // Background should have the gradient color (not the dark overlay)
      expect(temp?.backgroundColor).not.toBe('rgba(0, 0, 0, 0.1)');
      expect(temp?.backgroundColor).toBeDefined();
    });

    it('applies calculated color to background when explicitly set', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '50', { friendly_name: 'Temperature' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        color: { target: 'background' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const temp = items.find(i => i.label === 'Temperature');

      expect(temp).toBeDefined();
      // Background should have the gradient color
      expect(temp?.backgroundColor).not.toBe('rgba(0, 0, 0, 0.1)');
    });

    it('uses contrast colors for text when apply_to is background', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '50', { friendly_name: 'Temperature' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        color: { target: 'background' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const temp = items.find(i => i.label === 'Temperature');

      // Text should use contrast color (white or black based on bg brightness)
      // Not the calculated gradient color
      expect(temp?.labelColor).toMatch(/rgba?\([^)]+\)/);
    });
  });

  describe('target: foreground', () => {
    it('applies dark overlay to background when apply_to is foreground', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '50', { friendly_name: 'Temperature' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        color: { target: 'foreground' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const temp = items.find(i => i.label === 'Temperature');

      expect(temp).toBeDefined();
      // Background should be the dark overlay
      expect(temp?.backgroundColor).toBe('rgba(0, 0, 0, 0.1)');
    });

    it('applies calculated color to text when apply_to is foreground', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp_high', '100', { friendly_name: 'High Temp' }),
        mockEntity('sensor.temp_low', '0', { friendly_name: 'Low Temp' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp_*'],
        color: {
          target: 'foreground',
          low: '#ff0000',
          high: '#00ff00',
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const highTemp = items.find(i => i.label === 'High Temp');
      const lowTemp = items.find(i => i.label === 'Low Temp');

      // Both should have dark overlay background
      expect(highTemp?.backgroundColor).toBe('rgba(0, 0, 0, 0.1)');
      expect(lowTemp?.backgroundColor).toBe('rgba(0, 0, 0, 0.1)');

      // Text colors should be the gradient colors (as configured above)
      // High value should have green color (#00ff00)
      expect(highTemp?.labelColor).toContain('rgb(0, 255, 0)');
      expect(highTemp?.valueColor).toContain('rgb(0, 255, 0)');

      // Low value should have red color (#ff0000)
      expect(lowTemp?.labelColor).toContain('rgb(255, 0, 0)');
      expect(lowTemp?.valueColor).toContain('rgb(255, 0, 0)');
    });

    it('applies same color to label, value and icon when foreground', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp', '75', {
          friendly_name: 'Temperature',
          icon: 'mdi:thermometer',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        color: { target: 'foreground' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const temp = items.find(i => i.label === 'Temperature');

      expect(temp).toBeDefined();
      // All text elements should have the same calculated color
      expect(temp?.labelColor).toBe(temp?.valueColor);
      expect(temp?.labelColor).toBe(temp?.iconColor);
    });
  });

  describe('foreground with special entity types', () => {
    it('works with light entities', async () => {
      const hass = mockHass([
        mockEntity('light.living_room', 'on', {
          friendly_name: 'Living Room',
          brightness: 255,
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['light.living_room'],
        color: { target: 'foreground' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const light = items.find(i => i.label === 'Living Room');

      // Background should be dark overlay
      expect(light?.backgroundColor).toBe('rgba(0, 0, 0, 0.1)');
      // Text should have the light's calculated color
      expect(light?.labelColor).toBeDefined();
    });

    it('works with climate entities', async () => {
      const hass = mockHass([
        mockEntity('climate.thermostat', 'heat', {
          friendly_name: 'Thermostat',
          current_temperature: 22,
          temperature: 24,
          hvac_action: 'heating',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.thermostat'],
        color: {
          target: 'foreground',
          hvac: { heating: '#ff6b35' },
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const thermostat = items.find(i => i.label === 'Thermostat');

      // Background should be dark overlay
      expect(thermostat?.backgroundColor).toBe('rgba(0, 0, 0, 0.1)');
      // Text should have the HVAC heating color
      expect(thermostat?.labelColor).toContain('rgb(255, 107, 53)'); // #ff6b35
    });

    it('works with unavailable entities', async () => {
      const hass = mockHass([
        mockEntity('sensor.offline', 'unavailable', { friendly_name: 'Offline' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.offline'],
        filter: { unavailable: true },
        color: {
          target: 'foreground',
          unavailable: '#868e96',
        },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const offline = items.find(i => i.label === 'Offline');

      // Background should be dark overlay
      expect(offline?.backgroundColor).toBe('rgba(0, 0, 0, 0.1)');
      // Text should have unavailable gray color
      expect(offline?.labelColor).toContain('rgb(134, 142, 150)'); // #868e96
    });
  });

  describe('foreground with custom styles', () => {
    it('custom style overrides foreground color', async () => {
      const hass = mockHass([mockEntity('sensor.temp', '50', { friendly_name: 'Temperature' })]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        color: { target: 'foreground' },
        label: { style: 'color: purple;' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const temp = items.find(i => i.label === 'Temperature');

      // Custom style should override the calculated foreground color
      expect(temp?.labelColor).toBe('purple');
      // Value should still use the calculated color
      expect(temp?.valueColor).not.toBe('purple');
    });
  });
});
