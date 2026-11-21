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
});
