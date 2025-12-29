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

export interface MockEntityOptions {
  attributes?: Record<string, unknown>;
  display_precision?: number;
}

export function mockEntity(
  entityId: string,
  state: string,
  attributesOrOptions: Record<string, unknown> | MockEntityOptions = {}
): HassEntity & { _display_precision?: number } {
  const domain = entityId.split('.')[0];
  const defaultUnit = domain === 'sensor' ? 'C' : undefined;

  // Support both old signature (attributes object) and new signature (options object)
  const isOptionsObject =
    'attributes' in attributesOrOptions || 'display_precision' in attributesOrOptions;
  const attributes = isOptionsObject
    ? (attributesOrOptions as MockEntityOptions).attributes || {}
    : attributesOrOptions;
  const displayPrecision = isOptionsObject
    ? (attributesOrOptions as MockEntityOptions).display_precision
    : undefined;

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
  entities: (HassEntity & { _display_precision?: number })[]
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
    callWS: async <T>() => ({}) as T,
  };
}

export interface RenderedItem {
  label: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
}

export function getRenderedItems(card: TreemapCard): RenderedItem[] {
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

    const leftMatch = /left:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const topMatch = /top:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const widthMatch = /width:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const heightMatch = /height:\s*calc\(([0-9.]+)%/.exec(style.cssText);
    const bgMatch = /background(?:-color)?:\s*([^;]+)/.exec(style.cssText);

    result.push({
      label,
      value,
      x: leftMatch?.[1] ? parseFloat(leftMatch[1]) : 0,
      y: topMatch?.[1] ? parseFloat(topMatch[1]) : 0,
      width: widthMatch?.[1] ? parseFloat(widthMatch[1]) : 0,
      height: heightMatch?.[1] ? parseFloat(heightMatch[1]) : 0,
      backgroundColor: bgMatch?.[1]?.trim(),
    });
  }

  return result;
}
