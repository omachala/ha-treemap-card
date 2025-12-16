import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  HomeAssistant,
  TreemapCardConfig,
  TreemapItem,
  TreemapRect,
  LightColorInfo,
  HassEntity,
} from './types';
import { squarify } from './squarify';
import { styles } from './styles';

const CARD_VERSION = '0.5.1';

console.info(
  `%c TREEMAP-CARD %c v${CARD_VERSION} `,
  'color: white; background: #3498db; font-weight: bold;',
  'color: #3498db; background: white; font-weight: bold;'
);

/**
 * Match entity ID against pattern with wildcard support
 * Supports * as wildcard (e.g., "sensor.battery_*", "light.*_brightness")
 */
function matchesPattern(entityId: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return entityId === pattern;
  }
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(entityId);
}

/**
 * Check if entity is a light
 */
function isLightEntity(entityId: string): boolean {
  return entityId.startsWith('light.');
}

/**
 * Extract light color information from entity attributes
 */
function extractLightInfo(entity: HassEntity): LightColorInfo {
  const attrs = entity.attributes;
  const isOn = entity.state === 'on';
  const brightnessRaw = attrs['brightness'] as number | undefined;
  const brightness = isOn ? Math.round(((brightnessRaw ?? 255) / 255) * 100) : 0;

  // Check supported color modes
  const supportedModes = (attrs['supported_color_modes'] as string[]) ?? [];
  const supportsColor = supportedModes.some(mode =>
    ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode)
  );

  const result: LightColorInfo = {
    brightness,
    isOn,
    supportsColor,
  };

  // Extract color if available
  if (isOn && supportsColor) {
    const rgbColor = attrs['rgb_color'] as [number, number, number] | undefined;
    const hsColor = attrs['hs_color'] as [number, number] | undefined;

    if (rgbColor && Array.isArray(rgbColor) && rgbColor.length === 3) {
      result.rgb = rgbColor;
    } else if (hsColor && Array.isArray(hsColor) && hsColor.length === 2) {
      result.hs = hsColor;
    }
  }

  return result;
}

/**
 * Convert HS color to RGB
 */
function hsToRgb(h: number, s: number): [number, number, number] {
  // h: 0-360, s: 0-100
  const hNorm = h / 360;
  const sNorm = s / 100;
  const l = 0.5; // Fixed lightness for vivid colors

  let r: number, g: number, b: number;

  if (sNorm === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + sNorm) : l + sNorm - l * sNorm;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Parse a color string (hex, rgb, rgba) and return RGB values
 */
function parseColor(color: string): [number, number, number] | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  }

  // Handle rgb/rgba colors
  const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1] ?? '0', 10),
      parseInt(rgbMatch[2] ?? '0', 10),
      parseInt(rgbMatch[3] ?? '0', 10),
    ];
  }

  return null;
}

/**
 * Calculate relative luminance of a color (0 = dark, 1 = light)
 * Based on WCAG formula
 */
function getLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Get contrasting text colors based on background
 * Icon is always white with opacity, label/value adapt to background
 */
function getContrastColors(backgroundColor: string): {
  icon: string;
  label: string;
  value: string;
} {
  const rgb = parseColor(backgroundColor);
  const useDark = rgb ? getLuminance(rgb[0], rgb[1], rgb[2]) > 0.5 : false;

  // Icon is always white with slight opacity
  const icon = 'rgba(255, 255, 255, 0.85)';

  if (useDark) {
    return {
      icon,
      label: 'rgba(0, 0, 0, 0.9)',
      value: 'rgba(0, 0, 0, 0.7)',
    };
  } else {
    return {
      icon,
      label: 'white',
      value: 'rgba(255, 255, 255, 0.85)',
    };
  }
}

/**
 * Interpolate between two colors based on value 0-1
 */
