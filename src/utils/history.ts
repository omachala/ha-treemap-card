import type { HomeAssistant } from '../types';

export type HistoryPeriod = '12h' | '24h' | '7d' | '30d';

interface CacheEntry {
  data: number[];
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
 * Get historical statistics data for multiple entities.
 * Returns cached data if fresh, otherwise fetches from HA.
 */
export async function getHistoryData(
  hass: HomeAssistant,
  entityIds: string[],
  period: HistoryPeriod = '24h'
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
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
    const freshData = await fetchStatistics(hass, staleIds, period);
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
          .map(s => s.mean)
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
