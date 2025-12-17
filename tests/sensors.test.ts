/**
 * Integration tests for sensor entities
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('Sensor Entities', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  it('renders correct values for entities', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const bathroom = items.find(i => i.label === 'Bathroom');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bedroom = items.find(i => i.label === 'Bedroom');

    expect(bathroom?.value).toBeCloseTo(22.3, 1);
    expect(kitchen?.value).toBeCloseTo(20.5, 1);
    expect(bedroom?.value).toBeCloseTo(18.0, 1);
  });

  it('renders correct values with order asc', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
      order: 'asc',
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const bathroom = items.find(i => i.label === 'Bathroom');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bedroom = items.find(i => i.label === 'Bedroom');

    expect(bathroom?.value).toBeCloseTo(22.3, 1);
    expect(kitchen?.value).toBeCloseTo(20.5, 1);
    expect(bedroom?.value).toBeCloseTo(18.0, 1);

    // With asc, smallest should be first (top-left)
    const bedroomPos = bedroom!.y * 1000 + bedroom!.x;
    const kitchenPos = kitchen!.y * 1000 + kitchen!.x;
    const bathroomPos = bathroom!.y * 1000 + bathroom!.x;

    expect(bedroomPos).toBeLessThan(kitchenPos);
    expect(kitchenPos).toBeLessThan(bathroomPos);
  });

  it('renders correct positions with order desc', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
      order: 'desc',
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const bathroom = items.find(i => i.label === 'Bathroom');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bedroom = items.find(i => i.label === 'Bedroom');

    const bedroomPos = bedroom!.y * 1000 + bedroom!.x;
    const kitchenPos = kitchen!.y * 1000 + kitchen!.x;
    const bathroomPos = bathroom!.y * 1000 + bathroom!.x;

    expect(bathroomPos).toBeLessThan(kitchenPos);
    expect(kitchenPos).toBeLessThan(bedroomPos);
  });

  it('renders correct positions with size.inverse and order asc', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
      size: { inverse: true },
      order: 'asc',
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const bathroom = items.find(i => i.label === 'Bathroom');
    const bedroom = items.find(i => i.label === 'Bedroom');

    // With size.inverse, smallest value gets biggest area
    const bedroomArea = bedroom!.width * bedroom!.height;
    const bathroomArea = bathroom!.width * bathroom!.height;
    expect(bedroomArea).toBeGreaterThan(bathroomArea);

    // With order asc, smallest value appears first
    const bedroomPos = bedroom!.y * 1000 + bedroom!.x;
    const bathroomPos = bathroom!.y * 1000 + bathroom!.x;
    expect(bedroomPos).toBeLessThan(bathroomPos);
  });

  it('respects limit with order asc', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
      mockEntity('sensor.temp_office', '19.5', { friendly_name: 'Office' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
      order: 'asc',
      limit: 3,
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);

    expect(items).toHaveLength(3);
    expect(items.find(i => i.label === 'Bathroom')).toBeUndefined();
    expect(items.find(i => i.label === 'Bedroom')?.value).toBeCloseTo(18.0, 1);
    expect(items.find(i => i.label === 'Office')?.value).toBeCloseTo(19.5, 1);
    expect(items.find(i => i.label === 'Kitchen')?.value).toBeCloseTo(20.5, 1);
  });

  it('boosts very small values with size.inverse', async () => {
    // Test the minFloor logic (line 521): when size.inverse produces tiny values,
    // they get boosted to at least 10% of max
    const hass = mockHass([
      mockEntity('sensor.large', '100', { friendly_name: 'Large' }),
      mockEntity('sensor.tiny', '1', { friendly_name: 'Tiny' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.*'],
      size: { inverse: true },
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);

    // With inverse, small original value (1) should get large size
    // Large original value (100) would get tiny inverted size, but boosted to minFloor
    const large = items.find(i => i.label === 'Large');
    const tiny = items.find(i => i.label === 'Tiny');

    expect(large).toBeDefined();
    expect(tiny).toBeDefined();
    // Both should have reasonable areas (large shouldn't be invisible)
    expect(large!.width * large!.height).toBeGreaterThan(0);
    expect(tiny!.width * tiny!.height).toBeGreaterThan(0);
  });

  it('displays custom header title', async () => {
    const hass = mockHass([mockEntity('sensor.temp', '22', { friendly_name: 'Temperature' })]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp'],
      header: {
        title: 'My Custom Header',
      },
    });
    card.hass = hass;
    await card.updateComplete;

    const shadow = card.shadowRoot;
    const header = shadow?.querySelector('.treemap-header');
    expect(header?.textContent).toBe('My Custom Header');
  });
});
