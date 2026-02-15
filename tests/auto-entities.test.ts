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

  it('uses name override from EntityConfig', async () => {
    const hass = mockHass([mockEntity('sensor.power', '100', { friendly_name: 'Power Sensor' })]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.power', name: 'Custom Name' }] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    // Uses name from EntityConfig, overriding friendly_name
    expect(items[0]?.label).toBe('Custom Name');
  });

  it('uses icon override from EntityConfig', async () => {
    const hass = mockHass([
      mockEntity('sensor.power', '100', { friendly_name: 'Power', icon: 'mdi:lightning-bolt' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.power', icon: 'mdi:flash' }] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    // Uses icon from EntityConfig, overriding entity's icon
    expect(items[0]?.icon).toBe('mdi:flash');
  });

  it('uses both name and icon overrides together', async () => {
    const hass = mockHass([
      mockEntity('sensor.power', '100', {
        friendly_name: 'Power Sensor',
        icon: 'mdi:lightning-bolt',
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: [
        { entity: 'sensor.power', name: 'Custom Label', icon: 'mdi:flash' },
      ] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe('Custom Label');
    expect(items[0]?.icon).toBe('mdi:flash');
  });

  it('falls back to entity values when no override provided', async () => {
    const hass = mockHass([
      mockEntity('sensor.power', '100', {
        friendly_name: 'Power Sensor',
        icon: 'mdi:lightning-bolt',
      }),
    ]);

    // EntityConfig without name/icon - should use entity's values
    card.setConfig({
      type: 'custom:treemap-card',
      entities: [{ entity: 'sensor.power' }] as unknown as string[],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe('Power Sensor');
    expect(items[0]?.icon).toBe('mdi:lightning-bolt');
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

  it('per-entity icon override takes priority over global icon.icon', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_living', '22.5', { friendly_name: 'Living Room' }),
      mockEntity('sensor.temp_bedroom', '20', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: [
        { entity: 'sensor.temp_living', icon: 'mdi:thermometer' },
        'sensor.temp_bedroom',
      ] as unknown as string[],
      icon: { icon: 'mdi:home' }, // Global icon
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);

    // Entity with override should use its icon, not global
    const living = items.find(i => i.label === 'Living Room');
    expect(living?.icon).toBe('mdi:thermometer');

    // Entity without override should use global icon
    const bedroom = items.find(i => i.label === 'Bedroom');
    expect(bedroom?.icon).toBe('mdi:home');
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
