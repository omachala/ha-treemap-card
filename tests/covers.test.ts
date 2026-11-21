import { describe, expect, it } from 'vitest';
import { createCard, getRenderedItems, mockEntity, mockHass } from './helpers';

describe('cover entities', () => {
  it('renders cover positions and icons from their state', async () => {
    const card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['cover.*'],
      value: { precision: 0, suffix: '%' },
      color: { low: '#16a34a', high: '#6b7280' },
    });
    card.hass = mockHass([
      mockEntity('cover.open_window', 'open', {
        friendly_name: 'Open Window',
        current_position: 100,
      }),
      mockEntity('cover.closed_window', 'closed', {
        friendly_name: 'Closed Window',
        current_position: 0,
      }),
    ]);
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items.find(item => item.label === 'Open Window')).toMatchObject({
      displayValue: '0%',
      icon: 'mdi:window-shutter-open',
    });
    expect(items.find(item => item.label === 'Closed Window')).toMatchObject({
      displayValue: '100%',
      icon: 'mdi:window-shutter',
    });
  });

  it('does not show an unavailable cover as closed', async () => {
    const card = createCard();
    card.setConfig({ type: 'custom:treemap-card', entities: ['cover.*'] });
    card.hass = mockHass([
      mockEntity('cover.offline', 'unavailable', { friendly_name: 'Offline' }),
      mockEntity('cover.closed_window', 'closed', {
        friendly_name: 'Closed Window',
        current_position: 0,
      }),
    ]);
    await card.updateComplete;

    const labels = getRenderedItems(card).map(item => item.label);
    expect(labels).toEqual(['Closed Window']);
  });

  it('shows an unavailable cover as unavailable when filter.unavailable is on', async () => {
    const card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['cover.offline', 'sensor.offline'],
      filter: { unavailable: true },
    });
    card.hass = mockHass([
      mockEntity('cover.offline', 'unavailable', { friendly_name: 'Cover' }),
      mockEntity('sensor.offline', 'unavailable', { friendly_name: 'Sensor' }),
    ]);
    await card.updateComplete;

    const items = getRenderedItems(card);
    expect(items).toHaveLength(2);
    const cover = items.find(item => item.label === 'Cover');
    const sensor = items.find(item => item.label === 'Sensor');
    expect(cover?.displayValue).toBe(sensor?.displayValue);
  });

  it('shows the real position of a cover that is moving', async () => {
    const card = createCard();
    card.setConfig({
      type: 'custom:treemap-card',
      entities: ['cover.*'],
      value: { precision: 0, suffix: '%' },
    });
    card.hass = mockHass([
      mockEntity('cover.moving', 'opening', { friendly_name: 'Moving', current_position: 40 }),
    ]);
    await card.updateComplete;

    expect(getRenderedItems(card)[0]?.displayValue).toBe('60%');
  });
});
