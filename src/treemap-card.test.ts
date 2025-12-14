import { describe, expect, it, beforeEach } from 'vitest';
import { TreemapCard } from './treemap-card';
import type { HomeAssistant, HassEntity } from './types';

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
      unit_of_measurement: 'C',
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
  x: number;
  y: number;
  width: number;
  height: number;
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
    const style = (item as HTMLElement).style;

    const label = labelEl?.textContent || '';
    const valueText = valueEl?.textContent || '';
    const value = parseFloat(valueText);

    // Extract position from inline style (e.g., "left: calc(0% + 2px)")
    const leftMatch = /left:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const topMatch = /top:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const widthMatch = /width:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const heightMatch = /height:\s*calc\(([0-9.]+)%/.exec(style.cssText);

    result.push({
      label,
      value,
      x: leftMatch?.[1] ? parseFloat(leftMatch[1]) : 0,
      y: topMatch?.[1] ? parseFloat(topMatch[1]) : 0,
      width: widthMatch?.[1] ? parseFloat(widthMatch[1]) : 0,
      height: heightMatch?.[1] ? parseFloat(heightMatch[1]) : 0,
    });
  }

  return result;
}

describe('TreemapCard Integration', () => {
  let card: TreemapCard;

  beforeEach(() => {
    // Register custom element if not already
    if (!customElements.get('treemap-card')) {
      customElements.define('treemap-card', TreemapCard);
    }
    card = new TreemapCard();
    document.body.appendChild(card);
  });

  it('renders correct values for entities without sorting', async () => {
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

    // Find each room and verify its value matches the sensor
    const bathroom = items.find(i => i.label === 'Bathroom');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bedroom = items.find(i => i.label === 'Bedroom');

    expect(bathroom).toBeDefined();
    expect(kitchen).toBeDefined();
    expect(bedroom).toBeDefined();

    expect(bathroom?.value).toBeCloseTo(22.3, 1);
    expect(kitchen?.value).toBeCloseTo(20.5, 1);
    expect(bedroom?.value).toBeCloseTo(18.0, 1);
  });

  it('renders correct values when order is asc', async () => {
    // This test reproduces the bug: when order=asc, values get mixed up
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
      order: 'asc', // BUG: this causes values to be mismatched with labels
    });
    card.hass = hass;

    await card.updateComplete;

    const items = getRenderedItems(card);

    // Each label MUST show its correct value, regardless of sort order
    const bathroom = items.find(i => i.label === 'Bathroom');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bedroom = items.find(i => i.label === 'Bedroom');

    expect(bathroom).toBeDefined();
    expect(kitchen).toBeDefined();
    expect(bedroom).toBeDefined();

    // THE BUG: with order=asc, Bathroom shows 18.0 instead of 22.3
    expect(bathroom?.value).toBeCloseTo(22.3, 1);
    expect(kitchen?.value).toBeCloseTo(20.5, 1);
    expect(bedroom?.value).toBeCloseTo(18.0, 1);

    // Verify position order: with asc, smallest values should appear first (top-left)
    // Bedroom (18.0) should be in top-left, Bathroom (22.3) should be later
    // Position is determined by y first, then x
    const bedroomPos = bedroom!.y * 1000 + bedroom!.x;
    const kitchenPos = kitchen!.y * 1000 + kitchen!.x;
    const bathroomPos = bathroom!.y * 1000 + bathroom!.x;

    // With asc: Bedroom (smallest) should be first, Bathroom (largest) should be last
    expect(bedroomPos).toBeLessThan(kitchenPos);
    expect(kitchenPos).toBeLessThan(bathroomPos);
  });

  it('renders correct positions when order is desc (default)', async () => {
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
      order: 'desc', // Default: largest first
    });
    card.hass = hass;

    await card.updateComplete;

    const items = getRenderedItems(card);

    const bathroom = items.find(i => i.label === 'Bathroom');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bedroom = items.find(i => i.label === 'Bedroom');

    // Verify position order: with desc, largest values should appear first (top-left)
    // Bathroom (22.3) should be in top-left, Bedroom (18.0) should be later
    const bedroomPos = bedroom!.y * 1000 + bedroom!.x;
    const kitchenPos = kitchen!.y * 1000 + kitchen!.x;
    const bathroomPos = bathroom!.y * 1000 + bathroom!.x;

    expect(bathroomPos).toBeLessThan(kitchenPos);
    expect(kitchenPos).toBeLessThan(bedroomPos);
  });

  it('renders correct positions when order is asc with size.inverse', async () => {
    // This test reproduces the bug:
    // - size.inverse: true → smallest value gets BIGGEST square (works)
    // - order: asc → smallest values should appear FIRST (top-left) (broken)
    //
    // Currently: smallest value (18.0) gets big square but appears bottom-right
    // Expected: smallest value (18.0) gets big square AND appears top-left
    const hass = mockHass([
      mockEntity('sensor.temp_bathroom', '22.3', { friendly_name: 'Bathroom' }),
      mockEntity('sensor.temp_kitchen', '20.5', { friendly_name: 'Kitchen' }),
      mockEntity('sensor.temp_bedroom', '18.0', { friendly_name: 'Bedroom' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temp_*'],
      size: { inverse: true }, // Small values get big squares
      order: 'asc', // Small values should appear first (top-left)
    });
    card.hass = hass;

    await card.updateComplete;

    const items = getRenderedItems(card);

    const bathroom = items.find(i => i.label === 'Bathroom');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bedroom = items.find(i => i.label === 'Bedroom');

    expect(bathroom).toBeDefined();
    expect(kitchen).toBeDefined();
    expect(bedroom).toBeDefined();

    // Values must be correct
    expect(bathroom?.value).toBeCloseTo(22.3, 1);
    expect(kitchen?.value).toBeCloseTo(20.5, 1);
    expect(bedroom?.value).toBeCloseTo(18.0, 1);

    // With size.inverse, Bedroom (smallest value) should have the BIGGEST area
    const bedroomArea = bedroom!.width * bedroom!.height;
    const bathroomArea = bathroom!.width * bathroom!.height;
    expect(bedroomArea).toBeGreaterThan(bathroomArea);

    // With order: asc, Bedroom (smallest value) should be FIRST (top-left position)
    // Position is determined by y first, then x
    const bedroomPos = bedroom!.y * 1000 + bedroom!.x;
    const kitchenPos = kitchen!.y * 1000 + kitchen!.x;
    const bathroomPos = bathroom!.y * 1000 + bathroom!.x;

    // Bedroom (smallest) first, Bathroom (largest) last
    expect(bedroomPos).toBeLessThan(kitchenPos);
    expect(kitchenPos).toBeLessThan(bathroomPos);
  });

  it('renders correct values when order is asc with limit', async () => {
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
      limit: 3, // Only show 3 lowest
    });
    card.hass = hass;

    await card.updateComplete;

    const items = getRenderedItems(card);

    // With asc + limit 3, should show: Bedroom (18.0), Office (19.5), Kitchen (20.5)
    // Bathroom (22.3) should be excluded as it's the highest
    expect(items).toHaveLength(3);

    const bedroom = items.find(i => i.label === 'Bedroom');
    const office = items.find(i => i.label === 'Office');
    const kitchen = items.find(i => i.label === 'Kitchen');
    const bathroom = items.find(i => i.label === 'Bathroom');

    expect(bathroom).toBeUndefined(); // Excluded by limit
    expect(bedroom).toBeDefined();
    expect(office).toBeDefined();
    expect(kitchen).toBeDefined();

    // Values must match their labels
    expect(bedroom?.value).toBeCloseTo(18.0, 1);
    expect(office?.value).toBeCloseTo(19.5, 1);
    expect(kitchen?.value).toBeCloseTo(20.5, 1);
  });
});

