import { LitElement, html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, TreemapCardConfig, TreemapItem, TreemapRect } from './types';
import { getNumber, getString, matchesPattern } from './utils/predicates';
import { isLightEntity, extractLightInfo, getLightBackgroundColor } from './utils/lights';
import { isClimateEntity, extractClimateInfo, getClimateValue } from './utils/climate';
import {
  getContrastColors,
  getGradientColor,
  applyOpacity,
  type GradientColorOptions,
} from './utils/colors';
import { renderSparklineWithData } from './utils/sparkline';
import { getHistoryData, type HistoryPeriod, type SparklineData } from './utils/history';
import { squarify } from './utils/squarify';
import { prepareTreemapData } from './utils/data';
import { styles } from './styles';

declare const __VERSION__: string;
const CARD_VERSION = __VERSION__;

console.info(
  `%c TREEMAP-CARD %c v${CARD_VERSION}`,
  'color: white; background: #3498db; font-weight: bold;',
  'color: #3498db; background: white; font-weight: bold;'
);

@customElement('treemap-card')
export class TreemapCard extends LitElement {
  static override styles = styles;

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: TreemapCardConfig;
  @state() private _sparklineData = new Map<string, SparklineData>();
  private _fetchingSparklines = false;
  private _lastRelevantStates: string | undefined;
  private _cachedData: TreemapItem[] | undefined;
  private _cachedDataHash: string | undefined;
  private _sparklineDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Optimize re-renders: only update when relevant entity states change
   */
  protected override shouldUpdate(changedProps: PropertyValues): boolean {
    // Always update if config or sparkline data changed
    if (changedProps.has('_config') || changedProps.has('_sparklineData')) {
      return true;
    }

    // For hass changes, check if relevant entities changed
    if (changedProps.has('hass') && this.hass && this._config) {
      const relevantStates = this._getRelevantStatesHash();
      if (relevantStates !== this._lastRelevantStates) {
        this._lastRelevantStates = relevantStates;
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Get a hash of relevant entity states for change detection
   */
  private _getRelevantStatesHash(): string {
    if (!this.hass) return '';

    const entityIds = this._getConfiguredEntityIds();
    const states: string[] = [];

    for (const id of entityIds) {
      const entity = this.hass.states[id];
      if (entity) {
        // Include state and key attributes that affect rendering
        states.push(`${id}:${entity.state}:${entity.last_updated}`);
      }
    }

    return states.join('|');
  }

  /**
   * Get entity IDs from config (supports wildcards)
   */
  private _getConfiguredEntityIds(): string[] {
    if (!this.hass || !this._config) return [];

    // For JSON mode, just the single entity
    if (this._config.entity) {
      return [this._config.entity];
    }

    // For entities mode, expand wildcards
    if (this._config.entities) {
      const allEntityIds = Object.keys(this.hass.states);
      const result: string[] = [];

      for (const pattern of this._config.entities) {
        if (pattern.includes('*')) {
          // Wildcard pattern - match against all entities
          for (const id of allEntityIds) {
            if (matchesPattern(id, pattern)) {
              result.push(id);
            }
          }
        } else {
          result.push(pattern);
        }
      }

      return result;
    }

    return [];
  }

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
    // Debounce sparkline fetching to reduce API calls
    if (this._sparklineDebounceTimer) {
      clearTimeout(this._sparklineDebounceTimer);
    }
    this._sparklineDebounceTimer = setTimeout(() => {
      void this._fetchSparklineData();
    }, 100);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._sparklineDebounceTimer) {
      clearTimeout(this._sparklineDebounceTimer);
    }
  }

  private async _fetchSparklineData(): Promise<void> {
    if (!this.hass || this._fetchingSparklines) return;

    // Check if sparklines are disabled
    if (this._config?.sparkline?.show === false) return;

    // Get entity IDs from resolved data
    const data = this._resolveData();
    const entityIds = data.map(({ entity_id }) => entity_id).filter((id): id is string => !!id);

    if (entityIds.length === 0) return;

    this._fetchingSparklines = true;

    try {
      // Get period from config (default: 24h)
      const period: HistoryPeriod = this._config?.sparkline?.period || '24h';

      // Fetch history data (uses cache internally)
      const historyData = await getHistoryData(this.hass, entityIds, period);

      // Only update state if data actually changed (avoid triggering re-renders)
      if (historyData.size > 0 && !this._sparklineDataEquals(historyData)) {
        this._sparklineData = historyData;
      }
    } finally {
      this._fetchingSparklines = false;
    }
  }

  /**
   * Compare sparkline data maps to avoid unnecessary re-renders.
   */
  private _sparklineDataEquals(newData: Map<string, SparklineData>): boolean {
    if (this._sparklineData.size !== newData.size) return false;

    for (const [key, newValue] of newData) {
      const oldValue = this._sparklineData.get(key);
      if (!oldValue) return false;

      // Compare temperature arrays
      if (oldValue.temperature.length !== newValue.temperature.length) return false;

      // Compare hvacActions arrays
      const oldHvac = oldValue.hvacActions?.length ?? 0;
      const newHvac = newValue.hvacActions?.length ?? 0;
      if (oldHvac !== newHvac) return false;
    }

    return true;
  }

  /**
   * Get period hours from config for HVAC quantization.
   */
  private _getPeriodHours(): number {
    const period = this._config?.sparkline?.period || '24h';
    const periodMap: Record<string, number> = {
      '12h': 12,
      '24h': 24,
      '7d': 7 * 24,
      '30d': 30 * 24,
    };
    return periodMap[period] ?? 24;
  }

  private _resolveData(): TreemapItem[] {
    if (!this.hass || !this._config) return [];

    // Check cache - use states hash for cache key
    const currentHash = this._lastRelevantStates;
    if (this._cachedData && this._cachedDataHash === currentHash) {
      return this._cachedData;
    }

    // Mode 1 & 2: entities list (with wildcard support)
    let data: TreemapItem[];
    if (this._config.entities) {
      data = this._resolveEntities(this._config.entities);
    } else if (this._config.entity) {
      // Mode 3: single entity with JSON array
      data = this._resolveJsonEntity(this._config.entity);
    } else {
      data = [];
    }

    // Cache the result
    this._cachedData = data;
    this._cachedDataHash = currentHash;

    return data;
  }

  private _isExcluded(entityId: string): boolean {
    const excludePatterns = this._config?.exclude;
    if (!excludePatterns || excludePatterns.length === 0) return false;
    for (const pattern of excludePatterns) {
      if (matchesPattern(entityId, pattern)) {
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

        const labelAttribute = this._config?.label?.attribute || 'friendly_name';
        const label =
          labelAttribute === 'entity_id'
            ? entityId
            : String(entity.attributes[labelAttribute] ?? entityId.split('.').pop());

        const icon = getString(entity.attributes['icon']);

        // Special handling for light entities
        if (isLightEntity(entityId)) {
          const lightInfo = extractLightInfo(entity);
          const { brightness } = lightInfo;

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
          const valueAttribute = this._config?.value?.attribute || 'current_temperature';
          const sizeAttribute = this._config?.size?.attribute || valueAttribute;
          const colorAttribute = this._config?.color?.attribute || valueAttribute;

          // Get values (supports computed attributes like temp_difference, temp_offset)
          let displayValue = getClimateValue(climateInfo, valueAttribute);
          let sizeValue = getClimateValue(climateInfo, sizeAttribute);
          let colorValue = getClimateValue(climateInfo, colorAttribute);

          // Fall back to entity attributes if not a computed value
          if (displayValue === null) {
            displayValue = getNumber(entity.attributes[valueAttribute]) ?? 0;
          }
          if (sizeValue === null) {
            sizeValue = getNumber(entity.attributes[sizeAttribute]) ?? 0;
          }
          if (colorValue === null) {
            colorValue = getNumber(entity.attributes[colorAttribute]) ?? 0;
          }

          // For numeric operations, convert to numbers
          const numberDisplayValue = typeof displayValue === 'number' ? displayValue : 0;
          // Ensure sizeValue has a minimum so items are always visible
          const numberSizeValue =
            typeof sizeValue === 'number' ? Math.max(0.1, Math.abs(sizeValue)) : 0.1;
          const numberColorValue = typeof colorValue === 'number' ? colorValue : 0;

          // Determine icon: use entity's custom icon if set, otherwise base on hvac_action
          let climateIcon: string;
          if (icon) {
            // Entity has a custom icon set - use it
            climateIcon = icon;
          } else
            switch (climateInfo.hvacAction) {
              case 'heating': {
                climateIcon = 'mdi:fire';

                break;
              }
              case 'cooling': {
                climateIcon = 'mdi:snowflake';

                break;
              }
              case 'off': {
                climateIcon = 'mdi:thermostat-off';

                break;
              }
              default: {
                climateIcon = 'mdi:thermostat';
              }
            }

          items.push({
            label,
            value: numberDisplayValue,
            sizeValue: numberSizeValue,
            colorValue: numberColorValue,
            entity_id: entityId,
            icon: climateIcon,
            unit: getString(entity.attributes['unit_of_measurement']),
            climate: climateInfo,
          });
          continue;
        }

        // Standard entity handling
        const valueAttribute = this._config?.value?.attribute || 'state';
        let value: number;
        if (valueAttribute === 'state') {
          value = Number.parseFloat(entity.state);
        } else {
          value = Number.parseFloat(String(entity.attributes[valueAttribute] ?? 0));
        }

        if (Number.isNaN(value)) continue;

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
    const dataAttribute = this._config?.data_attribute || 'items';
    const data = entity.attributes[dataAttribute];

    if (!Array.isArray(data)) return [];

    // Get field mappings from config (attribute is primary, param is deprecated alias)
    const labelAttribute = this._config?.label?.attribute ?? this._config?.label?.param ?? 'label';
    const valueAttribute = this._config?.value?.attribute ?? this._config?.value?.param ?? 'value';
    const sizeAttribute =
      this._config?.size?.attribute ?? this._config?.size?.param ?? valueAttribute;
    const colorAttribute =
      this._config?.color?.attribute ?? this._config?.color?.param ?? valueAttribute;
    const iconAttribute = this._config?.icon?.attribute ?? this._config?.icon?.param ?? 'icon';
    const sparklineAttribute = this._config?.sparkline?.attribute;

    return data
      .filter((item): item is Record<string, unknown> => {
        return typeof item === 'object' && item !== null;
      })
      .map(item => {
        // Extract sparkline data if configured
        let sparklineData: number[] | undefined;
        if (sparklineAttribute) {
          const rawData = item[sparklineAttribute];
          if (Array.isArray(rawData)) {
            sparklineData = rawData.filter((v): v is number => typeof v === 'number');
          }
        }

        return {
          label: String(item[labelAttribute] ?? item['label'] ?? ''),
          value: Number(item[valueAttribute] ?? 0),
          sizeValue: Math.abs(Number(item[sizeAttribute] ?? item[valueAttribute] ?? 0)),
          colorValue: Number(item[colorAttribute] ?? item[valueAttribute] ?? 0),
          icon: getString(item[iconAttribute]),
          entity_id: getString(item['entity_id']),
          sparklineData,
        };
      })
      .filter(item => item.label && !Number.isNaN(item.value));
  }

  private _getGradientColorOptions(): GradientColorOptions {
    return {
      colorHigh: this._config?.color?.high || '#16a34a',
      colorLow: this._config?.color?.low || '#b91c1c',
      colorMid: this._config?.color?.mid,
      scaleMin: this._config?.color?.scale?.min,
      scaleMax: this._config?.color?.scale?.max,
      neutral: this._config?.color?.scale?.neutral,
      opacity: this._config?.color?.opacity,
    };
  }

  private _getColor(value: number, min: number, max: number): string {
    return getGradientColor(value, min, max, this._getGradientColorOptions());
  }

  private _getSizeClass(rect: TreemapRect): string {
    // Area is in percentage units (0-100 x 0-100 = 0-10000)
    const area = rect.width * rect.height;
    if (area < 50) return 'tiny'; // < ~7% x 7%
    if (area < 150) return 'small'; // < ~12% x 12%
    return '';
  }

  private _getLightColor(rect: TreemapRect): string {
    const offColor = this._config?.color?.low ?? '#333333';
    const onColor = this._config?.color?.high ?? '#fbbf24'; // Amber/yellow
    return getLightBackgroundColor(rect.light, offColor, onColor);
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

    // Prepare data: calculate stats, apply sizing options, sort (optimized single-pass)
    const {
      items: sortedData,
      colorMin: min,
      colorMax: max,
    } = prepareTreemapData(data, {
      inverse: this._config?.size?.inverse,
      ascending: this._config?.order === 'asc',
      limit: this._config?.limit,
      sizeMin: this._config?.size?.min,
      sizeMax: this._config?.size?.max,
    });

    // Generate treemap layout using sizeValue
    // If size.equal mode, give all items equal weight for sizing
    const equalSize = this._config?.size?.equal === true;

    // Build a map of entity_id -> original values for restoration after squarify
    // squarify reorders items internally, so we can't rely on index matching
    // We use entity_id as key (not label) because multiple entities can share the same friendly_name
    const originalValues = new Map<
      string,
      { value: number; colorValue: number; sizeValue: number; unit?: string }
    >();
    for (const item of sortedData) {
      // Use entity_id as unique key, fall back to label for JSON mode (no entity_id)
      const key = item.entity_id ?? item.label;
      originalValues.set(key, {
        value: item.value,
        colorValue: item.colorValue,
        sizeValue: item.sizeValue,
        unit: item.unit,
      });
    }

    // squarify uses 'value' field for sizing
    const layoutInput = sortedData.map(item => ({ ...item, value: item.sizeValue }));
    const orderAsc = this._config?.order === 'asc';
    const sizeInverse = this._config?.size?.inverse === true;
    const isAsc = sizeInverse ? !orderAsc : orderAsc;
    const rects = squarify(layoutInput, 100, 100, {
      compressRange: true,
      equalSize,
      ascending: isAsc,
    });

    // Restore original display values by matching on entity_id (or label for JSON mode)
    for (const rect of rects) {
      const key = rect.entity_id ?? rect.label;
      const original = originalValues.get(key);
      if (original) {
        rect.value = original.value;
        rect.colorValue = original.colorValue;
        rect.sizeValue = original.sizeValue;
        rect.unit = original.unit;
      }
    }

    // Dynamic height based on number of rows (not items)
    // Count unique Y positions to estimate rows
    const uniqueYPositions = new Set(rects.map(rect => Math.round(rect.y)));
    const numberRows = Math.max(1, uniqueYPositions.size);
    const baseHeight = Math.max(150, numberRows * 100); // 100px per row, min 150px
    const height = this._config.height ?? baseHeight;
    const gap = this._config.gap ?? 6;

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
    const opacity = this._config?.color?.opacity;

    // Climate entities that are off or unavailable always get gray color
    if (
      rect.climate &&
      (rect.climate.hvacMode === 'off' || rect.climate.hvacMode === 'unavailable')
    ) {
      const offColor = this._config?.color?.hvac?.off ?? '#868e96';
      color = opacity !== undefined ? applyOpacity(offColor, opacity) : offColor;
    } else if (rect.climate && this._config?.color?.hvac) {
      // HVAC colors only override when ACTIVELY heating/cooling
      const hvacConfig = this._config.color.hvac;
      if (rect.climate.hvacAction === 'heating' && hvacConfig.heating) {
        color =
          opacity !== undefined ? applyOpacity(hvacConfig.heating, opacity) : hvacConfig.heating;
      } else if (rect.climate.hvacAction === 'cooling' && hvacConfig.cooling) {
        color =
          opacity !== undefined ? applyOpacity(hvacConfig.cooling, opacity) : hvacConfig.cooling;
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
    const isTemperatureOffset = this._config?.value?.attribute === 'temp_offset';
    const signPrefix = isTemperatureOffset && rect.value > 0 ? '+' : '';

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
                  hvac: this._config?.sparkline?.hvac,
                  periodHours: this._getPeriodHours(),
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
