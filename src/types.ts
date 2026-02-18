/**
 * Home Assistant types (minimal subset needed)
 */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

/**
 * Entity registry entry (display metadata from hass.entities)
 * Based on Home Assistant frontend types
 */
export interface EntityRegistryDisplayEntry {
  entity_id: string;
  name?: string;
  device_id?: string;
  area_id?: string;
  hidden?: boolean;
  entity_category?: 'config' | 'diagnostic';
  translation_key?: string;
  platform?: string;
  display_precision?: number;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, EntityRegistryDisplayEntry>;
  callService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  callWS: <T>(message: Record<string, unknown>) => Promise<T>;
  language?: string; // User's language setting (e.g., 'en', 'de', 'fr')
  user?: { id: string }; // Used by handleActionConfig for confirmation exemptions
}

/**
 * Where to apply calculated color
 */
export type ColorApplyTarget = 'background' | 'foreground';

import type { EntityConfig, ActionConfig } from 'custom-card-helpers';

export type { ActionConfig };

/**
 * Treemap entity config - extends HA EntityConfig with per-entity action overrides
 */
export interface TreemapEntityConfig extends EntityConfig {
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

/**
 * Entity input: string (with wildcard support) or object config
 * Examples:
 *   - "sensor.power_*"                    (string with wildcard)
 *   - "sensor.temperature"                (plain string)
 *   - { entity: "sensor.x", name: "Y" }   (object config)
 */
export type EntityInput = string | TreemapEntityConfig;

/**
 * Type guard for object-style entity config
 */
export function isEntityConfig(e: EntityInput): e is TreemapEntityConfig {
  return typeof e === 'object' && e !== null && 'entity' in e && typeof e.entity === 'string';
}

/**
 * Card configuration
 */
export interface TreemapCardConfig {
  type: string;
  title?: string;
  // Header configuration (custom header, more compact than HA default)
  header?: {
    show?: boolean; // Show header (default: true if title set)
    title?: string; // Header title text
    style?: string; // Custom CSS for header
  };
  // Mode 1 & 2: List of entities (supports wildcards with *)
  // Accepts both string[] and auto-entities object format
  entities?: EntityInput[];
  // Exclude entities matching these patterns (supports wildcards with *)
  exclude?: string[];
  // Mode 3: Single entity containing data array in attributes
  entity?: string;
  // Attribute name containing the data array (default: 'items')
  data_attribute?: string;
  // Height of the treemap in pixels (default: auto based on item count)
  height?: number;
  // Gap between rectangles in pixels (default: 6)
  gap?: number;
  // Sort order: 'desc' (largest first, default) or 'asc' (smallest first)
  order?: 'asc' | 'desc';
  // Sort by: what to sort items by (default: 'value')
  sort_by?: 'value' | 'entity_id' | 'label' | 'default';
  // Limit number of items shown
  limit?: number;
  // Filter configuration
  filter?: {
    above?: number; // Only include values > this
    below?: number; // Only include values < this
    unavailable?: boolean; // Include unavailable/unknown/none entities (default: false)
  };
  // Label configuration
  label?: {
    show?: boolean; // Show label (default: true)
    attribute?: string; // Field/attribute for label (default: 'friendly_name' for entities, 'label' for JSON)
    param?: string; // Deprecated alias for 'attribute'
    replace?: string; // Regex replacement pattern "pattern/replacement"
    prefix?: string; // Prefix to add before label
    suffix?: string; // Suffix to add after label
    style?: string; // Custom CSS for label
  };
  // Icon configuration
  icon?: {
    show?: boolean; // Show icon (default: true)
    attribute?: string; // Field/attribute containing icon (default: 'icon')
    param?: string; // Deprecated alias for 'attribute'
    icon?: string; // Static icon for all items (e.g., 'mdi:home-thermometer-outline')
    style?: string; // Custom CSS for icon
  };
  // Value configuration (displayed value)
  value?: {
    show?: boolean; // Show value (default: true)
    attribute?: string; // Field/attribute for value (default: 'state' for entities, 'value' for JSON)
    param?: string; // Deprecated alias for 'attribute'
    precision?: number; // Decimal places (default: entity's display_precision or 1)
    abbreviate?: boolean; // Abbreviate large numbers: k, M, B, T (default: false)
    prefix?: string; // Prefix to add before value
    suffix?: string; // Suffix to add after value (e.g., ' %')
    style?: string; // Custom CSS for value
  };
  // Size configuration (determines rectangle size)
  size?: {
    equal?: boolean; // Equal size rectangles (default: false)
    attribute?: string; // Field/attribute for sizing (default: same as value.attribute)
    param?: string; // Deprecated alias for 'attribute'
    inverse?: boolean; // Inverse sizing - low values get bigger rectangles (default: false)
    min?: number; // Minimum size value floor (default: 5% of max, ensures 0-value items visible)
    max?: number; // Maximum size value cap (useful for limiting outliers)
  };
  // Color gradient configuration
  color?: {
    target?: ColorApplyTarget; // Where to apply the color: 'background' (default) or 'foreground'
    low?: string; // Color for low values (default: #b91c1c red)
    mid?: string; // Color for middle/neutral values (optional, e.g., #00b6ed blue)
    high?: string; // Color for high values (default: #16a34a green)
    unavailable?: string; // Color for unavailable/unknown entities (default: #868e96 gray)
    opacity?: number; // Opacity 0-1 (e.g., 0.5 for 50% transparent)
    attribute?: string; // Field/attribute for color calculation (default: same as value.attribute)
    param?: string; // Deprecated alias for 'attribute'
    scale?: {
      neutral?: number; // Value where color is neutral/center (e.g., 0)
      min?: number; // Value at which color is fully low (e.g., -8 for full red)
      max?: number; // Value at which color is fully high (e.g., 8 for full green)
    };
    // HVAC action categorical coloring (for climate entities)
    hvac?: {
      heating?: string; // Color when heating (default: #ff6b35 orange)
      cooling?: string; // Color when cooling (default: #4dabf7 blue)
      idle?: string; // Color when idle (default: #69db7c green)
      off?: string; // Color when off (default: #868e96 gray)
    };
  };
  // Custom CSS for the entire card
  card_style?: string;
  // Action configuration (standard HA action pattern)
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  // Sparkline configuration
  sparkline?: {
    show?: boolean; // Show sparklines (default: true)
    attribute?: string; // Field/attribute containing sparkline data array (JSON mode)
    period?: '12h' | '24h' | '7d' | '30d'; // Time period for entity history (default: '24h')
    mode?: 'light' | 'dark'; // Color mode (default: 'dark')
    line?: {
      show?: boolean; // Show line (default: true)
      style?: string; // Custom CSS for line (stroke, stroke-width, etc.)
    };
    fill?: {
      show?: boolean; // Show fill (default: true)
      style?: string; // Custom CSS for fill (fill color, opacity, etc.)
    };
    hvac?: {
      show?: boolean; // Show HVAC action bars for climate entities (default: true)
    };
  };
}

/**
 * Light entity color information
 */
export interface LightColorInfo {
  rgb?: [number, number, number]; // RGB color (0-255 each)
  hs?: [number, number]; // Hue (0-360), Saturation (0-100)
  brightness: number; // 0-100 percentage
  isOn: boolean;
  supportsColor: boolean; // Whether light supports RGB/HS colors
}

/**
 * Climate entity information with computed values
 */
export interface ClimateInfo {
  currentTemperature: number | null; // Current room temperature
  targetTemperature: number | null; // Target/setpoint temperature
  tempDifference: number; // Absolute difference from target (always >= 0)
  tempOffset: number; // Signed difference (negative = below target)
  hvacAction: 'heating' | 'cooling' | 'idle' | 'off' | null;
  hvacMode: string | null;
}

/**
 * Treemap data item
 */
export interface TreemapItem {
  label: string;
  value: number; // Display value
  sizeValue: number; // Value used for sizing (always positive, may be inverted)
  sortValue: number; // Value used for sorting (original signed value, inverted when size.inverse)
  colorValue: number; // Value used for coloring
  entity_id?: string;
  icon?: string;
  unit?: string; // Unit of measurement (e.g., °C, %, kWh)
  light?: LightColorInfo; // Light-specific color info (only for light.* entities)
  climate?: ClimateInfo; // Climate-specific info (only for climate.* entities)
  sparklineData?: number[]; // Inline sparkline data (JSON mode)
  unavailable?: boolean; // True if entity state is unavailable/unknown/none
  rawState?: string; // Original state string (for unavailable entities)
}

/**
 * Treemap rectangle with position
 */
export interface TreemapRect {
  label: string;
  value: number; // Display value
  sizeValue: number; // Value used for sizing (always positive, may be inverted)
  sortValue: number; // Value used for sorting (original signed value, inverted when size.inverse)
  colorValue: number; // Value used for coloring
  entity_id?: string;
  icon?: string;
  unit?: string; // Unit of measurement (e.g., °C, %, kWh)
  light?: LightColorInfo; // Light-specific color info (only for light.* entities)
  climate?: ClimateInfo; // Climate-specific info (only for climate.* entities)
  sparklineData?: number[]; // Inline sparkline data (JSON mode)
  unavailable?: boolean; // True if entity state is unavailable/unknown/none
  rawState?: string; // Original state string (for unavailable entities)
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Window augmentation for custom cards registration
 */
declare global {
  interface Window {
    customCards?: {
      type: string;
      name: string;
      description: string;
      preview?: boolean;
    }[];
  }
}
