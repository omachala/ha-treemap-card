/**
 * Integration tests for auto-entities compatibility
 *
 * Auto-entities passes entities in format: [{ entity: "sensor.foo" }, ...]
 * Treemap-card needs to accept this format alongside string arrays.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('Auto-entities compatibility', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  it('accepts auto-entities object format', async () => {
    const hass = mockHass([
      mockEntity('sensor.power_living', '150', { friendly_name: 'Living Room' }),
      mockEntity('sensor.power_kitchen', '200', { friendly_name: 'Kitchen' }),
    ]);

    // Auto-entities passes entities as objects with 'entity' property
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [
        { entity: 'sensor.power_living' },
        { entity: 'sensor.power_kitchen' },
      ] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);
    expect(items.find(i => i.label === 'Living Room')).toBeDefined();
    expect(items.find(i => i.label === 'Kitchen')).toBeDefined();
  });

  it('accepts auto-entities format with additional options (ignored)', async () => {
    const hass = mockHass([mockEntity('sensor.power', '100', { friendly_name: 'Power Sensor' })]);

    // Auto-entities can pass additional options like 'name', 'icon', etc.
    // These should be ignored by treemap-card (we use our own config)
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [
        { entity: 'sensor.power', name: 'Custom Name', icon: 'mdi:flash' },
      ] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    // Uses friendly_name from entity, not auto-entities' name override
    expect(items[0]?.label).toBe('Power Sensor');
  });

  it('still accepts original string array format', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_a', '22', { friendly_name: 'Temp A' }),
      mockEntity('sensor.temp_b', '24', { friendly_name: 'Temp B' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_a', 'sensor.temp_b'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);
    expect(items.find(i => i.label === 'Temp A')).toBeDefined();
    expect(items.find(i => i.label === 'Temp B')).toBeDefined();
  });

  it('accepts mixed format (string and object)', async () => {
    const hass = mockHass([
      mockEntity('sensor.a', '10', { friendly_name: 'Sensor A' }),
      mockEntity('sensor.b', '20', { friendly_name: 'Sensor B' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.a', { entity: 'sensor.b' }] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);
    expect(items.find(i => i.label === 'Sensor A')).toBeDefined();
    expect(items.find(i => i.label === 'Sensor B')).toBeDefined();
  });

  it('handles empty entities from auto-entities', async () => {
    const hass = mockHass([]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: [] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(0);
  });

  it('wildcards still work with string format', async () => {
    const hass = mockHass([
      mockEntity('sensor.power_a', '100', { friendly_name: 'Power A' }),
      mockEntity('sensor.power_b', '200', { friendly_name: 'Power B' }),
      mockEntity('sensor.temp_c', '22', { friendly_name: 'Temp C' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.power_*'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);
    expect(items.find(i => i.label === 'Power A')).toBeDefined();
    expect(items.find(i => i.label === 'Power B')).toBeDefined();
    expect(items.find(i => i.label === 'Temp C')).toBeUndefined();
  });
});