describe('TreemapCard JSON Entity Mode', () => {
  let card: TreemapCard;

  beforeEach(() => {
    if (!customElements.get('treemap-card')) {
      customElements.define('treemap-card', TreemapCard);
    }
    card = new TreemapCard();
    document.body.appendChild(card);
  });

  it('renders correct values from JSON attribute with different size/value params', async () => {
    // Simulates stock portfolio: display todayPct but size by dollar value
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '3', {
        holdings,
        friendly_name: 'Portfolio',
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct', suffix: ' %' },
      size: { param: 'value' },
    });
    card.hass = hass;

    await card.updateComplete;

    const items = getRenderedItems(card);

    expect(items).toHaveLength(3);

    // Each stock must show its correct todayPct, NOT the dollar value
    const aapl = items.find(i => i.label === 'AAPL');
    const msft = items.find(i => i.label === 'MSFT');
    const nvda = items.find(i => i.label === 'NVDA');

    expect(aapl).toBeDefined();
    expect(msft).toBeDefined();
    expect(nvda).toBeDefined();

    // THE BUG: without fix, AAPL shows 5000 instead of -2.5
    expect(aapl?.value).toBeCloseTo(-2.5, 1);
    expect(msft?.value).toBeCloseTo(1.2, 1);
    expect(nvda?.value).toBeCloseTo(-5.7, 1);
  });

  it('renders correct values with order asc in JSON mode', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
      { ticker: 'GOOG', todayPct: 0.5, value: 2000 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '4', {
        holdings,
        friendly_name: 'Portfolio',
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct' },
      size: { param: 'value' },
      order: 'asc', // Sort by size (dollar value) ascending
    });
    card.hass = hass;

    await card.updateComplete;

    const items = getRenderedItems(card);

    expect(items).toHaveLength(4);

    // Values must still match their labels regardless of sort order
    const aapl = items.find(i => i.label === 'AAPL');
    const msft = items.find(i => i.label === 'MSFT');
    const nvda = items.find(i => i.label === 'NVDA');
    const goog = items.find(i => i.label === 'GOOG');

    expect(aapl?.value).toBeCloseTo(-2.5, 1);
    expect(msft?.value).toBeCloseTo(1.2, 1);
    expect(nvda?.value).toBeCloseTo(-5.7, 1);
    expect(goog?.value).toBeCloseTo(0.5, 1);
  });

  it('renders correct values with order asc and limit in JSON mode', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
      { ticker: 'GOOG', todayPct: 0.5, value: 2000 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '4', {
        holdings,
        friendly_name: 'Portfolio',
      }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct' },
      size: { param: 'value' },
      order: 'asc',
      limit: 2, // Only show 2 smallest by dollar value
    });
    card.hass = hass;

    await card.updateComplete;

    const items = getRenderedItems(card);

    // With asc + limit 2, should show: NVDA (700), GOOG (2000)
    // MSFT (3000) and AAPL (5000) excluded
    expect(items).toHaveLength(2);

    const nvda = items.find(i => i.label === 'NVDA');
    const goog = items.find(i => i.label === 'GOOG');
    const aapl = items.find(i => i.label === 'AAPL');
    const msft = items.find(i => i.label === 'MSFT');

    expect(aapl).toBeUndefined();
    expect(msft).toBeUndefined();
    expect(nvda).toBeDefined();
    expect(goog).toBeDefined();

    // Values must match their labels
    expect(nvda?.value).toBeCloseTo(-5.7, 1);
    expect(goog?.value).toBeCloseTo(0.5, 1);
  });
});
