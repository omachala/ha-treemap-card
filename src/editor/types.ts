/**
 * Editor-specific types
 */

import type { TreemapCardConfig, HomeAssistant } from '../types';

/**
 * Lovelace card editor interface (HA convention)
 */
export interface LovelaceCardEditor extends HTMLElement {
  hass?: HomeAssistant;
  lovelace?: unknown;
  setConfig(config: TreemapCardConfig): void;
}

/**
 * Config changed event detail
 */
export interface ConfigChangedEventDetail {
  config: TreemapCardConfig;
}
