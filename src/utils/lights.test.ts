import { describe, it, expect } from 'vitest';
import { isLightEntity, extractLightInfo } from './lights';
import type { HassEntity } from '../types';

const createEntity = (state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id: 'light.test',
  state,
  last_changed: new Date().toISOString(),
  last_updated: new Date().toISOString(),
  attributes,
});

describe('isLightEntity', () => {
  it('returns true for light entities', () => {
    expect(isLightEntity('light.living_room')).toBe(true);
    expect(isLightEntity('light.kitchen_lamp')).toBe(true);
  });

  it('returns false for non-light entities', () => {
    expect(isLightEntity('sensor.temperature')).toBe(false);
    expect(isLightEntity('switch.outlet')).toBe(false);
    expect(isLightEntity('climate.thermostat')).toBe(false);
  });
});

describe('extractLightInfo', () => {
  it('extracts info for light that is off', () => {
    const entity = createEntity('off', {
      friendly_name: 'Test Light',
      supported_color_modes: ['rgb'],
    });

    const info = extractLightInfo(entity);
    expect(info.isOn).toBe(false);
    expect(info.brightness).toBe(0);
    expect(info.supportsColor).toBe(true);
    expect(info.rgb).toBeUndefined();
  });

  it('extracts info for light that is on with brightness', () => {
    const entity = createEntity('on', {
      friendly_name: 'Test Light',
      brightness: 128,
      supported_color_modes: ['brightness'],
    });

    const info = extractLightInfo(entity);
    expect(info.isOn).toBe(true);
    expect(info.brightness).toBe(50);
    expect(info.supportsColor).toBe(false);
  });

  it('extracts RGB color when available', () => {
    const entity = createEntity('on', {
      friendly_name: 'Test Light',
      brightness: 255,
      rgb_color: [255, 0, 0],
      supported_color_modes: ['rgb'],
    });

    const info = extractLightInfo(entity);
    expect(info.isOn).toBe(true);
    expect(info.brightness).toBe(100);
    expect(info.supportsColor).toBe(true);
    expect(info.rgb).toEqual([255, 0, 0]);
  });

  it('extracts HS color when RGB not available', () => {
    const entity = createEntity('on', {
      friendly_name: 'Test Light',
      brightness: 255,
      hs_color: [180, 50],
      supported_color_modes: ['hs'],
    });

    const info = extractLightInfo(entity);
    expect(info.isOn).toBe(true);
    expect(info.supportsColor).toBe(true);
    expect(info.hs).toEqual([180, 50]);
    expect(info.rgb).toBeUndefined();
  });

  it('prefers RGB over HS when both available', () => {
    const entity = createEntity('on', {
      friendly_name: 'Test Light',
      brightness: 255,
      rgb_color: [0, 255, 0],
      hs_color: [120, 100],
      supported_color_modes: ['rgb', 'hs'],
    });

    const info = extractLightInfo(entity);
    expect(info.rgb).toEqual([0, 255, 0]);
    expect(info.hs).toBeUndefined();
  });

  it('does not extract color when light is off', () => {
    const entity = createEntity('off', {
      friendly_name: 'Test Light',
      rgb_color: [255, 0, 0],
      supported_color_modes: ['rgb'],
    });

    const info = extractLightInfo(entity);
    expect(info.rgb).toBeUndefined();
  });

  it('handles light with no brightness attribute', () => {
    const entity = createEntity('on', {
      friendly_name: 'Test Light',
      supported_color_modes: ['onoff'],
    });

    const info = extractLightInfo(entity);
    expect(info.isOn).toBe(true);
    expect(info.brightness).toBe(100);
  });

  it('identifies color support for various modes', () => {
    const colorModes = ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'];
    const nonColorModes = ['onoff', 'brightness', 'color_temp'];

    for (const mode of colorModes) {
      const entity = createEntity('on', { supported_color_modes: [mode] });
      expect(extractLightInfo(entity).supportsColor).toBe(true);
    }

    for (const mode of nonColorModes) {
      const entity = createEntity('on', { supported_color_modes: [mode] });
      expect(extractLightInfo(entity).supportsColor).toBe(false);
    }
  });
});
