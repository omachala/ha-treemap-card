/**
 * Integration tests for JSON entity mode
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createCard, mockEntity, mockHass, getRenderedItems } from './helpers';
import type { TreemapCard } from '../src/treemap-card';

describe('JSON Entity Mode', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  it('renders from JSON attribute with different size/value params', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '3', { holdings, friendly_name: 'Portfolio' }),
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

    expect(items.find(i => i.label === 'AAPL')?.value).toBeCloseTo(-2.5, 1);
    expect(items.find(i => i.label === 'MSFT')?.value).toBeCloseTo(1.2, 1);
    expect(items.find(i => i.label === 'NVDA')?.value).toBeCloseTo(-5.7, 1);
  });

  it('renders with order asc', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
      { ticker: 'GOOG', todayPct: 0.5, value: 2000 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '4', { holdings, friendly_name: 'Portfolio' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct' },
      size: { param: 'value' },
      order: 'asc',
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(4);

    expect(items.find(i => i.label === 'AAPL')?.value).toBeCloseTo(-2.5, 1);
    expect(items.find(i => i.label === 'MSFT')?.value).toBeCloseTo(1.2, 1);
    expect(items.find(i => i.label === 'NVDA')?.value).toBeCloseTo(-5.7, 1);
    expect(items.find(i => i.label === 'GOOG')?.value).toBeCloseTo(0.5, 1);
  });

  it('respects limit with order asc', async () => {
    const holdings = [
      { ticker: 'AAPL', todayPct: -2.5, value: 5000 },
      { ticker: 'MSFT', todayPct: 1.2, value: 3000 },
      { ticker: 'NVDA', todayPct: -5.7, value: 700 },
      { ticker: 'GOOG', todayPct: 0.5, value: 2000 },
    ];

    const hass = mockHass([
      mockEntity('sensor.portfolio', '4', { holdings, friendly_name: 'Portfolio' }),
    ]);

    card.setConfig({
      type: 'custom:treemap-card',
      entity: 'sensor.portfolio',
      data_attribute: 'holdings',
      label: { param: 'ticker' },
      value: { param: 'todayPct' },
      size: { param: 'value' },
      order: 'asc',
      limit: 2,
    });
    card.hass = hass;
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);

    expect(items.find(i => i.label === 'AAPL')).toBeUndefined();
    expect(items.find(i => i.label === 'MSFT')).toBeUndefined();
    expect(items.find(i => i.label === 'NVDA')?.value).toBeCloseTo(-5.7, 1);
    expect(items.find(i => i.label === 'GOOG')?.value).toBeCloseTo(0.5, 1);
  });
});
