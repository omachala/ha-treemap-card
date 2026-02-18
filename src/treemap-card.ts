import { LitElement, html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent, debounce, navigate } from 'custom-card-helpers';
import {
  isEntityConfig,
  type HomeAssistant,
  type TreemapCardConfig,
  type TreemapItem,
  type TreemapRect,
  type TreemapEntityConfig,
  type TreemapActionConfig,
} from './types';

import { getNumber, getString, matchesPattern, isUnavailableState } from './utils/predicates';
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
import { formatNumber, resolvePrecision } from './utils/format';
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

  /**
   * Return the editor element for visual configuration
   */
  public static getConfigElement(): HTMLElement {
    // Ensure editor is registered (fire-and-forget import)
    void import('./editor/treemap-card-editor');
    return document.createElement('treemap-card-editor');
  }

  /**
   * Return stub config for card picker (finds temperature sensors for preview)
   */
  public static getStubConfig(hass: HomeAssistant): Partial<TreemapCardConfig> {
    // Find temperature sensors for a meaningful preview
    const temperatureSensors = Object.keys(hass.states)
      .filter(entityId => {
        if (!entityId.startsWith('sensor.')) return false;
        const entity = hass.states[entityId];
        return entity?.attributes?.['device_class'] === 'temperature';
      })
      .slice(0, 3);

    return {
      type: 'custom:treemap-card',
      entities: temperatureSensors.length > 0 ? temperatureSensors : ['sensor.*'],
    };
  }

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: TreemapCardConfig;
  @state() private _sparklineData = new Map<string, SparklineData>();
  private _fetchingSparklines = false;
  private _lastRelevantStates: string | undefined;
  private _cachedData: TreemapItem[] | undefined;
  private _cachedDataHash: string | undefined;
  private readonly _debouncedFetchSparklines = debounce(() => void this._fetchSparklineData(), 100);
  // Map from entity_id to its config object, for per-entity action overrides
  private _entityConfigMap = new Map<string, TreemapEntityConfig>();
  // Hold action detection
  private _holdTimer: ReturnType<typeof setTimeout> | null = null;
  private _holdFired = false;
  private static readonly _HOLD_THRESHOLD_MS = 500;

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

      for (const input of this._config.entities) {
        const { entity: pattern } = this._normalizeEntity(input);
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

    // Rebuild entity config map for per-entity action lookups
    this._entityConfigMap = new Map();
    if (config.entities) {
      for (const input of config.entities) {
        const cfg = this._normalizeEntity(input);
        // Store configs that have action overrides (may include wildcards; resolved at action time)
        if (cfg.tap_action || cfg.hold_action || cfg.double_tap_action) {
          this._entityConfigMap.set(cfg.entity, cfg);
        }
      }
    }
  }

  /**
   * Normalize EntityInput to object format
   * Converts "sensor.foo" to { entity: "sensor.foo" }
   * Preserves existing { entity, name, icon } objects as-is
   */
  private _normalizeEntity(input: string | TreemapEntityConfig): TreemapEntityConfig {
    if (typeof input === 'string') return { entity: input };
    if (isEntityConfig(input)) return input;
    return { entity: String(input) };
  }

  public getCardSize(): number {
    return 4;
  }

  protected override updated(): void {
    // Debounce sparkline fetching to reduce API calls
    this._debouncedFetchSparklines();
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

  private _resolveEntities(inputs: (string | TreemapEntityConfig)[]): TreemapItem[] {
    if (!this.hass) return [];

    const items: TreemapItem[] = [];
    const allEntityIds = Object.keys(this.hass.states);

    for (const input of inputs) {
      const {
        entity: pattern,
        name: nameOverride,
        icon: iconOverride,
      } = this._normalizeEntity(input);

      const matchingIds = allEntityIds.filter(
        id => matchesPattern(id, pattern) && !this._isExcluded(id)
      );

      for (const entityId of matchingIds) {
        const entity = this.hass.states[entityId];
        if (!entity) continue;

        const labelAttribute = this._config?.label?.attribute || 'friendly_name';
        const defaultLabel =
          labelAttribute === 'entity_id'
            ? entityId
            : String(entity.attributes[labelAttribute] ?? entityId.split('.').pop() ?? entityId);

        // Use name override from EntityConfig if provided
        const label = nameOverride ?? defaultLabel;

        // Use icon override from EntityConfig if provided
        const icon = iconOverride ?? getString(entity.attributes['icon']);

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
            sortValue: brightness,
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
            sortValue: numberDisplayValue,
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
          const attrValue = entity.attributes[valueAttribute];
          value = Number.parseFloat(String(attrValue ?? 0));
        }

        if (Number.isNaN(value)) {
          // Skip non-numeric entities unless filter.unavailable is enabled
          const isUnavailable = isUnavailableState(entity.state);
          if (!isUnavailable || !this._config?.filter?.unavailable) {
            continue;
          }

          // Include unavailable entity with placeholder values
          const unit = getString(entity.attributes['unit_of_measurement']);
          items.push({
            label,
            value: 0, // Placeholder value for sizing
            sizeValue: 1, // Minimal size
            sortValue: 0,
            colorValue: 0,
            entity_id: entityId,
            icon,
            unit,
            unavailable: true,
            rawState: entity.state,
          });
          continue;
        }

        const unit = getString(entity.attributes['unit_of_measurement']);

        items.push({
          label,
          value,
          sizeValue: value,
          sortValue: value,
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

        const itemValue = Number(item[valueAttribute] ?? 0);
        return {
          label: String(item[labelAttribute] ?? item['label'] ?? ''),
          value: itemValue,
          sizeValue: Number(item[sizeAttribute] ?? item[valueAttribute] ?? 0),
          sortValue: itemValue,
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
      // Skip filter.above/below checks for unavailable entities
      // (they have placeholder value 0, which would incorrectly trigger filters)
      if (item.unavailable) {
        return true;
      }
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
      { value: number; sortValue: number; colorValue: number; sizeValue: number; unit?: string }
    >();
    for (const item of sortedData) {
      // Use entity_id as unique key, fall back to label for JSON mode (no entity_id)
      const key = item.entity_id ?? item.label;
      originalValues.set(key, {
        value: item.value,
        sortValue: item.sortValue,
        colorValue: item.colorValue,
        sizeValue: item.sizeValue,
        unit: item.unit,
      });
    }

    // squarify uses 'value' field for sizing
    const layoutInput = sortedData.map(item => ({ ...item, value: item.sizeValue }));
    const orderAsc = this._config?.order === 'asc';
    const sizeInverse = this._config?.size?.inverse === true;
    // When size.inverse is active, sortValue is negated, so the ascending direction is flipped
    // to keep the visual order consistent with the user's intent
    const isAsc = sizeInverse ? !orderAsc : orderAsc;
    const sortBy = this._config?.sort_by ?? 'value';
    const { rects, rows } = squarify(layoutInput, 100, 100, {
      compressRange: true,
      equalSize,
      ascending: isAsc,
      sortBy,
    });

    // Restore original display values by matching on entity_id (or label for JSON mode)
    for (const rect of rects) {
      const key = rect.entity_id ?? rect.label;
      const original = originalValues.get(key);
      if (original) {
        rect.value = original.value;
        rect.sortValue = original.sortValue;
        rect.colorValue = original.colorValue;
        rect.sizeValue = original.sizeValue;
        rect.unit = original.unit;
      }
    }

    // Dynamic height based on actual row count from squarify algorithm
    const numberRows = Math.max(1, rows);
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

  /**
   * Determine color for a treemap rect based on entity type and state.
   * Priority: unavailable > climate off > climate HVAC active > light > gradient
   */
  private _getRectColor(rect: TreemapRect, min: number, max: number): string {
    const opacity = this._config?.color?.opacity;

    // Unavailable entities always get gray color
    if (rect.unavailable) {
      const unavailableColor = this._config?.color?.unavailable ?? '#868e96';
      return opacity === undefined ? unavailableColor : applyOpacity(unavailableColor, opacity);
    }

    // Climate entities that are off or unavailable always get gray color
    if (
      rect.climate &&
      (rect.climate.hvacMode === 'off' || rect.climate.hvacMode === 'unavailable')
    ) {
      const offColor = this._config?.color?.hvac?.off ?? '#868e96';
      return opacity === undefined ? offColor : applyOpacity(offColor, opacity);
    }

    // HVAC colors only override when ACTIVELY heating/cooling
    if (rect.climate && this._config?.color?.hvac) {
      const hvacConfig = this._config.color.hvac;
      if (rect.climate.hvacAction === 'heating' && hvacConfig.heating) {
        return opacity === undefined
          ? hvacConfig.heating
          : applyOpacity(hvacConfig.heating, opacity);
      }
      if (rect.climate.hvacAction === 'cooling' && hvacConfig.cooling) {
        return opacity === undefined
          ? hvacConfig.cooling
          : applyOpacity(hvacConfig.cooling, opacity);
      }
      // idle, off, or no active action - fall through to gradient
    }

    // Light entities use custom light color logic
    if (rect.light) {
      return this._getLightColor(rect);
    }

    // Default: use gradient color
    return this._getColor(rect.colorValue, min, max);
  }

  /**
   * Format label with replace regex and prefix/suffix.
   */
  private _formatLabel(rect: TreemapRect): string {
    let displayLabel = rect.label;

    // Apply label replace regex if configured
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
    return `${labelPrefix}${displayLabel}${labelSuffix}`;
  }

  /**
   * Format value with precision, abbreviation, prefix/suffix, and unit.
   */
  private _formatValue(rect: TreemapRect): string {
    const valuePrefix = this._config?.value?.prefix;
    const valueSuffix = this._config?.value?.suffix;

    // Show raw state for unavailable entities, capitalized like HA does
    if (rect.unavailable && rect.rawState) {
      return rect.rawState.charAt(0).toUpperCase() + rect.rawState.slice(1);
    }

    // Format numeric value
    const entityPrecision = rect.entity_id
      ? this.hass?.entities?.[rect.entity_id]?.display_precision
      : undefined;
    const precision = resolvePrecision(this._config?.value?.precision, entityPrecision);
    const abbreviate = this._config?.value?.abbreviate ?? false;
    const formattedNumber = formatNumber(rect.value, precision, abbreviate);

    // Add + sign for positive temp_offset values
    const isTemperatureOffset = this._config?.value?.attribute === 'temp_offset';
    const signPrefix = isTemperatureOffset && rect.value > 0 ? '+' : '';

    // If prefix or suffix is defined, use only those. Otherwise, auto-append unit from entity.
    const hasCustomFormat = valuePrefix !== undefined || valueSuffix !== undefined;
    const unitSuffix = rect.unit ? ' ' + rect.unit : '';

    return hasCustomFormat
      ? `${valuePrefix ?? ''}${signPrefix}${formattedNumber}${valueSuffix ?? ''}`
      : `${signPrefix}${formattedNumber}${unitSuffix}`;
  }

  /**
   * Calculate styles for icon, label, and value based on color target mode.
   */
  private _calculateStyles(color: string): {
    backgroundColor: string;
    iconStyle: string;
    labelStyle: string;
    valueStyle: string;
  } {
    const colorTarget = this._config?.color?.target ?? 'background';
    const applyToForeground = colorTarget === 'foreground';

    // Background color: calculated color for background mode, dark overlay for foreground mode
    const backgroundColor = applyToForeground ? 'rgba(0, 0, 0, 0.1)' : color;

    // Text/icon colors: calculated color for foreground mode, contrast colors for background mode
    const textColors = applyToForeground
      ? { icon: color, label: color, value: color }
      : getContrastColors(color);

    // Custom styles (user styles override auto contrast)
    const iconStyle = this._config?.icon?.style || `color: ${textColors.icon};`;
    const labelStyle = this._config?.label?.style || `color: ${textColors.label};`;
    const valueStyle = this._config?.value?.style || `color: ${textColors.value};`;

    return { backgroundColor, iconStyle, labelStyle, valueStyle };
  }

  private _renderRect(
    rect: TreemapRect,
    min: number,
    max: number,
    _containerHeight: number,
    gap: number
  ): TemplateResult {
    const color = this._getRectColor(rect, min, max);
    const sizeClass = this._getSizeClass(rect);
    const isHvacActive =
      rect.climate?.hvacAction === 'heating' || rect.climate?.hvacAction === 'cooling';

    const showIcon = this._config?.icon?.show ?? true;
    const showLabel = this._config?.label?.show ?? true;
    const showValue = this._config?.value?.show ?? true;

    const formattedLabel = this._formatLabel(rect);
    const formattedValue = this._formatValue(rect);
    const { backgroundColor, iconStyle, labelStyle, valueStyle } = this._calculateStyles(color);

    const halfGap = gap / 2;

    return html`
      <div
        class="treemap-item ${sizeClass}"
        style="
          left: calc(${rect.x}% + ${halfGap}px);
          top: calc(${rect.y}% + ${halfGap}px);
          width: calc(${rect.width}% - ${gap}px);
          height: calc(${rect.height}% - ${gap}px);
          background-color: ${backgroundColor};
        "
        @pointerdown="${(e: PointerEvent) => this._onPointerDown(e, rect)}"
        @pointerup="${(e: PointerEvent) => this._onPointerUp(e, rect)}"
        @pointercancel="${() => this._clearHoldTimer()}"
        title="${rect.label}: ${rect.value}"
      >
        ${showIcon && (rect.icon || this._config?.icon?.icon)
          ? html`<ha-icon
              class="treemap-icon ${isHvacActive ? 'hvac-active' : ''}"
              style="${iconStyle}"
              icon="${rect.icon || this._config?.icon?.icon}"
            ></ha-icon>`
          : nothing}
        ${showLabel
          ? html`<span class="treemap-label" style="${labelStyle}">${formattedLabel}</span>`
          : nothing}
        ${showValue
          ? html`<span class="treemap-value" style="${valueStyle}">${formattedValue}</span>`
          : nothing}
        ${this._config?.sparkline?.show !== false
          ? (() => {
              const sparklineData =
                rect.sparklineData ??
                (rect.entity_id ? this._sparklineData.get(rect.entity_id) : undefined);
              return html`<div class="treemap-sparkline">
                ${renderSparklineWithData(sparklineData, {
                  mode: this._config?.sparkline?.mode || 'dark',
                  line: this._config?.sparkline?.line,
                  fill: this._config?.sparkline?.fill,
                  hvac: this._config?.sparkline?.hvac,
                  periodHours: this._getPeriodHours(),
                })}
              </div>`;
            })()
          : nothing}
      </div>
    `;
  }

  /**
   * Get the effective action config for a rect, with per-entity override support.
   */
  private _getActionConfig(
    rect: TreemapRect,
    actionKey: 'tap_action' | 'hold_action' | 'double_tap_action'
  ): TreemapActionConfig {
    // Per-entity config takes precedence: check exact match, then wildcard patterns
    if (this._entityConfigMap.size > 0 && rect.entity_id) {
      // First try exact match
      const exactMatch = this._entityConfigMap.get(rect.entity_id);
      if (exactMatch?.[actionKey]) return exactMatch[actionKey];

      // Then try wildcard patterns
      for (const [pattern, cfg] of this._entityConfigMap) {
        if (cfg[actionKey] && matchesPattern(rect.entity_id, pattern)) {
          return cfg[actionKey];
        }
      }
    }

    // Fall back to global card-level config
    const globalAction = this._config?.[actionKey];
    if (globalAction) return globalAction;

    // Defaults: tap → more-info, hold/double_tap → none
    return { action: actionKey === 'tap_action' ? 'more-info' : 'none' };
  }

  private _executeAction(action: TreemapActionConfig, entityId: string | undefined): void {
    switch (action.action) {
      case 'more-info':
        if (entityId) {
          fireEvent(this, 'hass-more-info', { entityId });
        }
        break;
      case 'navigate':
        if ('navigation_path' in action && action.navigation_path) {
          navigate(this, action.navigation_path);
        }
        break;
      case 'url':
        if ('url_path' in action && action.url_path) {
          window.open(action.url_path);
        }
        break;
      case 'toggle':
        if (entityId && this.hass) {
          const domain = entityId.split('.')[0] ?? 'homeassistant';
          void this.hass.callService(domain, 'toggle', { entity_id: entityId });
        }
        break;
      case 'call-service':
        if ('service' in action && action.service && this.hass) {
          const parts = action.service.split('.');
          const domain = parts[0] ?? '';
          const service = parts[1] ?? '';
          void this.hass.callService(domain, service, action.service_data);
        }
        break;
      case 'assist':
        fireEvent(this, 'hass-launch-voice-assistant', {});
        break;
      default:
        break;
    }
  }

  private _onPointerDown(e: PointerEvent, rect: TreemapRect): void {
    // Only main button (touch or left mouse)
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this._holdFired = false;
    this._clearHoldTimer();

    const holdAction = this._getActionConfig(rect, 'hold_action');
    if (holdAction.action === 'none') return;

    this._holdTimer = setTimeout(() => {
      this._holdFired = true;
      this._clearHoldTimer();
      this._executeAction(holdAction, rect.entity_id);
    }, TreemapCard._HOLD_THRESHOLD_MS);
  }

  private _onPointerUp(e: PointerEvent, rect: TreemapRect): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this._clearHoldTimer();
    if (this._holdFired) return; // hold already handled

    const tapAction = this._getActionConfig(rect, 'tap_action');
    if (tapAction.action === 'none') return;
    this._executeAction(tapAction, rect.entity_id);
  }

  private _clearHoldTimer(): void {
    if (this._holdTimer !== null) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
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
