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

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
}

/**
 * Card configuration
 */
export interface TreemapCardConfig {
  type: string;
  title?: string;
  // Mode 1 & 2: List of entities (supports wildcards with *)
  entities?: string[];
  // Mode 3: Single entity containing data array in attributes
  entity?: string;
  // Attribute name containing the data array (default: 'items')
  data_attribute?: string;
  // Attribute to use as value (for entities mode)
  value_attribute?: string;
  // Attribute to use as label (for entities mode)
  label_attribute?: string;
  // Height of the treemap in pixels (default: auto based on item count)
  height?: number;
  // Gap between rectangles in pixels (default: 6)
  gap?: number;
  // Filter configuration
  filter?: {
    above?: number; // Only include values > this
    below?: number; // Only include values < this
  };
  // Label configuration
  label?: {
    show?: boolean; // Show label (default: true)
    param?: string; // Field name from data (default: 'label')
    replace?: string; // Regex replacement pattern "pattern/replacement"
    prefix?: string; // Prefix to add before label
    suffix?: string; // Suffix to add after label
  };
  // Icon configuration
  icon?: {
    show?: boolean; // Show icon (default: true)
    param?: string; // Field name from data (default: 'icon')
  };
  // Value configuration (displayed value)
  value?: {
    show?: boolean; // Show value (default: true)
    param?: string; // Field name from data for display (default: 'value')
    prefix?: string; // Prefix to add before value
    suffix?: string; // Suffix to add after value (e.g., ' %')
  };
  // Size configuration (determines rectangle size)
  size?: {
    equal?: boolean; // Equal size rectangles (default: false)
    param?: string; // Field name from data for sizing (default: same as value.param)
  };
  // Color gradient configuration
  color?: {
    low?: string; // Color for low values (default: #b91c1c red)
    high?: string; // Color for high values (default: #16a34a green)
    opacity?: number; // Opacity 0-1 (e.g., 0.5 for 50% transparent)
    param?: string; // Field name for color calculation (default: same as value.param)
    scale?: {
      neutral?: number; // Value where color is neutral/center (e.g., 0)
      min?: number; // Value at which color is fully low (e.g., -8 for full red)
      max?: number; // Value at which color is fully high (e.g., 8 for full green)
    };
  };
}

/**
 * Treemap data item
 */
export interface TreemapItem {
  label: string;
  value: number; // Display value
  sizeValue: number; // Value used for sizing
  colorValue: number; // Value used for coloring
  entity_id?: string;
  icon?: string;
}

/**
 * Treemap rectangle with position
 */
export interface TreemapRect {
  label: string;
  value: number; // Display value
  sizeValue: number; // Value used for sizing
  colorValue: number; // Value used for coloring
  entity_id?: string;
  icon?: string;
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
