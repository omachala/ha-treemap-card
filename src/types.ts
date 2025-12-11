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
  // Min value for color scale (optional)
  min?: number;
  // Max value for color scale (optional)
  max?: number;
  // Color gradient configuration
  color?: {
    low?: string; // Color for low values (default: red)
    high?: string; // Color for high values (default: green)
    scale?: {
      neutral?: number; // Value where color is neutral/center (e.g., 0)
      min?: number; // Value at which color is fully low (e.g., -8 for full red)
      max?: number; // Value at which color is fully high (e.g., 8 for full green)
    };
    // @deprecated Use color.scale.neutral instead
    neutral_value?: number;
    // @deprecated Use color.scale.min instead
    min_value?: number;
    // @deprecated Use color.scale.max instead
    max_value?: number;
  };
  // @deprecated Use color.low instead
  color_low?: string;
  // @deprecated Use color.high instead
  color_high?: string;
  // Filter configuration
  filter?: {
    above?: number; // Only include values > this
    below?: number; // Only include values < this
  };
  // @deprecated Use filter.above instead
  filter_above?: number;
  // @deprecated Use filter.below instead
  filter_below?: number;
  // Height of the treemap in pixels (default: auto based on item count)
  height?: number;
  // Gap between rectangles in pixels (default: 6)
  gap?: number;
  // Equal size mode: all rectangles same size, only color varies (default: false)
  equal_size?: boolean;
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
  // Color configuration (determines rectangle color)
  color_param?: string; // Field name from data for coloring (default: same as value.param)
  // @deprecated Use label.show, icon.show, value.show instead
  show?: {
    icon?: boolean;
    label?: boolean;
    value?: boolean;
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
