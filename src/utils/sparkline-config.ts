import type { SparklineConfig, StatisticFunction } from '../types';

/**
 * Every statistic a sparkline can plot.
 *
 * Mirrors the values Home Assistant accepts for the `types` parameter of
 * `recorder/statistics_during_period`, minus `last_reset` (a timestamp rather
 * than a plottable series).
 */
export const SPARKLINE_FUNCTIONS = ['mean', 'min', 'max', 'sum', 'state', 'change'] as const;

export function isStatisticFunction(value: unknown): value is StatisticFunction {
  return typeof value === 'string' && SPARKLINE_FUNCTIONS.some(fn => fn === value);
}

/**
 * Sparkline config with every defaulted key guaranteed present.
 *
 * `entity` stays optional: undefined means "plot the tile's own entity", which
 * is only knowable per tile. Use resolveSparklineSource() to collapse it.
 */
export interface ResolvedSparklineConfig extends SparklineConfig {
  show: boolean;
  period: NonNullable<SparklineConfig['period']>;
  function: StatisticFunction;
  mode: NonNullable<SparklineConfig['mode']>;
}

/**
 * Merge one nested block, entity over card, keeping card keys the entity omits.
 * Returns undefined when neither side sets the block, so callers can keep
 * passing undefined straight through to the renderer.
 */
function mergeBlock<T extends object>(card: T | undefined, entity: T | undefined): T | undefined {
  if (!card) return entity;
  if (!entity) return card;
  return { ...card, ...entity };
}

/**
 * Drop keys whose value is undefined, so spreading an override cannot blank out
 * a card-level value that the entity merely did not mention.
 */
function defined(source: SparklineConfig | undefined): SparklineConfig {
  const result: SparklineConfig = {};
  if (!source) return result;

  for (const key of Object.keys(source)) {
    const value: unknown = Reflect.get(source, key);
    if (value !== undefined) Object.assign(result, { [key]: value });
  }

  return result;
}

/**
 * Resolve the effective sparkline config for one tile.
 *
 * Card level supplies defaults, the entity-level block overrides key by key, and
 * the nested line/fill/hvac blocks merge one level deep so a partial override
 * does not discard the card's settings.
 */
export function resolveSparklineConfig(
  card?: SparklineConfig,
  entity?: SparklineConfig
): ResolvedSparklineConfig {
  const merged: SparklineConfig = { ...defined(card), ...defined(entity) };

  const line = mergeBlock(card?.line, entity?.line);
  const fill = mergeBlock(card?.fill, entity?.fill);
  const hvac = mergeBlock(card?.hvac, entity?.hvac);

  return {
    ...merged,
    show: merged.show !== false,
    period: merged.period ?? '24h',
    function: merged.function ?? 'mean',
    mode: merged.mode ?? 'dark',
    ...(line ? { line } : {}),
    ...(fill ? { fill } : {}),
    ...(hvac ? { hvac } : {}),
  };
}

/**
 * The entity whose history a tile's sparkline plots: the configured source if
 * one is set, otherwise the tile's own entity.
 */
export function resolveSparklineSource(
  config: Pick<SparklineConfig, 'entity'>,
  tileEntityId: string
): string {
  return config.entity ?? tileEntityId;
}
