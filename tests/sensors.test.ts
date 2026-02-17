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
      mockEntity('sensor.temp_bedroom', '18', { friendly_name: 'Bedroom' }),
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
    expect(bedroom?.value).toBeCloseTo(18, 1);
  });

  it('renders correct values with order asc', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18', { friendly_name: 'Bedroom' }),
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
    expect(bedroom?.value).toBeCloseTo(18, 1);

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
      mockEntity('sensor.temp_bedroom', '18', { friendly_name: 'Bedroom' }),
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
      mockEntity('sensor.temp_bedroom', '18', { friendly_name: 'Bedroom' }),
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
      mockEntity('sensor.temp_bedroom', '18', { friendly_name: 'Bedroom' }),
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
    expect(items.find(i => i.label === 'Bedroom')?.value).toBeCloseTo(18, 1);
    expect(items.find(i => i.label === 'Office')?.value).toBeCloseTo(19.5, 1);
    expect(items.find(i => i.label === 'Kitchen')?.value).toBeCloseTo(20.5, 1);
  });

  it('sorts negative values by actual value, not absolute value', async () => {
    // Bug: -400 was sorting between 1000 and 200 because Math.abs(-400)=400
    // Expected: desc order should be 1000, 200, -400 (largest to smallest actual value)
    const hass = mockHass([
      mockEntity('sensor.power_fridge', '200', { friendly_name: 'Fridge' }),
      mockEntity('sensor.power_microwave', '1000', { friendly_name: 'Microwave' }),
      mockEntity('sensor.power_solar', '-400', { friendly_name: 'Solar' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.power_*'],
      order: 'desc',
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const fridge = items.find(i => i.label === 'Fridge');
    const microwave = items.find(i => i.label === 'Microwave');
    const solar = items.find(i => i.label === 'Solar');

    expect(fridge).toBeDefined();
    expect(microwave).toBeDefined();
    expect(solar).toBeDefined();

    // In desc order: Microwave(1000) first, Fridge(200) second, Solar(-400) last
    const microwavePos = microwave!.y * 1000 + microwave!.x;
    const fridgePos = fridge!.y * 1000 + fridge!.x;
    const solarPos = solar!.y * 1000 + solar!.x;

    expect(microwavePos).toBeLessThan(fridgePos);
    expect(fridgePos).toBeLessThan(solarPos);
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

  it('renders entities with zero values', async () => {
    // Reproduces user report: valve sensors with 0% are not shown
    // https://github.com/user/ha-treemap-card/issues/XX
    const hass = mockHass([
      mockEntity('sensor.valve_living_room', '75', {
        friendly_name: 'Living Room Valve',
        unit_of_measurement: '%',
      }),
      mockEntity('sensor.valve_bedroom', '50', {
        friendly_name: 'Bedroom Valve',
        unit_of_measurement: '%',
      }),
      mockEntity('sensor.valve_kitchen', '0', {
        friendly_name: 'Kitchen Valve',
        unit_of_measurement: '%',
      }),
      mockEntity('sensor.valve_bathroom', '0', {
        friendly_name: 'Bathroom Valve',
        unit_of_measurement: '%',
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.valve_*'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);

    // All 4 valves should be rendered, including the ones with 0%
    expect(items).toHaveLength(4);
    expect(items.find(i => i.label === 'Living Room Valve')).toBeDefined();
    expect(items.find(i => i.label === 'Bedroom Valve')).toBeDefined();
    expect(items.find(i => i.label === 'Kitchen Valve')).toBeDefined();
    expect(items.find(i => i.label === 'Bathroom Valve')).toBeDefined();

    // Zero-value items should have non-zero dimensions (visible)
    const kitchen = items.find(i => i.label === 'Kitchen Valve');
    const bathroom = items.find(i => i.label === 'Bathroom Valve');
    expect(kitchen!.width).toBeGreaterThan(0);
    expect(kitchen!.height).toBeGreaterThan(0);
    expect(bathroom!.width).toBeGreaterThan(0);
    expect(bathroom!.height).toBeGreaterThan(0);
  });

  it('respects explicit size.min config', async () => {
    const hass = mockHass([
      mockEntity('sensor.large', '100', { friendly_name: 'Large' }),
      mockEntity('sensor.small', '5', { friendly_name: 'Small' }),
      mockEntity('sensor.zero', '0', { friendly_name: 'Zero' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.*'],
      size: { min: 20 }, // Explicit minimum of 20
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(3);

    // All items visible, zero and small get boosted to min
    const large = items.find(i => i.label === 'Large');
    const small = items.find(i => i.label === 'Small');
    const zero = items.find(i => i.label === 'Zero');

    expect(large).toBeDefined();
    expect(small).toBeDefined();
    expect(zero).toBeDefined();

    // Small and zero should have similar sizes (both at min floor)
    const smallArea = small!.width * small!.height;
    const zeroArea = zero!.width * zero!.height;
    expect(smallArea).toBeCloseTo(zeroArea, 0);
  });

  it('respects size.max config to cap outliers', async () => {
    const hass = mockHass([
      mockEntity('sensor.outlier', '1000', { friendly_name: 'Outlier' }),
      mockEntity('sensor.normal_a', '50', { friendly_name: 'Normal A' }),
      mockEntity('sensor.normal_b', '40', { friendly_name: 'Normal B' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.*'],
      size: { max: 100 }, // Cap outlier at 100
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(3);

    // Outlier should be capped, so normal items get reasonable space
    const outlier = items.find(i => i.label === 'Outlier');
    const normalA = items.find(i => i.label === 'Normal A');

    expect(outlier).toBeDefined();
    expect(normalA).toBeDefined();

    // Without cap, outlier would be ~20x larger than normal
    // With cap at 100, outlier is only 2x larger
    const outlierArea = outlier!.width * outlier!.height;
    const normalArea = normalA!.width * normalA!.height;
    const ratio = outlierArea / normalArea;

    // Ratio should be reasonable (< 5x), not extreme (20x)
    expect(ratio).toBeLessThan(5);
  });

  it('allows size.min: 0 to hide zero-value items', async () => {
    const hass = mockHass([
      mockEntity('sensor.visible', '50', { friendly_name: 'Visible' }),
      mockEntity('sensor.hidden', '0', { friendly_name: 'Hidden' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.*'],
      size: { min: 0 }, // Disable smart default, keep zero as zero
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);

    // Zero-value item should be filtered out by squarify (sizeValue = 0)
    expect(items).toHaveLength(1);
    expect(items.find(i => i.label === 'Visible')).toBeDefined();
    expect(items.find(i => i.label === 'Hidden')).toBeUndefined();
  });

  it('respects both size.min and size.max together', async () => {
    const hass = mockHass([
      mockEntity('sensor.outlier', '500', { friendly_name: 'Outlier' }),
      mockEntity('sensor.normal', '50', { friendly_name: 'Normal' }),
      mockEntity('sensor.small', '5', { friendly_name: 'Small' }),
      mockEntity('sensor.zero', '0', { friendly_name: 'Zero' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.*'],
      size: { min: 10, max: 100 }, // Floor at 10, cap at 100
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(4);

    const outlier = items.find(i => i.label === 'Outlier');
    const normal = items.find(i => i.label === 'Normal');
    const small = items.find(i => i.label === 'Small');
    const zero = items.find(i => i.label === 'Zero');

    // All should be visible
    expect(outlier).toBeDefined();
    expect(normal).toBeDefined();
    expect(small).toBeDefined();
    expect(zero).toBeDefined();

    // Outlier (500) capped to 100, normal (50) unchanged
    // So outlier should be ~2x normal, not 10x
    const outlierArea = outlier!.width * outlier!.height;
    const normalArea = normal!.width * normal!.height;
    expect(outlierArea / normalArea).toBeLessThan(4);

    // Small (5) and zero (0) both floored to 10, should be similar size
    const smallArea = small!.width * small!.height;
    const zeroArea = zero!.width * zero!.height;
    expect(smallArea).toBeCloseTo(zeroArea, 0);
  });

  it('renders correct values for entities with duplicate friendly_names', async () => {
    const hass = mockHass([
      mockEntity('sensor.plant_1_moisture', '52', {
        friendly_name: 'Antúrio',
        unit_of_measurement: '%',
      }),
      mockEntity('sensor.plant_2_moisture', '78', {
        friendly_name: 'Antúrio',
        unit_of_measurement: '%',
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.plant_*'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);

    // Both entities should be rendered
    expect(items).toHaveLength(2);

    // Both have the same label, so we need to check that BOTH values exist
    // (not that one value appears twice)
    const values = items.map(i => i.value).sort((a, b) => a - b);
    expect(values[0]).toBeCloseTo(52, 0);
    expect(values[1]).toBeCloseTo(78, 0);
  });

  it('ignores size.min and size.max when size.equal is true', async () => {
    const hass = mockHass([
      mockEntity('sensor.large', '1000', { friendly_name: 'Large' }),
      mockEntity('sensor.medium', '50', { friendly_name: 'Medium' }),
      mockEntity('sensor.small', '5', { friendly_name: 'Small' }),
      mockEntity('sensor.zero', '0', { friendly_name: 'Zero' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.*'],
      size: { equal: true, min: 20, max: 100 }, // min/max should be ignored
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(4);

    // With equal size, all items should have the same area
    const areas = items.map(i => i.width * i.height);
    const avgArea = areas.reduce((a, b) => a + b, 0) / areas.length;

    for (const area of areas) {
      // All areas should be within 1% of average (essentially equal)
      expect(area).toBeCloseTo(avgArea, 0);
    }
  });

  describe('display_precision', () => {
    it('respects entity display_precision from registry', async () => {
      const hass = mockHass([
        mockEntity(
          'sensor.power',
          '34.267',
          { friendly_name: 'Power', unit_of_measurement: 'W' },
          0 // Entity configured for whole numbers in registry
        ),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.power'],
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      // Should respect entity's display_precision: 0 from hass.entities
      expect(valueEl?.textContent).toBe('34 W');
    });

    it('respects entity display_precision of 2', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp', '22.567', { friendly_name: 'Temp', unit_of_measurement: 'C' }, 2),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('22.57 C');
    });

    it('defaults to 1 decimal when no display_precision set', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp', '22.567', {
          friendly_name: 'Temp',
          unit_of_measurement: 'C',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('22.6 C');
    });
  });

  /**
   * Tests for non-numeric entity filtering
   *
   * Home Assistant states for unreachable/non-reporting entities:
   * - "unavailable" - entity cannot be reached (device offline, integration error)
   * - "unknown" - entity state is not known (just started, no data yet)
   * - "none" - null/missing value (less common, appears in some template sensors)
   */
  describe('non-numeric entity filtering', () => {
    it('excludes unavailable entities', async () => {
      const hass = mockHass([
        mockEntity('sensor.battery_living_room', '85', {
          friendly_name: 'Living Room Battery',
          device_class: 'battery',
          unit_of_measurement: '%',
        }),
        mockEntity('sensor.battery_bedroom', '42', {
          friendly_name: 'Bedroom Battery',
          device_class: 'battery',
          unit_of_measurement: '%',
        }),
        // Unavailable sensors (like sensor.driveway_plant_right_battery in real HA)
        mockEntity('sensor.battery_driveway_right', 'unavailable', {
          friendly_name: 'Driveway Plant Right Battery',
          device_class: 'battery',
          unit_of_measurement: '%',
        }),
        mockEntity('sensor.battery_driveway_left', 'unavailable', {
          friendly_name: 'Driveway Plant Left Battery',
          device_class: 'battery',
          unit_of_measurement: '%',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.battery_*'],
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      // Only numeric entities should be shown
      expect(items).toHaveLength(2);
      expect(items.find(i => i.label === 'Living Room Battery')).toBeDefined();
      expect(items.find(i => i.label === 'Bedroom Battery')).toBeDefined();
      expect(items.find(i => i.label === 'Driveway Plant Right Battery')).toBeUndefined();
      expect(items.find(i => i.label === 'Driveway Plant Left Battery')).toBeUndefined();
    });

    it('excludes unknown entities', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp_kitchen', '22.5', {
          friendly_name: 'Kitchen Temp',
          unit_of_measurement: 'C',
        }),
        mockEntity('sensor.temp_garage', 'unknown', {
          friendly_name: 'Garage Temp',
          unit_of_measurement: 'C',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp_*'],
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      expect(items).toHaveLength(1);
      expect(items.find(i => i.label === 'Kitchen Temp')).toBeDefined();
      expect(items.find(i => i.label === 'Garage Temp')).toBeUndefined();
    });

    it('excludes none entities', async () => {
      const hass = mockHass([
        mockEntity('sensor.power_actual', '150', {
          friendly_name: 'Actual Power',
          unit_of_measurement: 'W',
        }),
        mockEntity('sensor.power_template', 'none', {
          friendly_name: 'Template Power',
          unit_of_measurement: 'W',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.power_*'],
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      expect(items).toHaveLength(1);
      expect(items.find(i => i.label === 'Actual Power')).toBeDefined();
      expect(items.find(i => i.label === 'Template Power')).toBeUndefined();
    });

    it('excludes all non-numeric states in mixed scenario', async () => {
      const hass = mockHass([
        mockEntity('sensor.good', '100', { friendly_name: 'Good Sensor' }),
        mockEntity('sensor.unavail', 'unavailable', { friendly_name: 'Unavailable Sensor' }),
        mockEntity('sensor.unknown', 'unknown', { friendly_name: 'Unknown Sensor' }),
        mockEntity('sensor.none', 'none', { friendly_name: 'None Sensor' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      expect(items).toHaveLength(1);
      expect(items.find(i => i.label === 'Good Sensor')).toBeDefined();
    });

    it('includes unavailable entities when filter.unavailable is true', async () => {
      const hass = mockHass([
        mockEntity('sensor.battery_good', '85', {
          friendly_name: 'Good Battery',
          device_class: 'battery',
          unit_of_measurement: '%',
        }),
        mockEntity('sensor.battery_dead', 'unavailable', {
          friendly_name: 'Dead Battery',
          device_class: 'battery',
          unit_of_measurement: '%',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.battery_*'],
        filter: { unavailable: true },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      expect(items).toHaveLength(2);
      expect(items.find(i => i.label === 'Good Battery')).toBeDefined();
      expect(items.find(i => i.label === 'Dead Battery')).toBeDefined();
    });

    it('includes all non-numeric states when filter.unavailable is true', async () => {
      const hass = mockHass([
        mockEntity('sensor.good', '100', { friendly_name: 'Good Sensor' }),
        mockEntity('sensor.unavail', 'unavailable', { friendly_name: 'Unavailable Sensor' }),
        mockEntity('sensor.unknown', 'unknown', { friendly_name: 'Unknown Sensor' }),
        mockEntity('sensor.none', 'none', { friendly_name: 'None Sensor' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
        filter: { unavailable: true },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      expect(items).toHaveLength(4);
    });

    it('displays raw state text for unavailable entities', async () => {
      const hass = mockHass([
        mockEntity('sensor.dead', 'unavailable', {
          friendly_name: 'Dead Sensor',
          unit_of_measurement: '%',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.dead'],
        filter: { unavailable: true },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');

      expect(valueEl?.textContent).toBe('Unavailable');
    });

    it('applies gray color to unavailable entities', async () => {
      const hass = mockHass([
        mockEntity('sensor.dead', 'unavailable', {
          friendly_name: 'Dead Sensor',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.dead'],
        filter: { unavailable: true },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const deadSensor = items.find(i => i.label === 'Dead Sensor');

      expect(deadSensor).toBeDefined();
      // Default gray color #868e96
      expect(deadSensor?.backgroundColor).toContain('rgb(134, 142, 150)');
    });

    it('applies custom color.unavailable to unavailable entities', async () => {
      const hass = mockHass([
        mockEntity('sensor.dead', 'unavailable', {
          friendly_name: 'Dead Sensor',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.dead'],
        filter: { unavailable: true },
        color: { unavailable: '#ff0000' },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);
      const deadSensor = items.find(i => i.label === 'Dead Sensor');

      expect(deadSensor).toBeDefined();
      expect(deadSensor?.backgroundColor).toContain('rgb(255, 0, 0)');
    });

    it('includes unavailable entities when using filter.above', async () => {
      // Bug report: "Unknown" entities not showing when used with filter.above
      // https://github.com/omachala/ha-treemap-card/issues/20
      const hass = mockHass([
        mockEntity('sensor.mqtt_1', '5', { friendly_name: 'MQTT 1' }),
        mockEntity('sensor.mqtt_2', '10', { friendly_name: 'MQTT 2' }),
        mockEntity('sensor.mqtt_3', 'unknown', { friendly_name: 'MQTT Unknown' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.mqtt_*'],
        filter: { unavailable: true, above: 3 },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      // Should include: mqtt_1 (5 > 3), mqtt_2 (10 > 3), and mqtt_unknown (unavailable, should be included)
      expect(items).toHaveLength(3);
      expect(items.find(i => i.label === 'MQTT 1')).toBeDefined();
      expect(items.find(i => i.label === 'MQTT 2')).toBeDefined();
      expect(items.find(i => i.label === 'MQTT Unknown')).toBeDefined();
    });

    it('includes unavailable entities when using filter.below', async () => {
      // This should work (reported as working in issue)
      const hass = mockHass([
        mockEntity('sensor.mqtt_1', '5', { friendly_name: 'MQTT 1' }),
        mockEntity('sensor.mqtt_2', '10', { friendly_name: 'MQTT 2' }),
        mockEntity('sensor.mqtt_3', 'unknown', { friendly_name: 'MQTT Unknown' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.mqtt_*'],
        filter: { unavailable: true, below: 8 },
      });
      card.hass = hass;
      await card.updateComplete;

      const items = getRenderedItems(card);

      // Should include: mqtt_1 (5 < 8), and mqtt_unknown (unavailable, should be included)
      // mqtt_2 (10) should be filtered out
      expect(items).toHaveLength(2);
      expect(items.find(i => i.label === 'MQTT 1')).toBeDefined();
      expect(items.find(i => i.label === 'MQTT Unknown')).toBeDefined();
      expect(items.find(i => i.label === 'MQTT 2')).toBeUndefined();
    });

    it('displays capitalized state text for unavailable entities', async () => {
      // Bug report: raw state shows as "unknown" instead of "Unknown"
      // https://github.com/omachala/ha-treemap-card/issues/20
      const hass = mockHass([
        mockEntity('sensor.dead', 'unknown', {
          friendly_name: 'Dead Sensor',
          unit_of_measurement: '%',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.dead'],
        filter: { unavailable: true },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');

      // Should capitalize like HA does: "Unknown" not "unknown"
      expect(valueEl?.textContent).toBe('Unknown');
    });
  });

  describe('value.precision and value.abbreviate', () => {
    it('formats whole numbers with precision: 0', async () => {
      const hass = mockHass([
        mockEntity('sensor.power', '1234.567', {
          friendly_name: 'Power',
          unit_of_measurement: 'W',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.power'],
        value: { precision: 0 },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('1235 W');
    });

    it('formats 2 decimal places with precision: 2', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp', '22.5', {
          friendly_name: 'Temp',
          unit_of_measurement: 'C',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        value: { precision: 2 },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('22.50 C');
    });

    it('formats abbreviated thousands with abbreviate: true', async () => {
      const hass = mockHass([
        mockEntity('sensor.power', '2345', {
          friendly_name: 'Power',
          unit_of_measurement: 'W',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.power'],
        value: { precision: 1, abbreviate: true },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('2.3k W');
    });

    it('formats abbreviated millions with precision: 2 and abbreviate: true', async () => {
      const hass = mockHass([
        mockEntity('sensor.energy', '1234567', {
          friendly_name: 'Energy',
          unit_of_measurement: 'Wh',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.energy'],
        value: { precision: 2, abbreviate: true },
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('1.23M Wh');
    });

    it('defaults to precision 1 (no entity display_precision)', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp', '22.567', {
          friendly_name: 'Temp',
          unit_of_measurement: 'C',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('22.6 C');
    });

    it('config precision overrides entity display_precision', async () => {
      const hass = mockHass([
        mockEntity(
          'sensor.temp',
          '22.567',
          { friendly_name: 'Temp', unit_of_measurement: 'C' },
          0 // Entity wants whole numbers
        ),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp'],
        value: { precision: 2 }, // Config overrides to 2 decimals
      });
      card.hass = hass;
      await card.updateComplete;

      const shadow = card.shadowRoot;
      const valueEl = shadow?.querySelector('.treemap-value');
      expect(valueEl?.textContent).toBe('22.57 C');
    });
  });
});
