/**
 * Integration tests for user interactions (click, etc.)
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createCard, mockEntity, mockHass } from './helpers';
import type { TreemapCard } from '../src';

describe('User Interactions', () => {
  let card: TreemapCard;

  beforeEach(() => {
    card = createCard();
  });

  describe('click handler', () => {
    it('dispatches hass-more-info event on click', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
      });
      card.hass = hass;
      await card.updateComplete;

      // Listen for the hass-more-info event
      const eventPromise = new Promise<CustomEvent>(resolve => {
        card.addEventListener('hass-more-info', resolve as EventListener);
      });

      // Click on the treemap item
      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      expect(item).toBeDefined();
      item?.click();

      // Verify event was dispatched with correct entity
      const event = await eventPromise;
      expect(event.detail.entityId).toBe('sensor.temperature');
    });

    it('dispatches correct entity_id for multiple items', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp_a', '20', { friendly_name: 'Temp A' }),
        mockEntity('sensor.temp_b', '25', { friendly_name: 'Temp B' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp_*'],
      });
      card.hass = hass;
      await card.updateComplete;

      const events: string[] = [];
      card.addEventListener('hass-more-info', ((e: CustomEvent) => {
        events.push(e.detail.entityId);
      }) as EventListener);

      // Click on each item
      const items = card.shadowRoot?.querySelectorAll('.treemap-item') as NodeListOf<HTMLElement>;
      expect(items.length).toBe(2);

      for (const item of items) {
        item.click();
      }

      // Should have dispatched events for both entities
      expect(events).toContain('sensor.temp_a');
      expect(events).toContain('sensor.temp_b');
    });

    it('does not dispatch event for items without entity_id', async () => {
      const hass = mockHass([]);

      // JSON mode with entity but data array items don't have entity_id
      card.setConfig({
        type: 'custom:treemap-card',
        entity: 'sensor.json_source',
        data: [{ label: 'No Entity', value: 50 }],
      });
      card.hass = hass;
      await card.updateComplete;

      const eventSpy = vi.fn();
      card.addEventListener('hass-more-info', eventSpy);

      // Click on the item (which has no entity_id)
      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item?.click();

      // No event should be dispatched
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
