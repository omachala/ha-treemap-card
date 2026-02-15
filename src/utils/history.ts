import type { HomeAssistant } from '../types';

export type HistoryPeriod = '12h' | '24h' | '7d' | '30d';

export interface SparklineData {
  temperature: number[];
  hvacActions?: HvacActionSegment[];
}

export interface HvacActionSegment {
  start: number; // 0-1 position in timeline
  end: number; // 0-1 position in timeline
  action: 'heating' | 'cooling' | 'idle' | 'off';
}

function isHvacAction(value: unknown): value is HvacActionSegment['action'] {
  return value === 'heating' || value === 'cooling' || value === 'idle' || value === 'off';
}

interface CacheEntry {
  data: SparklineData;
  fetchedAt: number;
}

interface PeriodConfig {
  hours: number;
  statsPeriod: '5minute' | 'hour' | 'day';
}

const PERIOD_CONFIG: Record<HistoryPeriod, PeriodConfig> = {
  '12h': { hours: 12, statsPeriod: '5minute' },
  '24h': { hours: 24, statsPeriod: 'hour' },
  '7d': { hours: 7 * 24, statsPeriod: 'hour' },
  '30d': { hours: 30 * 24, statsPeriod: 'day' },
};

// Module-level cache: "entityId:period" -> { data, fetchedAt }
const cache = new Map<string, CacheEntry>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get historical sparkline data for multiple entities.
 * For climate entities, also fetches HVAC action history.
 */
export async function getHistoryData(
  hass: HomeAssistant,
  entityIds: string[],
  period: HistoryPeriod = '24h'
): Promise<Map<string, SparklineData>> {
  const result = new Map<string, SparklineData>();
  const now = Date.now();
  const staleIds: string[] = [];

  // Check cache first (cache key includes period)
  for (const entityId of entityIds) {
    const cacheKey = `${entityId}:${period}`;
    const cached = cache.get(cacheKey);
    if (cached && now - cached.fetchedAt < CACHE_TTL) {
      result.set(entityId, cached.data);
    } else {
      staleIds.push(entityId);
    }
  }

  // Fetch stale/missing data
  if (staleIds.length > 0) {
    const freshData = await fetchSparklineData(hass, staleIds, period);
    for (const [entityId, data] of freshData) {
      const cacheKey = `${entityId}:${period}`;
      cache.set(cacheKey, { data, fetchedAt: now });
      result.set(entityId, data);
    }
  }

  return result;
}

/**
 * Clear all cached history data.
 * Currently unused but kept for future debugging/testing needs.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function clearHistoryCache(): void {
  cache.clear();
}

/**
 * Fetch sparkline data (temperature + HVAC actions) for entities.
 */
async function fetchSparklineData(
  hass: HomeAssistant,
  entityIds: string[],
  period: HistoryPeriod
): Promise<Map<string, SparklineData>> {
  const result = new Map<string, SparklineData>();

  if (entityIds.length === 0) {
    return result;
  }

  // Separate climate entities from others
  const climateEntities = entityIds.filter(id => id.startsWith('climate.'));
  const otherEntities = entityIds.filter(id => !id.startsWith('climate.'));

  // Fetch statistics for non-climate entities
  if (otherEntities.length > 0) {
    const stats = await fetchStatistics(hass, otherEntities, period);
    for (const [entityId, data] of stats) {
      result.set(entityId, { temperature: data });
    }
  }

  // For climate entities, fetch temperature stats AND hvac action history
  if (climateEntities.length > 0) {
    const climateData = await fetchClimateSparklineData(hass, climateEntities, period);
    for (const [entityId, data] of climateData) {
      result.set(entityId, data);
    }
  }

  return result;
}

/**
 * Fetch sparkline data for climate entities.
 * Tries climate entity stats first, falls back to associated temperature sensor.
 */
async function fetchClimateSparklineData(
  hass: HomeAssistant,
  climateEntityIds: string[],
  period: HistoryPeriod
): Promise<Map<string, SparklineData>> {
  const result = new Map<string, SparklineData>();
  const config = PERIOD_CONFIG[period];
  const startTime = new Date(Date.now() - config.hours * 60 * 60 * 1000);

  // First try to get statistics directly for climate entities
  const directStats = await fetchStatistics(hass, climateEntityIds, period);

  // Find entities that need fallback (no data or empty array)
  const needFallback: string[] = [];
  for (const entityId of climateEntityIds) {
    const stats = directStats.get(entityId);
    if (!stats || stats.length === 0) {
      needFallback.push(entityId);
    } else {
      result.set(entityId, { temperature: stats });
    }
  }

  // Fetch climate history (for HVAC action AND temperature from attributes)
  const climateHistory = await fetchClimateHistory(hass, climateEntityIds, startTime, config);

  // Use temperature from climate history for entities without stats
  for (const entityId of needFallback) {
    const historyData = climateHistory.get(entityId);
    if (historyData && historyData.temperature.length > 0) {
      result.set(entityId, { temperature: historyData.temperature });
    }
  }

  // Add HVAC action segments to all climate entities
  for (const [entityId, historyData] of climateHistory) {
    const existing = result.get(entityId);
    if (existing) {
      existing.hvacActions = historyData.hvacActions;
    } else {
      result.set(entityId, { temperature: [], hvacActions: historyData.hvacActions });
    }
  }

  return result;
}

