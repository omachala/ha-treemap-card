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
  attributes: Record<string, unknown> = {}
): HassEntity {
  const domain = entityId.split('.')[0];
  const defaultUnit = domain === 'sensor' ? 'C' : undefined;

  return {
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
}

export function mockHass(entities: HassEntity[]): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of entities) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
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
