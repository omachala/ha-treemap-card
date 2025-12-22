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
 */
export function clearHistoryCache(): void {
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

  // Try fallback: look for associated temperature sensors
  if (needFallback.length > 0) {
    const fallbackMap = findTemperatureSensors(hass, needFallback);
    const sensorIds = [...fallbackMap.values()].filter((v): v is string => !!v);

    if (sensorIds.length > 0) {
      const sensorStats = await fetchStatistics(hass, sensorIds, period);

      for (const [climateId, sensorId] of fallbackMap) {
        if (sensorId) {
          const stats = sensorStats.get(sensorId);
          if (stats && stats.length > 0) {
            result.set(climateId, { temperature: stats });
          }
        }
      }
    }
  }

  // Fetch HVAC action history for all climate entities
  const hvacHistory = await fetchHvacActionHistory(hass, climateEntityIds, startTime, period);
  for (const [entityId, segments] of hvacHistory) {
    const existing = result.get(entityId);
    if (existing) {
      existing.hvacActions = segments;
    } else {
      result.set(entityId, { temperature: [], hvacActions: segments });
    }
  }

  return result;
}

/**
 * Find associated temperature sensors for climate entities.
 * Tries common naming patterns.
 */
function findTemperatureSensors(
  hass: HomeAssistant,
  climateEntityIds: string[]
): Map<string, string | null> {
  const result = new Map<string, string | null>();

  for (const climateId of climateEntityIds) {
    // Extract base name: climate.wiser_living_room -> wiser_living_room
    const baseName = climateId.replace('climate.', '');

    // Try common patterns
    const patterns = [
      `sensor.${baseName}_temperature`,
      `sensor.${baseName}_current_temperature`,
      `sensor.${baseName}temperature`,
    ];

    let found: string | null = null;
    for (const pattern of patterns) {
      if (hass.states[pattern]) {
        found = pattern;
        break;
      }
    }

    result.set(climateId, found);
  }

  return result;
}

/**
 * Fetch HVAC action history for climate entities.
 */
async function fetchHvacActionHistory(
  hass: HomeAssistant,
  climateEntityIds: string[],
  startTime: Date,
  period: HistoryPeriod
): Promise<Map<string, HvacActionSegment[]>> {
  const result = new Map<string, HvacActionSegment[]>();

  if (climateEntityIds.length === 0) {
    return result;
  }

  try {
    // Use HA history API
    const response = await hass.callWS<Record<string, HistoryState[]>>({
      type: 'history/history_during_period',
      start_time: startTime.toISOString(),
      entity_ids: climateEntityIds,
      minimal_response: true,
      significant_changes_only: true,
    });

    if (response) {
      const config = PERIOD_CONFIG[period];
      const periodMs = config.hours * 60 * 60 * 1000;
      const now = Date.now();

      for (const entityId of climateEntityIds) {
        const history = response[entityId];
        if (history && history.length > 0) {
          const segments = convertToHvacSegments(history, startTime.getTime(), now, periodMs);
          result.set(entityId, segments);
        }
      }
    }
  } catch (error) {
    console.warn('[treemap] Failed to fetch HVAC history:', error);
  }

  return result;
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

    // Get hvac_action from attributes
    const rawAction = state.a?.['hvac_action'];
    if (!isHvacAction(rawAction) || rawAction === 'idle' || rawAction === 'off') continue;
    const action = rawAction;

    const stateTime = new Date(state.lu * 1000).getTime();
    const nextTime = nextState ? new Date(nextState.lu * 1000).getTime() : endMs;

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
  lu: number; // last_updated timestamp (seconds)
  s: string; // state
  a?: Record<string, unknown>; // attributes
}
