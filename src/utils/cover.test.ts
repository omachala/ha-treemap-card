import { describe, expect, it } from 'vitest';
import { extractCoverInfo, isCoverEntity } from './cover';
import type { HassEntity } from '../types';

function entity(state: string, currentPosition?: number): HassEntity {
  return {
    entity_id: 'cover.test',
    state,
    attributes: currentPosition === undefined ? {} : { current_position: currentPosition },
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
  };
}

describe('cover utilities', () => {
  it('recognizes cover entities only', () => {
    expect(isCoverEntity('cover.bedroom')).toBe(true);
    expect(isCoverEntity('binary_sensor.bedroom')).toBe(false);
  });

  it('inverts the Home Assistant position so open is 0% and closed is 100%', () => {
    expect(extractCoverInfo(entity('open', 100))).toEqual({ position: 0, isOpen: true });
    expect(extractCoverInfo(entity('closed', 0))).toEqual({ position: 100, isOpen: false });
    expect(extractCoverInfo(entity('open', 25))).toEqual({ position: 75, isOpen: true });
  });

  it('uses the state when current_position is unavailable', () => {
    expect(extractCoverInfo(entity('open'))).toEqual({ position: 0, isOpen: true });
    expect(extractCoverInfo(entity('closed'))).toEqual({ position: 100, isOpen: false });
  });

  it('limits malformed positions to the valid range', () => {
    expect(extractCoverInfo(entity('open', 120)).position).toBe(0);
    expect(extractCoverInfo(entity('closed', -10)).position).toBe(100);
  });
});
