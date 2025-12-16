/**
 * Integration tests for light entities
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('Light Entities', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  it('renders light with RGB color', async () => {
    const hass = mockHass([
      mockEntity('light.living_room', 'on', {
        friendly_name: 'Living Room',
        brightness: 204,
        rgb_color: [255, 0, 0],
        color_mode: 'rgb',
        supported_color_modes: ['rgb', 'brightness'],
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['light.living_room'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);

    const light = items[0];
    expect(light?.label).toBe('Living Room');
    expect(light?.value).toBeCloseTo(80, 0);
    expect(light?.backgroundColor).toMatch(/rgba?\(255,\s*0,\s*0/);
  });

  it('renders light with HS color', async () => {
    const hass = mockHass([
      mockEntity('light.bedroom', 'on', {
        friendly_name: 'Bedroom',
        brightness: 255,
        hs_color: [240, 100],
        color_mode: 'hs',
        supported_color_modes: ['hs'],
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['light.bedroom'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const light = items[0];

    expect(light?.value).toBeCloseTo(100, 0);
    expect(light?.backgroundColor).toMatch(/rgba?\(0,\s*0,\s*255|hsl\(240/);
  });

  it('renders dimmable-only light using gradient', async () => {
    const hass = mockHass([
      mockEntity('light.hallway', 'on', {
        friendly_name: 'Hallway',
        brightness: 127,
        color_mode: 'brightness',
        supported_color_modes: ['brightness'],
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['light.hallway'],
      color: { low: '#0000ff', high: '#ffff00' },
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const light = items[0];

    expect(light?.value).toBeCloseTo(50, 0);
    expect(light?.backgroundColor).toBeDefined();
  });

  it('renders off light using low color', async () => {
    const hass = mockHass([
      mockEntity('light.kitchen', 'off', {
        friendly_name: 'Kitchen',
        supported_color_modes: ['brightness', 'rgb'],
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['light.kitchen'],
      color: { low: '#333333', high: '#ffffff' },
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const light = items[0];

    expect(light?.value).toBe(0);
    expect(light?.backgroundColor).toMatch(/#333|rgb\(51,\s*51,\s*51\)/i);
  });

  it('sizes squares based on brightness', async () => {
    const hass = mockHass([
      mockEntity('light.bright', 'on', {
        friendly_name: 'Bright',
        brightness: 255,
        supported_color_modes: ['brightness'],
      }),
      mockEntity('light.dim', 'on', {
        friendly_name: 'Dim',
        brightness: 64,
        supported_color_modes: ['brightness'],
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['light.*'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const bright = items.find(i => i.label === 'Bright');
    const dim = items.find(i => i.label === 'Dim');

    const brightArea = bright!.width * bright!.height;
    const dimArea = dim!.width * dim!.height;
    expect(brightArea).toBeGreaterThan(dimArea);
  });

  it('handles mixed sensor and light entities', async () => {
    const hass = mockHass([
      mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      mockEntity('light.lamp', 'on', {
        friendly_name: 'Lamp',
        brightness: 200,
        rgb_color: [0, 255, 0],
        supported_color_modes: ['rgb'],
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temperature', 'light.lamp'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);

    expect(items.find(i => i.label === 'Temperature')?.value).toBeCloseTo(22.5, 1);
    expect(items.find(i => i.label === 'Lamp')?.value).toBeCloseTo(78, 0);
  });
});
