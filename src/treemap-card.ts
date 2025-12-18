import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, TreemapCardConfig, TreemapItem, TreemapRect } from './types';
import { getNumber, getString } from './utils/predicates';
import { isLightEntity, extractLightInfo } from './utils/lights';
import { isClimateEntity, extractClimateInfo, getClimateValue } from './utils/climate';
import { hsToRgb, parseColor, getContrastColors, interpolateColor } from './utils/colors';
import { renderSparklineWithData } from './utils/sparkline';
import { getHistoryData, type HistoryPeriod } from './utils/history';
import { squarify } from './squarify';
import { styles } from './styles';

declare const __VERSION__: string;
const CARD_VERSION = __VERSION__;

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

@customElement('treemap-card')
export class TreemapCard extends LitElement {
  static override styles = styles;

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: TreemapCardConfig;
  @state() private _sparklineData = new Map<string, number[]>();
  private _fetchingSparklines = false;

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

  protected override updated(): void {
    void this._fetchSparklineData();
  }

  private async _fetchSparklineData(): Promise<void> {
    if (!this.hass || this._fetchingSparklines) return;

    // Check if sparklines are disabled
    if (this._config?.sparkline?.show === false) return;

    // Get entity IDs from resolved data
    const data = this._resolveData();
    const entityIds = data.map(d => d.entity_id).filter((id): id is string => !!id);

    if (entityIds.length === 0) return;

    this._fetchingSparklines = true;

    try {
      // Get period from config (default: 24h)
      const period: HistoryPeriod = this._config?.sparkline?.period || '24h';

      // Fetch history data (uses cache internally)
      const historyData = await getHistoryData(this.hass, entityIds, period);

      // Only update state if we got new data
      if (historyData.size > 0 && historyData.size !== this._sparklineData.size) {
        this._sparklineData = historyData;
      }
    } finally {
      this._fetchingSparklines = false;
    }
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

        const icon = getString(entity.attributes['icon']);

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

        // Special handling for climate entities
        if (isClimateEntity(entityId)) {
          const climateInfo = extractClimateInfo(entity);

          // Determine what to display/size/color based on config
          const valueAttr = this._config?.value?.attribute || 'current_temperature';
          const sizeAttr = this._config?.size?.attribute || valueAttr;
          const colorAttr = this._config?.color?.attribute || valueAttr;

          // Get values (supports computed attributes like temp_difference, temp_offset)
          let displayValue = getClimateValue(climateInfo, valueAttr);
          let sizeValue = getClimateValue(climateInfo, sizeAttr);
          let colorValue = getClimateValue(climateInfo, colorAttr);

          // Fall back to entity attributes if not a computed value
          if (displayValue === null) {
            displayValue = getNumber(entity.attributes[valueAttr]) ?? 0;
          }
          if (sizeValue === null) {
            sizeValue = getNumber(entity.attributes[sizeAttr]) ?? 0;
          }
          if (colorValue === null) {
            colorValue = getNumber(entity.attributes[colorAttr]) ?? 0;
          }

          // For numeric operations, convert to numbers
          const numDisplayValue = typeof displayValue === 'number' ? displayValue : 0;
          // Ensure sizeValue has a minimum so items are always visible
          const numSizeValue =
            typeof sizeValue === 'number' ? Math.max(0.1, Math.abs(sizeValue)) : 0.1;
          const numColorValue = typeof colorValue === 'number' ? colorValue : 0;

          // Determine icon: use entity's custom icon if set, otherwise base on hvac_action
          let climateIcon: string;
          if (icon) {
            // Entity has a custom icon set - use it
            climateIcon = icon;
          } else if (climateInfo.hvacAction === 'heating') {
            climateIcon = 'mdi:fire';
          } else if (climateInfo.hvacAction === 'cooling') {
            climateIcon = 'mdi:snowflake';
          } else if (climateInfo.hvacAction === 'off') {
            climateIcon = 'mdi:thermostat-off';
          } else {
            climateIcon = 'mdi:thermostat';
          }

          items.push({
            label,
            value: numDisplayValue,
            sizeValue: numSizeValue,
            colorValue: numColorValue,
            entity_id: entityId,
            icon: climateIcon,
            unit: getString(entity.attributes['unit_of_measurement']),
            climate: climateInfo,
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

        const unit = getString(entity.attributes['unit_of_measurement']);

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

    // Get field mappings from config (attribute is primary, param is deprecated alias)
    const labelAttr = this._config?.label?.attribute ?? this._config?.label?.param ?? 'label';
    const valueAttr = this._config?.value?.attribute ?? this._config?.value?.param ?? 'value';
    const sizeAttr = this._config?.size?.attribute ?? this._config?.size?.param ?? valueAttr;
    const colorAttr = this._config?.color?.attribute ?? this._config?.color?.param ?? valueAttr;
    const iconAttr = this._config?.icon?.attribute ?? this._config?.icon?.param ?? 'icon';
    const sparklineAttr = this._config?.sparkline?.attribute;

    return data
      .filter((item): item is Record<string, unknown> => {
        return typeof item === 'object' && item !== null;
      })
      .map(item => {
        // Extract sparkline data if configured
        let sparklineData: number[] | undefined;
        if (sparklineAttr) {
          const rawData = item[sparklineAttr];
          if (Array.isArray(rawData)) {
            sparklineData = rawData.filter((v): v is number => typeof v === 'number');
          }
        }

        return {
          label: String(item[labelAttr] ?? item['label'] ?? ''),
          value: Number(item[valueAttr] ?? 0),
          sizeValue: Math.abs(Number(item[sizeAttr] ?? item[valueAttr] ?? 0)),
          colorValue: Number(item[colorAttr] ?? item[valueAttr] ?? 0),
          icon: getString(item[iconAttr]),
          entity_id: getString(item['entity_id']),
          sparklineData,
        };
      })
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

  /**
   * Get color for HVAC action (categorical coloring)
   * Also considers hvac_mode since HA reports hvac_action as 'idle' when mode is 'off'
   */
  private _getHvacColor(hvacAction: string | null, hvacMode: string | null): string | null {
    const hvacConfig = this._config?.color?.hvac;
    if (!hvacConfig) return null;

    const opacity = this._getOpacity();

    // Default HVAC colors
    const defaults = {
      heating: '#ff6b35', // orange
      cooling: '#4dabf7', // blue
      idle: '#69db7c', // green
      off: '#868e96', // gray
    };

    // If hvac_mode is 'off', use off color regardless of hvac_action
    // HA reports hvac_action as 'idle' even when thermostat is off
    if (hvacMode === 'off') {
      const color = hvacConfig.off ?? defaults.off;
      if (opacity !== undefined) {
        const rgb = parseColor(color);
        if (rgb) {
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
        }
      }
      return color;
    }

    let color: string | undefined;
    switch (hvacAction) {
      case 'heating':
        color = hvacConfig.heating ?? defaults.heating;
        break;
      case 'cooling':
        color = hvacConfig.cooling ?? defaults.cooling;
        break;
      case 'idle':
        color = hvacConfig.idle ?? defaults.idle;
        break;
      case 'off':
      case null:
        // HA often reports null hvac_action when thermostat is off
        color = hvacConfig.off ?? defaults.off;
        break;
      default:
        color = defaults.idle;
    }

    if (opacity !== undefined && color) {
      const rgb = parseColor(color);
      if (rgb) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
      }
    }

    return color ?? null;
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
      // Ensure minimum floor after inverse to prevent extreme ratios
      // Without this, items with original max values become near-zero after inverse,
      // and then get destroyed by sqrt compression in squarify
      const invertedMax = Math.max(...data.map(d => d.sizeValue));
      const minFloor = invertedMax * 0.1; // At least 10% of max
      data.forEach(d => {
        if (d.sizeValue < minFloor) {
          d.sizeValue = minFloor;
        }
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

    // Apply size.min and size.max to ensure all items are visible
    // This must happen before squarify which filters out zero-sized items
    const sizeMax = this._config?.size?.max;
    const sizeMin = this._config?.size?.min;

    // First apply max cap if configured
    if (sizeMax !== undefined) {
      for (const d of sortedData) {
        if (d.sizeValue > sizeMax) {
          d.sizeValue = sizeMax;
        }
      }
    }

    // Then apply min floor (default: 15% of max sizeValue)
    // Higher default ensures items with 0 or small values remain visible
    const currentMax = Math.max(...sortedData.map(d => d.sizeValue), 1);
    const effectiveMin = sizeMin ?? currentMax * 0.15;
    for (const d of sortedData) {
      if (d.sizeValue < effectiveMin) {
        d.sizeValue = effectiveMin;
      }
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

    // Dynamic height based on number of rows (not items)
    // Count unique Y positions to estimate rows
    const uniqueYPositions = new Set(rects.map(r => Math.round(r.y)));
    const numRows = Math.max(1, uniqueYPositions.size);
    const baseHeight = Math.max(150, numRows * 100); // 100px per row, min 150px
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
    // Determine color: climate off/unavailable > active HVAC > light entities > standard gradient
    let color: string;

    // Climate entities that are off or unavailable always get gray color
    // This takes precedence over any color configuration
    if (
      rect.climate &&
      (rect.climate.hvacMode === 'off' || rect.climate.hvacMode === 'unavailable')
    ) {
      const opacity = this._getOpacity();
      const offColor = this._config?.color?.hvac?.off ?? '#868e96';
      if (opacity !== undefined) {
        const rgb = parseColor(offColor);
        if (rgb) {
          color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
        } else {
          color = offColor;
        }
      } else {
        color = offColor;
      }
    } else if (rect.climate && this._config?.color?.hvac) {
      // HVAC colors only override when ACTIVELY heating/cooling
      // idle/off states fall back to gradient so you can see the temp offset
      const hvacConfig = this._config.color.hvac;
      const opacity = this._getOpacity();
      if (rect.climate.hvacAction === 'heating' && hvacConfig.heating) {
        const c = hvacConfig.heating;
        if (opacity !== undefined) {
          const rgb = parseColor(c);
          color = rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})` : c;
        } else {
          color = c;
        }
      } else if (rect.climate.hvacAction === 'cooling' && hvacConfig.cooling) {
        const c = hvacConfig.cooling;
        if (opacity !== undefined) {
          const rgb = parseColor(c);
          color = rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})` : c;
        } else {
          color = c;
        }
      } else {
        // idle, off, or no active action - use gradient
        color = this._getColor(rect.colorValue, min, max);
      }
    } else if (rect.light) {
      color = this._getLightColor(rect);
    } else {
      color = this._getColor(rect.colorValue, min, max);
    }
    const sizeClass = this._getSizeClass(rect);

    // Check if HVAC is actively heating/cooling (for pulsing animation)
    const isHvacActive =
      rect.climate?.hvacAction === 'heating' || rect.climate?.hvacAction === 'cooling';

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

    // Add + sign for positive temp_offset values (negative already has -, zero has no sign)
    const isTempOffset = this._config?.value?.attribute === 'temp_offset';
    const signPrefix = isTempOffset && rect.value > 0 ? '+' : '';

    // If prefix or suffix is defined, use only those. Otherwise, auto-append unit from entity.
    const hasCustomFormat = valuePrefix !== undefined || valueSuffix !== undefined;
    const formattedValue = hasCustomFormat
      ? `${valuePrefix || ''}${signPrefix}${rect.value.toFixed(1)}${valueSuffix || ''}`
      : `${signPrefix}${rect.value.toFixed(1)}${rect.unit ? ` ${rect.unit}` : ''}`;

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
              class="treemap-icon ${isHvacActive ? 'hvac-active' : ''}"
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
        ${this._config?.sparkline?.show !== false
          ? html`<div class="treemap-sparkline">
              ${renderSparklineWithData(
                rect.sparklineData ??
                  (rect.entity_id ? this._sparklineData.get(rect.entity_id) : undefined),
                {
                  mode: this._config?.sparkline?.mode || 'dark',
                  line: this._config?.sparkline?.line,
                  fill: this._config?.sparkline?.fill,
                }
              )}
            </div>`
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
