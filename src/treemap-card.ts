import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, TreemapCardConfig, TreemapItem, TreemapRect } from './types';
import { squarify } from './squarify';
import { styles } from './styles';

const CARD_VERSION = '0.3.6';

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
 * Interpolate between two colors based on value 0-1
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
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
      value_attribute: 'state',
      label_attribute: 'friendly_name',
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

  private _resolveEntities(patterns: string[]): TreemapItem[] {
    if (!this.hass) return [];

    const items: TreemapItem[] = [];
    const allEntityIds = Object.keys(this.hass.states);

    for (const pattern of patterns) {
      const matchingIds = allEntityIds.filter(id => matchesPattern(id, pattern));

      for (const entityId of matchingIds) {
        const entity = this.hass.states[entityId];
        if (!entity) continue;

        const valueAttr = this._config?.value_attribute || 'state';
        const labelAttr = this._config?.label_attribute || 'friendly_name';

        let value: number;
        if (valueAttr === 'state') {
          value = parseFloat(entity.state);
        } else {
          value = parseFloat(String(entity.attributes[valueAttr] ?? 0));
        }

        if (isNaN(value)) continue;

        const label =
          labelAttr === 'entity_id'
            ? entityId
            : String(entity.attributes[labelAttr] ?? entityId.split('.').pop());

        const icon = entity.attributes['icon'] as string | undefined;

        items.push({
          label,
          value,
          sizeValue: Math.abs(value),
          colorValue: value,
          entity_id: entityId,
          icon,
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
    const colorParam = this._config?.color_param || valueParam;
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
    // color.high = high/good values (green), fallback to deprecated color_high
    return this._config?.color?.high || this._config?.color_high || '#16a34a';
  }

  private _getColorLow(): string {
    // color.low = low/bad values (red), fallback to deprecated color_low
    return this._config?.color?.low || this._config?.color_low || '#b91c1c';
  }

  private _getColor(value: number, min: number, max: number): string {
    // New format: color.scale.*, fallback to deprecated color.*_value
    const neutral = this._config?.color?.scale?.neutral ?? this._config?.color?.neutral_value;
    const minValue = this._config?.color?.scale?.min ?? this._config?.color?.min_value ?? min;
    const maxValue = this._config?.color?.scale?.max ?? this._config?.color?.max_value ?? max;

    // Clamp value to min/max range
    const clampedValue = Math.max(minValue, Math.min(maxValue, value));

    // If neutral_value is set, use it as the center point
    if (neutral !== undefined) {
      // Below neutral: interpolate from low (red) to neutral (mix)
      // Above neutral: interpolate from neutral (mix) to high (green)
      if (clampedValue <= neutral) {
        // value is below neutral - use red side
        // factor 0 = minValue (full red), factor 1 = neutral (50% mix)
        if (minValue >= neutral)
          return interpolateColor(this._getColorLow(), this._getColorHigh(), 0.5);
        const factor = (clampedValue - minValue) / (neutral - minValue);
        return interpolateColor(this._getColorLow(), this._getColorHigh(), factor * 0.5);
      } else {
        // value is above neutral - use green side
        // factor 0 = neutral (50% mix), factor 1 = maxValue (full green)
        if (maxValue <= neutral)
          return interpolateColor(this._getColorLow(), this._getColorHigh(), 0.5);
        const factor = (clampedValue - neutral) / (maxValue - neutral);
        return interpolateColor(this._getColorLow(), this._getColorHigh(), 0.5 + factor * 0.5);
      }
    }

    // Default: factor 0 = min (low), factor 1 = max (high)
    if (maxValue === minValue) return this._getColorHigh();
    const factor = (clampedValue - minValue) / (maxValue - minValue);
    return interpolateColor(this._getColorLow(), this._getColorHigh(), factor);
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

  private _filterData(data: TreemapItem[]): TreemapItem[] {
    if (!this._config) return data;

    // New format: filter.above/below, fallback to deprecated filter_above/below
    const filterAbove = this._config.filter?.above ?? this._config.filter_above;
    const filterBelow = this._config.filter?.below ?? this._config.filter_below;

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

    if (data.length === 0) {
      return html`
        <ha-card header="${this._config.title || nothing}">
          <div class="card-content">
            <div class="empty">No data available</div>
          </div>
        </ha-card>
      `;
    }

    // Calculate min/max for color scale (use colorValue)
    const colorValues = data.map(d => d.colorValue);
    const min = this._config.min ?? Math.min(...colorValues);
    const max = this._config.max ?? Math.max(...colorValues);

    // Sort data by sizeValue descending (largest first = top-left)
    const sortedData = [...data].sort((a, b) => b.sizeValue - a.sizeValue);

    // Generate treemap layout using sizeValue
    // If size.equal mode, give all items equal weight for sizing
    const sizeEqual = this._config?.size?.equal;
    const equalSizeLegacy = this._config?.equal_size;
    const equalSize = sizeEqual === true || equalSizeLegacy === true;

    // squarify uses 'value' field for sizing
    const layoutInput = sortedData.map(d => ({ ...d, value: d.sizeValue }));
    const rects = squarify(layoutInput, 100, 100, true, equalSize);

    // Restore original values after layout
    rects.forEach((rect, i) => {
      const original = sortedData[i];
      if (original) {
        rect.value = original.value;
        rect.colorValue = original.colorValue;
        rect.sizeValue = original.sizeValue;
      }
    });

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
      <ha-card header="${this._config.title || nothing}">
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
    containerHeight: number,
    gap: number
  ): TemplateResult {
    const color = this._getColor(rect.colorValue, min, max);
    const sizeClass = this._getSizeClass(rect);

    // Show config with defaults (all true) - new format first, then deprecated
    const showIcon = this._config?.icon?.show ?? this._config?.show?.icon ?? true;
    const showLabel = this._config?.label?.show ?? this._config?.show?.label ?? true;
    const showValue = this._config?.value?.show ?? this._config?.show?.value ?? true;

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
    const valuePrefix = this._config?.value?.prefix || '';
    const valueSuffix = this._config?.value?.suffix || '';

    const formattedLabel = `${labelPrefix}${displayLabel}${labelSuffix}`;
    const formattedValue = `${valuePrefix}${rect.value.toFixed(1)}${valueSuffix}`;

    // Calculate gap in percentage terms
    // Container is 100% wide, gap is in pixels, so we need to use calc()
    const halfGap = gap / 2;

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
        ${showIcon && rect.icon
          ? html`<ha-icon class="treemap-icon" icon="${rect.icon}"></ha-icon>`
          : nothing}
        ${showLabel ? html`<span class="treemap-label">${formattedLabel}</span>` : nothing}
        ${showValue ? html`<span class="treemap-value">${formattedValue}</span>` : nothing}
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
