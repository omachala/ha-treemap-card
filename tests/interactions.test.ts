/**
 * Integration tests for user interactions (tap, hold actions)
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { createCard, mockEntity, mockHass } from './helpers';
import type { TreemapCard } from '../src';

describe('User Interactions', () => {
  let card: TreemapCard;

  beforeEach(() => {
    vi.useFakeTimers();
    card = createCard();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('default tap action (more-info)', () => {
    it('dispatches hass-more-info event on tap with no config', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
      });
      card.hass = hass;
      await card.updateComplete;

      const eventPromise = new Promise<CustomEvent>(resolve => {
        card.addEventListener('hass-more-info', resolve as EventListener);
      });

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      expect(item).toBeDefined();
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      item.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );

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

      const items = card.shadowRoot?.querySelectorAll('.treemap-item') as NodeListOf<HTMLElement>;
      expect(items.length).toBe(2);

      for (const item of items) {
        item.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
        );
        item.dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
        );
      }

      expect(events).toContain('sensor.temp_a');
      expect(events).toContain('sensor.temp_b');
    });

    it('does not dispatch event for items without entity_id (JSON mode)', async () => {
      const hass = mockHass([
        mockEntity('sensor.json_source', 'ok', {
          items: [{ label: 'No Entity', value: 50 }],
        }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entity: 'sensor.json_source',
      });
      card.hass = hass;
      await card.updateComplete;

      const eventSpy = vi.fn();
      card.addEventListener('hass-more-info', eventSpy);

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      item.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('tap_action: none', () => {
    it('does not dispatch any event when tap_action is none', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
        tap_action: { action: 'none' },
      });
      card.hass = hass;
      await card.updateComplete;

      const eventSpy = vi.fn();
      card.addEventListener('hass-more-info', eventSpy);

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      item.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('tap_action: navigate', () => {
    it('calls navigate on tap with navigate action', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
        tap_action: { action: 'navigate', navigation_path: '/lovelace/power' },
      });
      card.hass = hass;
      await card.updateComplete;

      const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      item.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );

      expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/lovelace/power');

      pushStateSpy.mockRestore();
    });
  });

  describe('hold_action', () => {
    it('fires hold_action after hold threshold, not tap_action', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
        tap_action: { action: 'more-info' },
        hold_action: { action: 'navigate', navigation_path: '/lovelace/detail' },
      });
      card.hass = hass;
      await card.updateComplete;

      const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
      const moreInfoSpy = vi.fn();
      card.addEventListener('hass-more-info', moreInfoSpy);

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      vi.advanceTimersByTime(600); // past 500ms threshold
      item.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );

      expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/lovelace/detail');
      expect(moreInfoSpy).not.toHaveBeenCalled();

      pushStateSpy.mockRestore();
    });

    it('fires tap_action when released before hold threshold', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
        tap_action: { action: 'more-info' },
        hold_action: { action: 'navigate', navigation_path: '/lovelace/detail' },
      });
      card.hass = hass;
      await card.updateComplete;

      const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
      const moreInfoPromise = new Promise<CustomEvent>(resolve => {
        card.addEventListener('hass-more-info', resolve as EventListener);
      });

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      vi.advanceTimersByTime(100); // before 500ms threshold
      item.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );

      const event = await moreInfoPromise;
      expect(event.detail.entityId).toBe('sensor.temperature');
      expect(pushStateSpy).not.toHaveBeenCalled();

      pushStateSpy.mockRestore();
    });

    it('does not fire hold_action when hold_action is none', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
        tap_action: { action: 'more-info' },
        hold_action: { action: 'none' },
      });
      card.hass = hass;
      await card.updateComplete;

      const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      vi.advanceTimersByTime(600);
      item.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );

      expect(pushStateSpy).not.toHaveBeenCalled();

      pushStateSpy.mockRestore();
    });

    it('cancels hold timer on pointercancel', async () => {
      const hass = mockHass([
        mockEntity('sensor.temperature', '22.5', { friendly_name: 'Temperature' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temperature'],
        hold_action: { action: 'navigate', navigation_path: '/lovelace/detail' },
      });
      card.hass = hass;
      await card.updateComplete;

      const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

      const item = card.shadowRoot?.querySelector('.treemap-item') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      item.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
      vi.advanceTimersByTime(600);

      expect(pushStateSpy).not.toHaveBeenCalled();

      pushStateSpy.mockRestore();
    });
  });

  describe('per-entity action overrides', () => {
    it('uses per-entity tap_action override over global config', async () => {
      const hass = mockHass([
        mockEntity('sensor.temp_a', '20', { friendly_name: 'Temp A' }),
        mockEntity('sensor.temp_b', '25', { friendly_name: 'Temp B' }),
      ]);

      card.setConfig({
        type: 'custom:treemap-card',
        entities: [
          {
            entity: 'sensor.temp_a',
            tap_action: { action: 'navigate', navigation_path: '/lovelace/temp-a' },
          },
          'sensor.temp_b',
        ],
        tap_action: { action: 'more-info' },
      });
      card.hass = hass;
      await card.updateComplete;

      const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
      const moreInfoSpy = vi.fn();
      card.addEventListener('hass-more-info', moreInfoSpy);

      const items = card.shadowRoot?.querySelectorAll('.treemap-item') as NodeListOf<HTMLElement>;
      expect(items.length).toBe(2);

      const itemA = Array.from(items).find(el =>
        el.querySelector('.treemap-label')?.textContent?.includes('Temp A')
      ) as HTMLElement;
      const itemB = Array.from(items).find(el =>
        el.querySelector('.treemap-label')?.textContent?.includes('Temp B')
      ) as HTMLElement;

      expect(itemA).toBeDefined();
      expect(itemB).toBeDefined();

      // Tap temp_a → per-entity navigate
      itemA.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      itemA.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/lovelace/temp-a');

      // Tap temp_b → global more-info
      pushStateSpy.mockClear();
      itemB.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      itemB.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
      );
      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(moreInfoSpy).toHaveBeenCalledTimes(1);

      pushStateSpy.mockRestore();
    });
  });
});
