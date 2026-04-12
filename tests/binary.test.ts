/**
 * Integration tests for binary entities (switch, input_boolean, binary_sensor)
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('Binary Entities', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  it('renders switch.* entity that is on', async () => {
    const hass = mockHass([
      mockEntity('switch.garden_lights', 'on', { friendly_name: 'Garden Lights' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['switch.garden_lights'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe('Garden Lights');
    expect(items[0]?.displayValue).toBe('On');
  });

  it('renders switch.* entity that is off', async () => {
    const hass = mockHass([mockEntity('switch.fan', 'off', { friendly_name: 'Fan' })]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['switch.fan'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    expect(items[0]?.displayValue).toBe('Off');
  });

  it('renders input_boolean entity', async () => {
    const hass = mockHass([
      mockEntity('input_boolean.vacation_mode', 'on', { friendly_name: 'Vacation Mode' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['input_boolean.vacation_mode'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe('Vacation Mode');
    expect(items[0]?.displayValue).toBe('On');
  });

  it('renders binary_sensor entity', async () => {
    const hass = mockHass([
      mockEntity('binary_sensor.front_door', 'off', { friendly_name: 'Front Door' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['binary_sensor.front_door'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe('Front Door');
    expect(items[0]?.displayValue).toBe('Off');
  });

  it('uses high color for on and low color for off', async () => {
    const hass = mockHass([
      mockEntity('switch.on_switch', 'on', { friendly_name: 'On Switch' }),
      mockEntity('switch.off_switch', 'off', { friendly_name: 'Off Switch' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['switch.on_switch', 'switch.off_switch'],
      color: { low: '#111111', high: '#aabbcc' },
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    const onItem = items.find(i => i.label === 'On Switch');
    const offItem = items.find(i => i.label === 'Off Switch');

    // Browser normalizes hex colors to rgb(); match either form
    expect(onItem?.backgroundColor).toMatch(/#aabbcc|rgb\(170,\s*187,\s*204\)/i);
    expect(offItem?.backgroundColor).toMatch(/#111111|rgb\(17,\s*17,\s*17\)/i);
  });

  it('sizes all binary tiles equally', async () => {
    const hass = mockHass([
      mockEntity('switch.sw1', 'on', { friendly_name: 'SW1' }),
      mockEntity('switch.sw2', 'off', { friendly_name: 'SW2' }),
      mockEntity('switch.sw3', 'on', { friendly_name: 'SW3' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['switch.sw1', 'switch.sw2', 'switch.sw3'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(3);

    const areas = items.map(i => i.width * i.height);
    // All tiles should have approximately equal area
    const maxArea = Math.max(...areas);
    const minArea = Math.min(...areas);
    expect(maxArea / minArea).toBeLessThan(1.5); // Within 50% of each other
  });

  it('handles mixed switch and sensor entities', async () => {
    const hass = mockHass([
      mockEntity('sensor.temperature', '21.5', { friendly_name: 'Temperature' }),
      mockEntity('switch.heater', 'on', { friendly_name: 'Heater' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['sensor.temperature', 'switch.heater'],
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);

    const temp = items.find(i => i.label === 'Temperature');
    const heater = items.find(i => i.label === 'Heater');

    expect(temp?.value).toBeCloseTo(21.5, 1);
    expect(heater?.displayValue).toBe('On');
  });
});
