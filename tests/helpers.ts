/**
 * Shared test helpers for integration tests
 */

import { TreemapCard } from '../src';
import type { HomeAssistant, HassEntity } from '../src';

// Register custom element once
if (!customElements.get('treemap-card')) {
  customElements.define('treemap-card', TreemapCard);
}

export function createCard(): TreemapCard {
  const card = new TreemapCard();
  document.body.appendChild(card);
  return card;
}

export function mockEntity(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
  displayPrecision?: number
): HassEntity & { _display_precision?: number } {
  const domain = entityId.split('.')[0];
  const defaultUnit = domain === 'sensor' ? 'C' : undefined;

  const entity: HassEntity & { _display_precision?: number } = {
    entity_id: entityId,
    state,
    attributes: {
      friendly_name: entityId.split('.').pop()?.replace(/_/g, ' ') || entityId,
      ...(defaultUnit ? { unit_of_measurement: defaultUnit } : {}),
      ...attributes,
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };

  // Store display_precision for mockHass to pick up
  if (displayPrecision !== undefined) {
    entity._display_precision = displayPrecision;
  }

  return entity;
}

export function mockHass(
  entities: (HassEntity & { _display_precision?: number })[],
  callWS?: <T>(message: Record<string, unknown>) => Promise<T>
): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  const entitiesRegistry: Record<string, { entity_id: string; display_precision?: number }> = {};

  for (const entity of entities) {
    states[entity.entity_id] = entity;
    // Build entity registry entry if display_precision is set
    if (entity._display_precision !== undefined) {
      entitiesRegistry[entity.entity_id] = {
        entity_id: entity.entity_id,
        display_precision: entity._display_precision,
      };
    }
  }

  return {
    states,
    entities: entitiesRegistry,
    callService: async () => {},
    callWS: callWS ?? (async <T>() => ({}) as T),
  };
}

/**
 * Build a callWS stub that answers HA's statistics and history websocket commands.
 *
 * `statistics` maps a source entity id to the series it should return; the value is
 * emitted under whichever field the caller asked for via `types`, so the same fixture
 * works for mean/min/max/sum/state/change.
 */
export interface MockWsOptions {
  statistics?: Record<string, number[]>;
  history?: Record<string, unknown[]>;
}

export interface MockWs {
  callWS: <T>(message: Record<string, unknown>) => Promise<T>;
  calls: Record<string, unknown>[];
}

export function mockCallWS(options: MockWsOptions = {}): MockWs {
  const calls: Record<string, unknown>[] = [];

  const callWS = async <T>(message: Record<string, unknown>): Promise<T> => {
    calls.push(message);

    if (message['type'] === 'recorder/statistics_during_period') {
      const ids = (message['statistic_ids'] as string[] | undefined) ?? [];
      const types = (message['types'] as string[] | undefined) ?? ['mean'];
      const field = types[0] ?? 'mean';
      const result: Record<string, Record<string, number>[]> = {};
      for (const id of ids) {
        const series = options.statistics?.[id];
        if (series) {
          result[id] = series.map((value, index) => ({
            start: index,
            end: index + 1,
            [field]: value,
          }));
        }
      }
      return result as T;
    }

    if (message['type'] === 'history/history_during_period') {
      const ids = (message['entity_ids'] as string[] | undefined) ?? [];
      const result: Record<string, unknown[]> = {};
      for (const id of ids) {
        const states = options.history?.[id];
        if (states) result[id] = states;
      }
      return result as T;
    }

    return {} as T;
  };

  return { callWS, calls };
}

/**
 * Extract the rendered sparkline polyline points for each tile, in render order.
 * Returns null for tiles that rendered no sparkline.
 */
export function getSparklines(card: TreemapCard): (string | null)[] {
  const shadow = card.shadowRoot;
  if (!shadow) return [];

  return [...shadow.querySelectorAll('.treemap-item')].map(item => {
    const polyline = item.querySelector('.treemap-sparkline polyline');
    return polyline?.getAttribute('points') ?? null;
  });
}

/**
 * Step past the 100ms sparkline fetch debounce and let the resulting
 * re-render settle. `await card.updateComplete` alone is not enough.
 */
export async function flushSparklines(card: TreemapCard, ms = 150): Promise<void> {
  await card.updateComplete;
  await new Promise(resolve => setTimeout(resolve, ms));
  await card.updateComplete;
  // The fetch resolves asynchronously and assigns state, scheduling one more update.
  await new Promise(resolve => setTimeout(resolve, 0));
  await card.updateComplete;
}

export interface RenderedItem {
  label: string;
  value: number;
  displayValue: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
  labelColor?: string;
  valueColor?: string;
  iconColor?: string;
  icon?: string;
}

export function getRenderedItems(card: TreemapCard): RenderedItem[] {
  const shadow = card.shadowRoot;
  if (!shadow) return [];

  const items = shadow.querySelectorAll('.treemap-item');
  const result: RenderedItem[] = [];

  for (const item of items) {
    const labelEl = item.querySelector('.treemap-label') as HTMLElement | null;
    const valueEl = item.querySelector('.treemap-value') as HTMLElement | null;
    const iconEl = item.querySelector('.treemap-icon') as HTMLElement | null;
    if (!(item instanceof HTMLElement)) continue;
    const style = item.style;

    const label = labelEl?.textContent || '';
    const displayValue = valueEl?.textContent || '';
    const value = Number.parseFloat(displayValue);

    const leftMatch = /left:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const topMatch = /top:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const widthMatch = /width:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const heightMatch = /height:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const bgMatch = /background(?:-color)?:\s*([^;]+)/.exec(style.cssText);

    // Extract colors from inline styles
    const labelColorMatch = labelEl?.style.cssText.match(/color:\s*([^;]+)/);
    const valueColorMatch = valueEl?.style.cssText.match(/color:\s*([^;]+)/);
    const iconColorMatch = iconEl?.style.cssText.match(/color:\s*([^;]+)/);

    // Extract icon name from ha-icon element
    const haIcon = item.querySelector('ha-icon');
    const iconName = haIcon?.getAttribute('icon') ?? undefined;

    result.push({
      label,
      value,
      displayValue,
      x: leftMatch?.[1] ? Number.parseFloat(leftMatch[1]) : 0,
      y: topMatch?.[1] ? Number.parseFloat(topMatch[1]) : 0,
      width: widthMatch?.[1] ? Number.parseFloat(widthMatch[1]) : 0,
      height: heightMatch?.[1] ? Number.parseFloat(heightMatch[1]) : 0,
      backgroundColor: bgMatch?.[1]?.trim(),
      labelColor: labelColorMatch?.[1]?.trim(),
      valueColor: valueColorMatch?.[1]?.trim(),
      iconColor: iconColorMatch?.[1]?.trim(),
      icon: iconName,
    });
  }

  return result;
}
