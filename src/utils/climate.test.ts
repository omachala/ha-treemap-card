import { describe, it, expect } from 'vitest';
import { isClimateEntity, extractClimateInfo, getClimateValue } from './climate';
import type { HassEntity, ClimateInfo } from '../types';

const createEntity = (state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id: 'climate.test',
  state,
  last_changed: new Date().toISOString(),
  last_updated: new Date().toISOString(),
  attributes,
});

describe('isClimateEntity', () => {
  it('returns true for climate entities', () => {
    expect(isClimateEntity('climate.living_room')).toBe(true);
    expect(isClimateEntity('climate.thermostat')).toBe(true);
  });

  it('returns false for non-climate entities', () => {
    expect(isClimateEntity('sensor.temperature')).toBe(false);
    expect(isClimateEntity('light.bedroom')).toBe(false);
    expect(isClimateEntity('switch.heater')).toBe(false);
  });
});

describe('extractClimateInfo', () => {
  it('extracts basic climate info', () => {
    const entity = createEntity('heat', {
      current_temperature: 20,
      temperature: 22,
      hvac_action: 'heating',
    });

    const info = extractClimateInfo(entity);
    expect(info.currentTemperature).toBe(20);
    expect(info.targetTemperature).toBe(22);
    expect(info.hvacAction).toBe('heating');
    expect(info.hvacMode).toBe('heat');
  });

  it('computes negative temp_offset in heat mode when below target', () => {
    const entity = createEntity('heat', {
      current_temperature: 18,
      temperature: 21,
    });

    const info = extractClimateInfo(entity);
    expect(info.tempOffset).toBe(-3);
    expect(info.tempDifference).toBe(3);
  });

  it('computes zero temp_offset in heat mode when above target', () => {
    const entity = createEntity('heat', {
      current_temperature: 23,
      temperature: 21,
    });

    const info = extractClimateInfo(entity);
    expect(info.tempOffset).toBe(0);
    expect(info.tempDifference).toBe(0);
  });

  it('computes positive temp_offset in cool mode when above target', () => {
    const entity = createEntity('cool', {
      current_temperature: 25,
      temperature: 21,
    });

    const info = extractClimateInfo(entity);
    expect(info.tempOffset).toBe(4);
    expect(info.tempDifference).toBe(4);
  });

  it('computes zero temp_offset in cool mode when below target', () => {
    const entity = createEntity('cool', {
      current_temperature: 19,
      temperature: 21,
    });

    const info = extractClimateInfo(entity);
    expect(info.tempOffset).toBe(0);
    expect(info.tempDifference).toBe(0);
  });

  it('computes raw offset in heat_cool mode', () => {
    const entity = createEntity('heat_cool', {
      current_temperature: 25,
      temperature: 21,
    });

    const info = extractClimateInfo(entity);
    expect(info.tempOffset).toBe(4);
    expect(info.tempDifference).toBe(4);
  });

  it('computes raw offset in auto mode', () => {
    const entity = createEntity('auto', {
      current_temperature: 18,
      temperature: 21,
    });

    const info = extractClimateInfo(entity);
    expect(info.tempOffset).toBe(-3);
    expect(info.tempDifference).toBe(3);
  });

  it('computes raw offset in off mode', () => {
    const entity = createEntity('off', {
      current_temperature: 25,
      temperature: 21,
    });

    const info = extractClimateInfo(entity);
    expect(info.tempOffset).toBe(4);
    expect(info.tempDifference).toBe(4);
  });

  it('handles missing temperatures', () => {
    const entity = createEntity('heat', {});

    const info = extractClimateInfo(entity);
    expect(info.currentTemperature).toBeNull();
    expect(info.targetTemperature).toBeNull();
    expect(info.tempOffset).toBe(0);
    expect(info.tempDifference).toBe(0);
  });

  it('handles missing hvac_action', () => {
    const entity = createEntity('heat', {
      current_temperature: 20,
      temperature: 22,
    });

    const info = extractClimateInfo(entity);
    expect(info.hvacAction).toBeNull();
  });
});

describe('getClimateValue', () => {
  const climate: ClimateInfo = {
    currentTemperature: 20,
    targetTemperature: 22,
    tempDifference: 2,
    tempOffset: -2,
    hvacAction: 'heating',
    hvacMode: 'heat',
  };

  it('returns temp_difference', () => {
    expect(getClimateValue(climate, 'temp_difference')).toBe(2);
  });

  it('returns temp_offset', () => {
    expect(getClimateValue(climate, 'temp_offset')).toBe(-2);
  });

  it('returns current_temperature', () => {
    expect(getClimateValue(climate, 'current_temperature')).toBe(20);
  });

  it('returns temperature (target)', () => {
    expect(getClimateValue(climate, 'temperature')).toBe(22);
  });

  it('returns hvac_action', () => {
    expect(getClimateValue(climate, 'hvac_action')).toBe('heating');
  });

  it('returns hvac_mode', () => {
    expect(getClimateValue(climate, 'hvac_mode')).toBe('heat');
  });

  it('returns null for unknown attribute', () => {
    expect(getClimateValue(climate, 'unknown_attr')).toBeNull();
  });
});
