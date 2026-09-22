import type { HomeAssistant, HistoryPeriod, StatisticFunction } from '../types';

export interface SparklineData {
  temperature: number[];
  hvacActions?: HvacActionSegment[];
}

export interface HvacActionSegment {
  start: number; // 0-1 position in timeline
  end: number; // 0-1 position in timeline
  action: 'heating' | 'cooling' | 'idle' | 'off';
}

/**
 * What one tile's sparkline should plot.
 *
 * `entityId` is the *source* entity, which is not necessarily the tile's own
 * entity - see the `sparkline.entity` config option.
 */
export interface SparklineSpec {
  entityId: string;
  period: HistoryPeriod;
  statistic: StatisticFunction;
}

function isHvacAction(value: unknown): value is HvacActionSegment['action'] {
  return value === 'heating' || value === 'cooling' || value === 'idle' || value === 'off';
}

function isClimateEntityId(entityId: string): boolean {
  return entityId.startsWith('climate.');
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

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// "entityId:period:statistic" -> plotted series
const seriesCache = new Map<string, CacheEntry<number[]>>();
// "entityId|period" -> climate temperature + hvac segments
const climateCache = new Map<string, CacheEntry<ClimateHistoryData>>();

/**
 * Clear all cached history data.
 * Exported so tests can isolate the module-level caches between cases.
 */
export function clearHistoryCache(): void {
  seriesCache.clear();
  climateCache.clear();
}

function seriesKey({ entityId, period, statistic }: SparklineSpec): string {
  return `${entityId}:${period}:${statistic}`;
}

function climateKey(entityId: string, period: HistoryPeriod): string {
  return `${entityId}|${period}`;
}

/**
 * Get sparkline data for a set of tiles.
 *
 * Both the spec map and the returned map are keyed by the *tile's* entity id, so
 * the render path never needs to know about source entities. Identical
 * (source, period, statistic) fetches are deduplicated internally.
 */
export async function getHistoryData(
  hass: HomeAssistant,
  specs: Map<string, SparklineSpec>
): Promise<Map<string, SparklineData>> {
  const result = new Map<string, SparklineData>();
  if (specs.size === 0) return result;

  const now = Date.now();

  // Climate history is needed for two reasons: HVAC bars always describe the
  // tile's own thermostat, and a climate *source* may need its temperature read
  // from attributes when it has no long-term statistics.
  const climateRequests = new Map<string, ClimateRequest>();
  for (const [tileId, spec] of specs) {
    if (isClimateEntityId(tileId)) {
      climateRequests.set(climateKey(tileId, spec.period), {
        entityId: tileId,
        period: spec.period,
      });
    }
    if (isClimateEntityId(spec.entityId)) {
      climateRequests.set(climateKey(spec.entityId, spec.period), {
        entityId: spec.entityId,
        period: spec.period,
      });
    }
  }

  const climateData = await fetchClimateHistories(hass, climateRequests, now);
  const series = await fetchSeries(hass, specs, climateData, now);

  for (const [tileId, spec] of specs) {
    const temperature = series.get(seriesKey(spec)) ?? [];
    const hvacActions = isClimateEntityId(tileId)
      ? climateData.get(climateKey(tileId, spec.period))?.hvacActions
      : undefined;

    result.set(tileId, hvacActions ? { temperature, hvacActions } : { temperature });
  }

  return result;
}

/**
 * Resolve the plotted series for every spec, batching one statistics call per
 * distinct (period, statistic) pair and serving fresh cache entries directly.
 */
async function fetchSeries(
  hass: HomeAssistant,
  specs: Map<string, SparklineSpec>,
  climateData: Map<string, ClimateHistoryData>,
  now: number
): Promise<Map<string, number[]>> {
  const resolved = new Map<string, number[]>();

  // Group the stale specs by the websocket call they would produce
  const groups = new Map<string, { spec: SparklineSpec; entityIds: Set<string> }>();

  for (const spec of specs.values()) {
    const key = seriesKey(spec);
    if (resolved.has(key)) continue;

    const cached = seriesCache.get(key);
    if (cached && now - cached.fetchedAt < CACHE_TTL) {
      resolved.set(key, cached.data);
      continue;
    }

    const groupKey = `${spec.period}|${spec.statistic}`;
    const group = groups.get(groupKey);
    if (group) {
      group.entityIds.add(spec.entityId);
    } else {
      groups.set(groupKey, { spec, entityIds: new Set([spec.entityId]) });
    }
  }

  await Promise.all(
    [...groups.values()].map(async ({ spec, entityIds }) => {
      const ids = [...entityIds];
      const stats = await fetchStatistics(hass, ids, spec.period, spec.statistic);

      for (const entityId of ids) {
        let data = stats.get(entityId) ?? [];

        // A climate entity without statistics can still expose its temperature
        // through the current_temperature attribute in plain history.
        if (data.length === 0 && isClimateEntityId(entityId)) {
          data = climateData.get(climateKey(entityId, spec.period))?.temperature ?? [];
        }

        const key = seriesKey({ ...spec, entityId });
        seriesCache.set(key, { data, fetchedAt: now });
        resolved.set(key, data);
      }
    })
  );

  return resolved;
}

/**
 * Fetch climate history (temperature + HVAC actions), one call per period.
 */
async function fetchClimateHistories(
  hass: HomeAssistant,
  requests: Map<string, ClimateRequest>,
  now: number
): Promise<Map<string, ClimateHistoryData>> {
  const result = new Map<string, ClimateHistoryData>();
  if (requests.size === 0) return result;

  const byPeriod = new Map<HistoryPeriod, string[]>();

  for (const [key, { entityId, period }] of requests) {
    const cached = climateCache.get(key);
    if (cached && now - cached.fetchedAt < CACHE_TTL) {
      result.set(key, cached.data);
      continue;
    }

    const existing = byPeriod.get(period);
    if (existing) {
      existing.push(entityId);
    } else {
      byPeriod.set(period, [entityId]);
    }
  }

  await Promise.all(
    [...byPeriod].map(async ([period, entityIds]) => {
      const fetched = await fetchClimateHistory(hass, entityIds, period, now);
      for (const entityId of entityIds) {
        const data = fetched.get(entityId) ?? { temperature: [], hvacActions: [] };
        const key = climateKey(entityId, period);
        climateCache.set(key, { data, fetchedAt: now });
        result.set(key, data);
      }
    })
  );

  return result;
}

interface ClimateRequest {
  entityId: string;
  period: HistoryPeriod;
}

interface ClimateHistoryData {
  temperature: number[];
  hvacActions: HvacActionSegment[];
}

async function fetchClimateHistory(
  hass: HomeAssistant,
  climateEntityIds: string[],
  period: HistoryPeriod,
  now: number
): Promise<Map<string, ClimateHistoryData>> {
  const result = new Map<string, ClimateHistoryData>();
  if (climateEntityIds.length === 0) return result;

  const config = PERIOD_CONFIG[period];
  const periodMs = config.hours * 60 * 60 * 1000;
  const startTime = new Date(now - periodMs);

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
      for (const entityId of climateEntityIds) {
        const history = response[entityId];
        if (history && history.length > 0) {
          result.set(entityId, {
            temperature: extractTemperatures(history),
            hvacActions: convertToHvacSegments(history, startTime.getTime(), now, periodMs),
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
 *
 * The requested statistic is passed through as `types` and read back from that
 * same field. There is deliberately no fallback to `mean`: when `types` is
 * honoured the other fields are absent by construction, so a fallback could only
 * ever plot a different series than the one that was asked for.
 */
async function fetchStatistics(
  hass: HomeAssistant,
  entityIds: string[],
  period: HistoryPeriod,
  statistic: StatisticFunction
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
      types: [statistic],
    });

    if (response) {
      for (const [entityId, stats] of Object.entries(response)) {
        const data = stats
          .map(row => row[statistic])
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
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

type StatisticsResult = {
  start: number;
  end: number;
} & Partial<Record<StatisticFunction | 'last_reset', number | null>>;

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
