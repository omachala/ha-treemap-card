import { describe, expect, it, beforeEach } from 'vitest';
import { TreemapCard } from '../src/treemap-card';
import type { HomeAssistant, HassEntity } from '../src/types';

// Helper to create a mock HA entity
function mockEntity(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {}
): HassEntity {
  return {
    entity_id: entityId,
    state,
    attributes: {
      friendly_name: entityId.split('.').pop()?.replace(/_/g, ' ') || entityId,
      ...attributes,
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
}

// Helper to create mock HomeAssistant object
function mockHass(entities: HassEntity[]): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of entities) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
    callService: async () => {
      // Mock - no-op for tests
    },
  };
}

interface RenderedItem {
  label: string;
  value: number;
  valueText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
}

// Helper to extract rendered values from the card
function getRenderedItems(card: TreemapCard): RenderedItem[] {
  const shadow = card.shadowRoot;
  if (!shadow) return [];

  const items = shadow.querySelectorAll('.treemap-item');
  const result: RenderedItem[] = [];

  for (const item of items) {
    const labelEl = item.querySelector('.treemap-label');
    const valueEl = item.querySelector('.treemap-value');
    if (!(item instanceof HTMLElement)) continue;
    const style = item.style;

    const label = labelEl?.textContent || '';
    const valueText = valueEl?.textContent || '';
    const value = parseFloat(valueText);

    // Extract position from inline style (e.g., "left: calc(0% + 2px)")
    const leftMatch = /left:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const topMatch = /top:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const widthMatch = /width:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const heightMatch = /height:\s*calc\(([0-9.]+)%/.exec(style.cssText);

    // Extract background color from inline style
    const bgMatch = /background(?:-color)?:\s*([^;]+)/.exec(style.cssText);

    result.push({
      label,
      value,
      valueText,
      x: leftMatch?.[1] ? parseFloat(leftMatch[1]) : 0,
      y: topMatch?.[1] ? parseFloat(topMatch[1]) : 0,
      width: widthMatch?.[1] ? parseFloat(widthMatch[1]) : 0,
      height: heightMatch?.[1] ? parseFloat(heightMatch[1]) : 0,
      backgroundColor: bgMatch?.[1]?.trim(),
    });
  }

  return result;
}

// Helper to create a climate entity
function mockClimateEntity(
  name: string,
  currentTemp: number,
  targetTemp: number,
  hvacAction: 'heating' | 'cooling' | 'idle' | 'off' = 'idle',
  hvacMode: 'heat' | 'cool' | 'heat_cool' | 'auto' | 'off' = 'heat'
): HassEntity {
  return mockEntity(`climate.${name}`, hvacMode, {
    friendly_name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    current_temperature: currentTemp,
    temperature: targetTemp,
    hvac_action: hvacAction,
    hvac_mode: hvacMode,
    min_temp: 7,
    max_temp: 35,
    target_temp_step: 0.5,
  });
}

describe('TreemapCard Climate Entities', () => {
  let card: TreemapCard;

  beforeEach(() => {
    if (!customElements.get('treemap-card')) {
      customElements.define('treemap-card', TreemapCard);
    }
    card = new TreemapCard();
    document.body.appendChild(card);
  });

  describe('temp_difference computed value', () => {
    it('calculates absolute difference from target temperature', async () => {
      // Room is 3 degrees below target
      const hass = mockHass([mockClimateEntity('living_room', 18, 21)]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.living_room'],
        value: { attribute: 'temp_difference' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(1);
      // |18 - 21| = 3
      expect(items[0]!.value).toBeCloseTo(3, 1);
    });

    it('calculates zero difference when above target in heat mode (smart offset)', async () => {
      // Room is 2 degrees above target, but in heat mode this is "satisfied" - no action needed
      const hass = mockHass([mockClimateEntity('bedroom', 23, 21, 'idle', 'heat')]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.bedroom'],
        value: { attribute: 'temp_difference' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      // In heat mode, current (23) > target (21) means goal achieved, so temp_offset = 0
      // temp_difference = |temp_offset| = 0
      expect(items[0]!.value).toBeCloseTo(0, 1);
    });

    it('calculates absolute difference when above target in cool mode', async () => {
      // Room is 2 degrees above target, in cool mode this is a problem
      const hass = mockHass([mockClimateEntity('bedroom', 23, 21, 'cooling', 'cool')]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.bedroom'],
        value: { attribute: 'temp_difference' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      // In cool mode, current (23) > target (21) means room is too hot, offset = +2
      // temp_difference = |temp_offset| = 2
      expect(items[0]!.value).toBeCloseTo(2, 1);
    });

    it('shows zero when at target temperature', async () => {
      const hass = mockHass([mockClimateEntity('office', 21, 21)]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.office'],
        value: { attribute: 'temp_difference' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]!.value).toBeCloseTo(0, 1);
    });

    it('sizes rectangles by temp_difference', async () => {
      // All in heat mode: only rooms below target have meaningful temp_difference
      const hass = mockHass([
        mockClimateEntity('living_room', 18, 21, 'heating', 'heat'), // diff = 3 (needs heating)
        mockClimateEntity('bedroom', 20, 21, 'heating', 'heat'), // diff = 1 (needs heating)
        mockClimateEntity('office', 17, 21, 'heating', 'heat'), // diff = 4 (needs most heating)
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.*'],
        size: { attribute: 'temp_difference' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      const office = items.find(i => i.label === 'Office');
      const living = items.find(i => i.label === 'Living Room');
      const bedroom = items.find(i => i.label === 'Bedroom');

      // Office (diff=4) should be largest, Bedroom (diff=1) smallest
      const officeArea = office!.width * office!.height;
      const livingArea = living!.width * living!.height;
      const bedroomArea = bedroom!.width * bedroom!.height;

      expect(officeArea).toBeGreaterThan(livingArea);
      expect(livingArea).toBeGreaterThan(bedroomArea);
    });
  });

  describe('temp_offset computed value', () => {
    it('calculates signed difference (negative when below target)', async () => {
      // Room is 3 degrees below target
      const hass = mockHass([mockClimateEntity('living_room', 18, 21)]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.living_room'],
        value: { attribute: 'temp_offset' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      // 18 - 21 = -3
      expect(items[0]!.value).toBeCloseTo(-3, 1);
    });

    it('calculates zero when above target in heat mode (smart offset)', async () => {
      // Room is 2 degrees above target, but in heat mode this is "satisfied"
      const hass = mockHass([mockClimateEntity('bedroom', 23, 21, 'idle', 'heat')]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.bedroom'],
        value: { attribute: 'temp_offset' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      // In heat mode, current > target means goal achieved, offset = 0
      expect(items[0]!.value).toBeCloseTo(0, 1);
    });

    it('calculates positive offset when above target in cool mode', async () => {
      // Room is 2 degrees above target, in cool mode this matters
      const hass = mockHass([mockClimateEntity('bedroom', 23, 21, 'cooling', 'cool')]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.bedroom'],
        value: { attribute: 'temp_offset' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      // In cool mode, current (23) > target (21) is a problem, offset = +2
      expect(items[0]!.value).toBeCloseTo(2, 1);
    });

    it('colors by temp_offset with blue for cold and red for hot', async () => {
      const hass = mockHass([
        mockClimateEntity('cold_room', 17, 21), // offset = -4
        mockClimateEntity('hot_room', 25, 21), // offset = +4
        mockClimateEntity('perfect_room', 21, 21), // offset = 0
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.*'],
        color: {
          attribute: 'temp_offset',
          low: '#4dabf7', // blue for cold
          mid: '#69db7c', // green for on-target
          high: '#ff6b35', // orange for hot
          scale: {
            neutral: 0,
            min: -5,
            max: 5,
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      const cold = items.find(i => i.label === 'Cold Room');
      const hot = items.find(i => i.label === 'Hot Room');
      const perfect = items.find(i => i.label === 'Perfect Room');

      // Each should have different background colors
      expect(cold?.backgroundColor).toBeDefined();
      expect(hot?.backgroundColor).toBeDefined();
      expect(perfect?.backgroundColor).toBeDefined();

      // Colors should be different from each other
      expect(cold?.backgroundColor).not.toBe(hot?.backgroundColor);
    });
  });

  describe('hvac_action coloring', () => {
    it('colors by hvac_action using custom hvac colors', async () => {
      const hass = mockHass([
        mockClimateEntity('heating_room', 18, 21, 'heating'),
        mockClimateEntity('cooling_room', 24, 21, 'cooling'),
        mockClimateEntity('idle_room', 21, 21, 'idle'),
        mockClimateEntity('off_room', 20, 21, 'off'),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.*'],
        color: {
          attribute: 'hvac_action',
          hvac: {
            heating: '#ff6b35',
            cooling: '#4dabf7',
            idle: '#69db7c',
            off: '#868e96',
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(4);

      // Each should have a background color from the hvac config
      for (const item of items) {
        expect(item.backgroundColor).toBeDefined();
      }
    });

    it('applies opacity to cooling hvac color', async () => {
      const hass = mockHass([mockClimateEntity('cooling_room', 26, 21, 'cooling')]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.cooling_room'],
        color: {
          attribute: 'hvac_action',
          opacity: 0.8,
          hvac: {
            cooling: '#4dabf7',
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(1);
      // Should have rgba color with opacity
      expect(items[0]?.backgroundColor).toMatch(/rgba\(.*,\s*0\.8\)/);
    });

    it('applies opacity to heating hvac color', async () => {
      const hass = mockHass([mockClimateEntity('heating_room', 18, 21, 'heating')]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.heating_room'],
        color: {
          attribute: 'hvac_action',
          opacity: 0.5,
          hvac: {
            heating: '#ff6b35',
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(1);
      // Should have rgba color with opacity
      expect(items[0]?.backgroundColor).toMatch(/rgba\(.*,\s*0\.5\)/);
    });

    it('applies opacity to off hvac mode color', async () => {
      const hass = mockHass([
        mockEntity('climate.off_room', 'off', {
          friendly_name: 'Off Room',
          current_temperature: 20,
          temperature: 21,
          hvac_action: 'off',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.off_room'],
        color: {
          opacity: 0.7,
          hvac: {
            off: '#868e96',
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(1);
      // Should have rgba color with opacity for off state
      expect(items[0]?.backgroundColor).toMatch(/rgba\(.*,\s*0\.7\)/);
    });

    it('applies opacity to unavailable hvac mode color', async () => {
      const hass = mockHass([
        mockEntity('climate.unavailable_room', 'unavailable', {
          friendly_name: 'Unavailable Room',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.unavailable_room'],
        color: {
          opacity: 0.6,
          hvac: {
            off: '#555555',
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(1);
      // Should have rgba color with opacity for unavailable state
      expect(items[0]?.backgroundColor).toMatch(/rgba\(.*,\s*0\.6\)/);
    });
  });

  describe('standard climate attributes', () => {
    it('displays current_temperature as value', async () => {
      const hass = mockHass([mockClimateEntity('living_room', 22.5, 21)]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.living_room'],
        value: {
          attribute: 'current_temperature',
          suffix: ' C',
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]!.value).toBeCloseTo(22.5, 1);
      expect(items[0]!.valueText).toContain('C');
    });

    it('displays target temperature as value', async () => {
      const hass = mockHass([mockClimateEntity('bedroom', 20, 19)]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.bedroom'],
        value: { attribute: 'temperature' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items[0]!.value).toBeCloseTo(19, 1);
    });
  });

  describe('combined climate configuration', () => {
    it('shows rooms needing attention with size by difference and color by offset', async () => {
      // Real-world scenario: highlight rooms that need the most attention
      // Note: smart offset means we need to set hvac mode appropriately
      const hass = mockHass([
        mockClimateEntity('living_room', 18, 21, 'heating', 'heat'), // -3, needs heating
        mockClimateEntity('bedroom', 22, 21, 'idle', 'heat'), // +1 raw but heat mode satisfied = 0
        mockClimateEntity('office', 25, 21, 'cooling', 'cool'), // +4, needs cooling
        mockClimateEntity('bathroom', 21, 21, 'idle', 'heat'), // 0, perfect
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.*'],
        size: {
          attribute: 'temp_difference', // Bigger difference = bigger rectangle
        },
        value: {
          attribute: 'temp_offset',
          suffix: ' C',
        },
        color: {
          attribute: 'temp_offset',
          low: '#4dabf7',
          mid: '#69db7c',
          high: '#ff6b35',
          scale: {
            neutral: 0,
            min: -5,
            max: 5,
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(4);

      const office = items.find(i => i.label === 'Office');
      const living = items.find(i => i.label === 'Living Room');
      const bathroom = items.find(i => i.label === 'Bathroom');
      const bedroom = items.find(i => i.label === 'Bedroom');

      // Values should be the smart offset (HVAC-mode aware)
      expect(office?.value).toBeCloseTo(4, 1); // cool mode, too hot
      expect(living?.value).toBeCloseTo(-3, 1); // heat mode, too cold
      expect(bathroom?.value).toBeCloseTo(0, 1); // at target
      expect(bedroom?.value).toBeCloseTo(0, 1); // heat mode but warm enough = satisfied

      // Office (diff=4) and Living (diff=3) should be larger than bathroom/bedroom (diff=0)
      const officeArea = office!.width * office!.height;
      const bathroomArea = bathroom!.width * bathroom!.height;
      expect(officeArea).toBeGreaterThan(bathroomArea);
    });

    it('shows equal sized rectangles colored by hvac action', async () => {
      const hass = mockHass([
        mockClimateEntity('living_room', 18, 21, 'heating'),
        mockClimateEntity('bedroom', 22, 21, 'cooling'),
        mockClimateEntity('office', 21, 21, 'idle'),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.*'],
        size: { equal: true },
        value: {
          attribute: 'current_temperature',
          suffix: ' C',
        },
        color: {
          attribute: 'hvac_action',
          hvac: {
            heating: '#ff6b35',
            cooling: '#4dabf7',
            idle: '#69db7c',
            off: '#868e96',
          },
        },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(3);

      // All rectangles should be approximately equal size
      const areas = items.map(i => i.width * i.height);
      const avgArea = areas.reduce((a, b) => a + b, 0) / areas.length;
      for (const area of areas) {
        expect(area).toBeCloseTo(avgArea, 0);
      }
    });
  });

  describe('mixed entity types', () => {
    it('handles climate entities alongside sensors', async () => {
      const hass = mockHass([
        mockClimateEntity('thermostat', 20, 21, 'heating'),
        mockEntity('sensor.humidity', '65', {
          friendly_name: 'Humidity',
          unit_of_measurement: '%',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.thermostat', 'sensor.humidity'],
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      expect(items).toHaveLength(2);

      const thermostat = items.find(i => i.label === 'Thermostat');
      const humidity = items.find(i => i.label === 'Humidity');

      expect(thermostat).toBeDefined();
      expect(humidity).toBeDefined();
      expect(humidity?.value).toBeCloseTo(65, 0);
    });
  });

  describe('edge cases', () => {
    it('handles climate entity with unavailable temperature', async () => {
      const hass = mockHass([
        mockEntity('climate.broken', 'unavailable', {
          friendly_name: 'Broken Thermostat',
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.broken'],
        value: { attribute: 'temp_difference' },
      });
      card.hass = hass;

      await card.updateComplete;

      const items = getRenderedItems(card);
      // Should either show 0 or be filtered out gracefully
      expect(items.length).toBeLessThanOrEqual(1);
    });

    it('handles climate entity with only current_temperature (no target)', async () => {
      const hass = mockHass([
        mockEntity('climate.monitor', 'heat', {
          friendly_name: 'Temperature Monitor',
          current_temperature: 22,
          // No target temperature set
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['climate.monitor'],
        value: { attribute: 'temp_difference' },
      });
      card.hass = hass;

      await card.updateComplete;

      // Should handle gracefully - either show 0 or current temp
      const items = getRenderedItems(card);
      expect(items.length).toBeLessThanOrEqual(1);
    });
  });
});