function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
  opacity?: number
): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  if (opacity !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

@customElement('treemap-card')
export class TreemapCard extends LitElement {
  static override styles = styles;

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: TreemapCardConfig;

  public setConfig(config: TreemapCardConfig): void {
    if (!config.entities && !config.entity) {
      throw new Error('Please define "entities" (list) or "entity" (single with JSON array)');
    }
    this._config = {
      gap: 4, // smaller gap
      ...config,
    };
  }

  public getCardSize(): number {
    return 4;
  }

  private _resolveData(): TreemapItem[] {
    if (!this.hass || !this._config) return [];

    // Mode 1 & 2: entities list (with wildcard support)
    if (this._config.entities) {
      return this._resolveEntities(this._config.entities);
    }

    // Mode 3: single entity with JSON array
    if (this._config.entity) {
      return this._resolveJsonEntity(this._config.entity);
    }

    return [];
  }

  private _isExcluded(entityId: string): boolean {
    const excludePatterns = this._config?.exclude;
    if (!excludePatterns || excludePatterns.length === 0) return false;
    for (const pattern of excludePatterns) {
      const matches = matchesPattern(entityId, pattern);
      if (matches) {
        console.log(`[treemap] Excluding: ${entityId} (matched: ${pattern})`);
        return true;
      }
    }
    return false;
  }

  private _resolveEntities(patterns: string[]): TreemapItem[] {
    if (!this.hass) return [];

    const items: TreemapItem[] = [];
    const allEntityIds = Object.keys(this.hass.states);

    for (const pattern of patterns) {
      const matchingIds = allEntityIds.filter(
        id => matchesPattern(id, pattern) && !this._isExcluded(id)
      );

      for (const entityId of matchingIds) {
        const entity = this.hass.states[entityId];
        if (!entity) continue;

        const labelAttr = this._config?.label?.attribute || 'friendly_name';
        const label =
          labelAttr === 'entity_id'
            ? entityId
            : String(entity.attributes[labelAttr] ?? entityId.split('.').pop());

        const icon = entity.attributes['icon'] as string | undefined;

        // Special handling for light entities
        if (isLightEntity(entityId)) {
          const lightInfo = extractLightInfo(entity);
          const brightness = lightInfo.brightness;

          // Size: off lights get 10%, on lights get 40-100% based on brightness
          // This ensures on lights are clearly separated from off lights
          let sizeValue: number;
          if (!lightInfo.isOn) {
            sizeValue = 10;
          } else {
            // On lights: 40% minimum, scale to 100%
            sizeValue = 40 + (brightness / 100) * 60;
          }

          items.push({
            label,
            value: brightness, // Display brightness as percentage
            sizeValue,
            colorValue: brightness,
            entity_id: entityId,
            icon: icon ?? 'mdi:lightbulb',
            unit: '%',
            light: lightInfo,
          });
          continue;
        }

        // Standard entity handling
        const valueAttr = this._config?.value?.attribute || 'state';
        let value: number;
        if (valueAttr === 'state') {
          value = parseFloat(entity.state);
        } else {
          value = parseFloat(String(entity.attributes[valueAttr] ?? 0));
        }

        if (isNaN(value)) continue;

        const unit = entity.attributes['unit_of_measurement'] as string | undefined;

        items.push({
          label,
          value,
          sizeValue: Math.abs(value),
          colorValue: value,
          entity_id: entityId,
          icon,
          unit,
        });
      }
    }

    return items;
  }

  private _resolveJsonEntity(entityId: string): TreemapItem[] {
    if (!this.hass) return [];

    const entity = this.hass.states[entityId];
    if (!entity) return [];

    // Get data attribute name from config, default to 'items'
    const dataAttr = this._config?.data_attribute || 'items';
    const data = entity.attributes[dataAttr];

    if (!Array.isArray(data)) return [];

    // Get field mappings from config
    const labelParam = this._config?.label?.param || 'label';
    const valueParam = this._config?.value?.param || 'value';
    const sizeParam = this._config?.size?.param || valueParam;
    const colorParam = this._config?.color?.param || valueParam;
    const iconParam = this._config?.icon?.param || 'icon';

    return data
      .filter((item): item is Record<string, unknown> => {
        return typeof item === 'object' && item !== null;
      })
      .map(item => ({
        label: String(item[labelParam] ?? item['label'] ?? ''),
        value: Number(item[valueParam] ?? 0),
        sizeValue: Math.abs(Number(item[sizeParam] ?? item[valueParam] ?? 0)),
        colorValue: Number(item[colorParam] ?? item[valueParam] ?? 0),
        icon: (item[iconParam] as string) || undefined,
        entity_id: item['entity_id'] as string | undefined,
      }))
      .filter(item => item.label && !isNaN(item.value));
  }

  private _getColorHigh(): string {
    return this._config?.color?.high || '#16a34a';
  }

  private _getColorLow(): string {
    return this._config?.color?.low || '#b91c1c';
  }

  private _getColorMid(): string | undefined {
    return this._config?.color?.mid;
  }

  private _getOpacity(): number | undefined {
    return this._config?.color?.opacity;
  }

  private _getColor(value: number, min: number, max: number): string {
    const neutral = this._config?.color?.scale?.neutral;
    const minValue = this._config?.color?.scale?.min ?? min;
    const maxValue = this._config?.color?.scale?.max ?? max;
    const opacity = this._getOpacity();
    const midColor = this._getColorMid();

    // Clamp value to min/max range
    const clampedValue = Math.max(minValue, Math.min(maxValue, value));

    // Calculate the midpoint (neutral if set, otherwise center of range)
    const midPoint = neutral ?? (minValue + maxValue) / 2;

    // If mid color is defined, use three-color gradient: low -> mid -> high
    if (midColor) {
      if (clampedValue <= midPoint) {
        // Below midpoint: interpolate low -> mid
        if (minValue >= midPoint) {
          return interpolateColor(midColor, midColor, 1, opacity);
        }
        const factor = (clampedValue - minValue) / (midPoint - minValue);
        return interpolateColor(this._getColorLow(), midColor, factor, opacity);
      } else {
        // Above midpoint: interpolate mid -> high
        if (maxValue <= midPoint) {
          return interpolateColor(midColor, midColor, 1, opacity);
        }
        const factor = (clampedValue - midPoint) / (maxValue - midPoint);
        return interpolateColor(midColor, this._getColorHigh(), factor, opacity);
      }
    }

    // No mid color - use two-color gradient
    // If neutral is set, use it as the center point for blending
    if (neutral !== undefined) {
      if (clampedValue <= neutral) {
        // Below neutral: interpolate from low to 50% blend
        if (minValue >= neutral)
          return interpolateColor(this._getColorLow(), this._getColorHigh(), 0.5, opacity);
        const factor = (clampedValue - minValue) / (neutral - minValue);
        return interpolateColor(this._getColorLow(), this._getColorHigh(), factor * 0.5, opacity);
      } else {
        // Above neutral: interpolate from 50% blend to high
        if (maxValue <= neutral)
          return interpolateColor(this._getColorLow(), this._getColorHigh(), 0.5, opacity);
        const factor = (clampedValue - neutral) / (maxValue - neutral);
        return interpolateColor(
          this._getColorLow(),
          this._getColorHigh(),
          0.5 + factor * 0.5,
          opacity
        );
      }
    }

    // Default: simple linear gradient from low to high
    if (maxValue === minValue) {
      return interpolateColor(this._getColorHigh(), this._getColorHigh(), 1, opacity);
    }
    const factor = (clampedValue - minValue) / (maxValue - minValue);
    return interpolateColor(this._getColorLow(), this._getColorHigh(), factor, opacity);
  }

  private _getValueColor(value: number, min: number, max: number): string {
    if (max === min) return '#86efac'; // light green

    const factor = (value - min) / (max - min);
    // Light red (#fca5a5) to light green (#86efac)
    return interpolateColor('#fca5a5', '#86efac', factor);
  }

  private _getSizeClass(rect: TreemapRect): string {
    // Area is in percentage units (0-100 x 0-100 = 0-10000)
    const area = rect.width * rect.height;
    if (area < 50) return 'tiny'; // < ~7% x 7%
    if (area < 150) return 'small'; // < ~12% x 12%
    return '';
  }

  // Default light colors (dark gray to yellow)
  private _getLightColorOff(): string {
    return this._config?.color?.low ?? '#333333';
  }

  private _getLightColorOn(): string {
    return this._config?.color?.high ?? '#fbbf24'; // Amber/yellow
  }

  /**
   * Get background color for a light entity
   * - Color lights: use actual RGB/HS color with brightness as opacity
   * - Dimmable lights: use yellow with brightness as opacity
   * - Off lights: use dark gray
   */
  private _getLightColor(rect: TreemapRect): string {
    const light = rect.light;
    if (!light) return this._getLightColorOff();

    // Off light: dark color
    if (!light.isOn) {
      return this._getLightColorOff();
    }

    // Brightness as opacity (min 0.3 so it's always visible when on)
    const opacity = 0.3 + (light.brightness / 100) * 0.7;

    // Color light with RGB - use the actual light color
    if (light.supportsColor && light.rgb) {
      const [r, g, b] = light.rgb;
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Color light with HS - convert to RGB
    if (light.supportsColor && light.hs) {
      const [h, s] = light.hs;
      const [r, g, b] = hsToRgb(h, s);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Dimmable-only light: yellow with brightness as opacity
    const onColor = this._getLightColorOn();
    const hex = onColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  private _filterData(data: TreemapItem[]): TreemapItem[] {
    if (!this._config) return data;

    const filterAbove = this._config.filter?.above;
    const filterBelow = this._config.filter?.below;

    return data.filter(item => {
      if (filterAbove !== undefined && item.value <= filterAbove) {
        return false;
      }
      if (filterBelow !== undefined && item.value >= filterBelow) {
        return false;
      }
      return true;
    });
  }

  protected override render(): TemplateResult {
    if (!this._config) {
      return html`<ha-card><div class="error">No configuration</div></ha-card>`;
    }

    const rawData = this._resolveData();
    const data = this._filterData(rawData);

    console.log(`[treemap] v${CARD_VERSION} Config:`, this._config);
    console.log(`[treemap] Raw data: ${rawData.length}, Filtered: ${data.length}`, data);

    // Header: use custom header if header.title is set, otherwise use HA's default title
    const useCustomHeader = !!this._config.header?.title;
    const customHeaderTitle = this._config.header?.title;
    const showCustomHeader = this._config.header?.show ?? !!customHeaderTitle;
    const headerStyle = this._config.header?.style || '';
    const cardStyle = this._config.card_style || '';
    // HA's default header (only if not using custom header)
    const haTitle = useCustomHeader ? undefined : this._config.title;

    if (data.length === 0) {
      return html`
        <ha-card header="${haTitle || nothing}" style="${cardStyle}">
          ${showCustomHeader && customHeaderTitle
            ? html`<div class="treemap-header" style="${headerStyle}">${customHeaderTitle}</div>`
            : nothing}
          <div class="card-content">
            <div class="empty">No data available</div>
          </div>
        </ha-card>
      `;
    }

    // Calculate min/max for color scale (use colorValue)
    const colorValues = data.map(d => d.colorValue);
    const min = Math.min(...colorValues);
    const max = Math.max(...colorValues);

    // Apply inverse sizing if configured (low values get bigger rectangles)
    if (this._config?.size?.inverse) {
      const maxSize = Math.max(...data.map(d => d.sizeValue));
      const minSize = Math.min(...data.map(d => d.sizeValue));
      data.forEach(d => {
        d.sizeValue = maxSize + minSize - d.sizeValue;
      });
    }

    // Sort data by sizeValue
    const orderAsc = this._config?.order === 'asc';
    const sizeInverse = this._config?.size?.inverse === true;
    // When size.inverse is true, sizeValues are inverted (small original values become large sizeValues)
    // So for visual ordering (order: asc = small original values first), we need to flip the ascending flag
    const isAsc = sizeInverse ? !orderAsc : orderAsc;
    let sortedData = [...data].sort((a, b) =>
      isAsc ? a.sizeValue - b.sizeValue : b.sizeValue - a.sizeValue
    );

    // Apply limit if configured
    if (this._config?.limit !== undefined && this._config.limit > 0) {
      sortedData = sortedData.slice(0, this._config.limit);
    }

    // Generate treemap layout using sizeValue
    // If size.equal mode, give all items equal weight for sizing
    const equalSize = this._config?.size?.equal === true;

    // Build a map of label -> original values for restoration after squarify
    // squarify reorders items internally, so we can't rely on index matching
    const originalValues = new Map<
      string,
      { value: number; colorValue: number; sizeValue: number; unit?: string }
    >();
    for (const d of sortedData) {
      originalValues.set(d.label, {
        value: d.value,
        colorValue: d.colorValue,
        sizeValue: d.sizeValue,
        unit: d.unit,
      });
    }

    // squarify uses 'value' field for sizing
    const layoutInput = sortedData.map(d => ({ ...d, value: d.sizeValue }));
    const rects = squarify(layoutInput, 100, 100, {
      compressRange: true,
      equalSize,
      ascending: isAsc,
    });

    // Restore original display values by matching on label
    for (const rect of rects) {
      const original = originalValues.get(rect.label);
      if (original) {
        rect.value = original.value;
        rect.colorValue = original.colorValue;
        rect.sizeValue = original.sizeValue;
        rect.unit = original.unit;
      }
    }

    // Dynamic height: ~80px per item, min 200, no max
    const baseHeight = Math.max(200, data.length * 80);
    const height = this._config.height ?? baseHeight;
    const gap = this._config.gap ?? 6;

    // Debug: check if rects fill 100%
    const maxY = Math.max(...rects.map(r => r.y + r.height));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    console.log(
      `[treemap] Rects maxX=${maxX.toFixed(1)}%, maxY=${maxY.toFixed(1)}%, height=${height}px, items=${data.length}`
    );

    return html`
      <ha-card header="${haTitle || nothing}" style="${cardStyle}">
        ${showCustomHeader && customHeaderTitle
          ? html`<div class="treemap-header" style="${headerStyle}">${customHeaderTitle}</div>`
          : nothing}
        <div class="card-content">
          <div class="treemap-container" style="height: ${height}px">
            ${rects.map(rect => this._renderRect(rect, min, max, height, gap))}
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderRect(
    rect: TreemapRect,
    min: number,
    max: number,
    _containerHeight: number,
    gap: number
  ): TemplateResult {
    // Use light-specific color for light entities, otherwise standard color gradient
    const color = rect.light
      ? this._getLightColor(rect)
      : this._getColor(rect.colorValue, min, max);
    const sizeClass = this._getSizeClass(rect);

    const showIcon = this._config?.icon?.show ?? true;
    const showLabel = this._config?.label?.show ?? true;
    const showValue = this._config?.value?.show ?? true;

    // Apply label replace regex if configured
    let displayLabel = rect.label;
    const replacePattern = this._config?.label?.replace;
    if (replacePattern) {
      const parts = replacePattern.split('/');
      const pattern = parts[0];
      const replacement = parts[1];
      if (parts.length >= 2 && pattern !== undefined && replacement !== undefined) {
        try {
          const regex = new RegExp(pattern, parts[2] ?? '');
          displayLabel = rect.label.replace(regex, replacement);
        } catch {
          // Invalid regex, use original label
        }
      }
    }

    // Apply prefix/suffix
    const labelPrefix = this._config?.label?.prefix || '';
    const labelSuffix = this._config?.label?.suffix || '';
    const valuePrefix = this._config?.value?.prefix;
    const valueSuffix = this._config?.value?.suffix;

    const formattedLabel = `${labelPrefix}${displayLabel}${labelSuffix}`;

    // If prefix or suffix is defined, use only those. Otherwise, auto-append unit from entity.
    const hasCustomFormat = valuePrefix !== undefined || valueSuffix !== undefined;
    const formattedValue = hasCustomFormat
      ? `${valuePrefix || ''}${rect.value.toFixed(1)}${valueSuffix || ''}`
      : `${rect.value.toFixed(1)}${rect.unit ? ` ${rect.unit}` : ''}`;

    // Calculate gap in percentage terms
    // Container is 100% wide, gap is in pixels, so we need to use calc()
    const halfGap = gap / 2;

    // Calculate contrasting text colors based on background
    const textColors = getContrastColors(color);

    // Custom styles (user styles override auto contrast)
    const iconStyle = this._config?.icon?.style || '';
    const labelStyle = this._config?.label?.style || '';
    const valueStyle = this._config?.value?.style || '';

    // Only apply auto text color if no custom style is set
    const autoIconStyle = iconStyle || `color: ${textColors.icon};`;
    const autoLabelStyle = labelStyle || `color: ${textColors.label};`;
    const autoValueStyle = valueStyle || `color: ${textColors.value};`;

    return html`
      <div
        class="treemap-item ${sizeClass}"
        style="
          left: calc(${rect.x}% + ${halfGap}px);
          top: calc(${rect.y}% + ${halfGap}px);
          width: calc(${rect.width}% - ${gap}px);
          height: calc(${rect.height}% - ${gap}px);
          background-color: ${color};
        "
        @click="${() => this._handleClick(rect)}"
        title="${rect.label}: ${rect.value}"
      >
        ${showIcon && (this._config?.icon?.icon || rect.icon)
          ? html`<ha-icon
              class="treemap-icon"
              style="${autoIconStyle}"
              icon="${this._config?.icon?.icon || rect.icon}"
            ></ha-icon>`
          : nothing}
        ${showLabel
          ? html`<span class="treemap-label" style="${autoLabelStyle}">${formattedLabel}</span>`
          : nothing}
        ${showValue
          ? html`<span class="treemap-value" style="${autoValueStyle}">${formattedValue}</span>`
          : nothing}
      </div>
    `;
  }

  private _handleClick(rect: TreemapRect): void {
    if (!rect.entity_id) return;

    const event = new CustomEvent('hass-more-info', {
      bubbles: true,
      composed: true,
      detail: { entityId: rect.entity_id },
    });
    this.dispatchEvent(event);
  }
}

// Register card for picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'treemap-card',
  name: 'Treemap Card',
  description: 'Visualize entities as a treemap with size and color based on values',
  preview: true,
});

declare global {
  interface HTMLElementTagNameMap {
    'treemap-card': TreemapCard;
  }
}