interface ClimateHistoryData {
  temperature: number[];
  hvacActions: HvacActionSegment[];
}

/**
 * Fetch climate history (temperature + HVAC actions) from history API.
 */
async function fetchClimateHistory(
  hass: HomeAssistant,
  climateEntityIds: string[],
  startTime: Date,
  config: PeriodConfig
): Promise<Map<string, ClimateHistoryData>> {
  const result = new Map<string, ClimateHistoryData>();

  if (climateEntityIds.length === 0) {
    return result;
  }

  try {
    // Use HA history API - need full response to get attributes
    const response = await hass.callWS<Record<string, HistoryState[]>>({
      type: 'history/history_during_period',
      start_time: startTime.toISOString(),
      entity_ids: climateEntityIds,
      no_attributes: false,
      significant_changes_only: false, // Get all changes for better temperature resolution
    });

    if (response) {
      const periodMs = config.hours * 60 * 60 * 1000;
      const now = Date.now();

      for (const entityId of climateEntityIds) {
        const history = response[entityId];
        if (history && history.length > 0) {
          // Extract temperature values and HVAC segments
          const temperatures = extractTemperatures(history);
          const hvacSegments = convertToHvacSegments(history, startTime.getTime(), now, periodMs);

          result.set(entityId, {
            temperature: temperatures,
            hvacActions: hvacSegments,
          });
        }
      }
    }
  } catch (error) {
    console.warn('[treemap] Failed to fetch climate history:', error);
  }

  return result;
}

/**
 * Extract temperature values from history, sampled to reasonable resolution.
 */
function extractTemperatures(history: HistoryState[]): number[] {
  const temperatures: number[] = [];

  // Target ~50-100 points for a good sparkline
  const targetPoints = 60;
  const step = Math.max(1, Math.floor(history.length / targetPoints));

  for (let i = 0; i < history.length; i += step) {
    const state = history[i];
    if (!state) continue;

    const attrs = state.attributes || state.a;
    const temp = attrs?.['current_temperature'];
    if (typeof temp === 'number' && !Number.isNaN(temp)) {
      temperatures.push(temp);
    }
  }

  return temperatures;
}

/**
 * Convert history states to HVAC action segments.
 */
function convertToHvacSegments(
  history: HistoryState[],
  startMs: number,
  endMs: number,
  periodMs: number
): HvacActionSegment[] {
  const segments: HvacActionSegment[] = [];

  for (let index = 0; index < history.length; index++) {
    const state = history[index];
    if (!state) continue;

    const nextState = history[index + 1];

    // Get hvac_action from attributes (handle both full and minimal response formats)
    const attrs = state.attributes || state.a;
    const rawAction = attrs?.['hvac_action'];
    if (!isHvacAction(rawAction) || rawAction === 'idle' || rawAction === 'off') continue;
    const action = rawAction;

    // Get timestamp (handle both full and minimal response formats)
    const stateTime = state.last_updated
      ? new Date(state.last_updated).getTime()
      : new Date((state.lu ?? 0) * 1000).getTime();

    let nextTime: number;
    if (nextState) {
      nextTime = nextState.last_updated
        ? new Date(nextState.last_updated).getTime()
        : new Date((nextState.lu ?? 0) * 1000).getTime();
    } else {
      nextTime = endMs;
    }

    // Convert to 0-1 position
    const start = Math.max(0, (stateTime - startMs) / periodMs);
    const end = Math.min(1, (nextTime - startMs) / periodMs);

    if (start < 1 && end > 0) {
      segments.push({ start, end, action });
    }
  }

  return segments;
}

/**
 * Fetch statistics from Home Assistant using WebSocket API.
 */
async function fetchStatistics(
  hass: HomeAssistant,
  entityIds: string[],
  period: HistoryPeriod
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();

  if (entityIds.length === 0) {
    return result;
  }

  const config = PERIOD_CONFIG[period];
  const startTime = new Date(Date.now() - config.hours * 60 * 60 * 1000).toISOString();

  try {
    const response = await hass.callWS<Record<string, StatisticsResult[]>>({
      type: 'recorder/statistics_during_period',
      start_time: startTime,
      statistic_ids: entityIds,
      period: config.statsPeriod,
    });

    if (response) {
      for (const [entityId, stats] of Object.entries(response)) {
        // Extract mean values from statistics
        const data = stats
          .map(({ mean }) => mean)
          .filter((v): v is number => v !== null && v !== undefined);
        result.set(entityId, data);
      }
    }
  } catch (error) {
    console.warn('[treemap] Failed to fetch statistics:', error);
    // Return empty data for failed entities
    for (const entityId of entityIds) {
      if (!result.has(entityId)) {
        result.set(entityId, []);
      }
    }
  }

  return result;
}

interface StatisticsResult {
  start: number;
  end: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  state: number | null;
}

interface HistoryState {
  // Full response format (no_attributes: false)
  last_changed?: string; // ISO timestamp
  last_updated?: string; // ISO timestamp
  state?: string;
  attributes?: Record<string, unknown>;
  // Minimal response format (minimal_response: true)
  lu?: number; // last_updated timestamp (seconds)
  s?: string; // state
  a?: Record<string, unknown>; // attributes
}
