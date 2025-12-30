/**
 * Tests for treemap-card-editor
 *
 * Entities mode only - JSON mode is YAML-only
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { TreemapCardEditor } from './treemap-card-editor';
import type { TreemapCardConfig } from '../types';

/**
 * Interface for ha-textfield custom element
 */
interface HaTextfield extends HTMLElement {
  value: string;
}

/**
 * Interface for ha-select custom element
 */
interface HaSelect extends HTMLElement {
  value: string;
}

/**
 * Type guard for HaTextfield
 */
function isHaTextfield(el: Element | undefined | null): el is HaTextfield {
  return el !== null && el !== undefined && 'value' in el;
}

/**
 * Type guard for HaSelect
 */
function isHaSelect(el: Element | undefined | null): el is HaSelect {
  return el !== null && el !== undefined && 'value' in el;
}

/**
 * Mock ha-textfield component for tests
 */
class MockHaTextfield extends HTMLElement {
  private _value = '';

  get value(): string {
    return this._value;
  }

  set value(val: string) {
    this._value = val;
  }
}

/**
 * Mock ha-select component for tests
 */
class MockHaSelect extends HTMLElement {
  private _value = '';

  get value(): string {
    return this._value;
  }

  set value(val: string) {
    this._value = val;
  }
}

/**
 * Mock ha-expansion-panel component for tests
 */
class MockHaExpansionPanel extends HTMLElement {
  connectedCallback(): void {
    // Make slot content visible
    this.style.display = 'block';
  }
}

/**
 * Mock ha-icon component for tests
 */
class MockHaIcon extends HTMLElement {}

/**
 * Mock ha-icon-picker component for tests
 */
class MockHaIconPicker extends HTMLElement {}

// Register mock HA components before importing the editor
if (!customElements.get('ha-textfield')) {
  customElements.define('ha-textfield', MockHaTextfield);
}
if (!customElements.get('ha-select')) {
  customElements.define('ha-select', MockHaSelect);
}
if (!customElements.get('ha-expansion-panel')) {
  customElements.define('ha-expansion-panel', MockHaExpansionPanel);
}
if (!customElements.get('ha-icon')) {
  customElements.define('ha-icon', MockHaIcon);
}
if (!customElements.get('ha-icon-picker')) {
  customElements.define('ha-icon-picker', MockHaIconPicker);
}

// Import editor after mocks are registered
import './treemap-card-editor';

/**
 * Type guard for TreemapCardEditor
 */
function isTreemapCardEditor(el: Element): el is TreemapCardEditor {
  return 'setConfig' in el;
}

/**
 * Type guard for config-changed custom event
 */
function isConfigChangedEvent(e: Event): e is CustomEvent<{ config: TreemapCardConfig }> {
  if (!(e instanceof CustomEvent)) return false;
  const detail: unknown = e.detail;
  return (
    detail !== null &&
    typeof detail === 'object' &&
    Object.prototype.hasOwnProperty.call(detail, 'config')
  );
}

/**
 * Helper to get editor element with proper typing
 */
function createEditor(): TreemapCardEditor {
  const el = document.createElement('treemap-card-editor');
  if (!isTreemapCardEditor(el)) {
    throw new Error('Element is not a TreemapCardEditor');
  }
  return el;
}

/**
 * Helper to wait for config-changed event
 */
async function waitForConfigChange(editor: TreemapCardEditor): Promise<TreemapCardConfig> {
  return new Promise(resolve => {
    editor.addEventListener(
      'config-changed',
      (e: Event) => {
        if (isConfigChangedEvent(e)) {
          resolve(e.detail.config);
        }
      },
      { once: true }
    );
  });
}

/**
 * Helper to get element from shadow root
 */
function getElement(editor: TreemapCardEditor, selector: string): Element | null {
  return editor.shadowRoot?.querySelector(selector) ?? null;
}

/**
 * Helper to check if section's show checkbox is checked (native checkbox in header)
 */
function isSectionEnabled(editor: TreemapCardEditor, sectionId: string): boolean {
  const checkbox = getElement(
    editor,
    `[data-testid="${sectionId}-section"] input[type="checkbox"]`
  );
  return checkbox instanceof HTMLInputElement ? checkbox.checked : false;
}

describe('TreemapCardEditor', () => {
  let editor: TreemapCardEditor;

  beforeEach(() => {
    editor = createEditor();
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  describe('initialization', () => {
    it('renders without config', async () => {
      await editor.updateComplete;
      const content = editor.shadowRoot?.textContent ?? '';
      expect(content).toContain('No configuration');
    });

    it('renders with entities config', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const entitiesField = getElement(editor, '[data-testid="entities-field"]');
      expect(entitiesField).toBeTruthy();
    });

    it('shows YAML message for JSON config', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entity: 'sensor.data',
        data_attribute: 'items',
      });
      await editor.updateComplete;

      const content = editor.shadowRoot?.textContent ?? '';
      expect(content).toContain('YAML only');
    });
  });

  describe('entities input', () => {
    it('displays entity patterns', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.temp_*', 'light.*'],
      });
      await editor.updateComplete;

      const textarea = getElement(editor, '[data-testid="entities-field"] textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        expect(textarea.value).toBe('sensor.temp_*\nlight.*');
      }
    });

    it('updates entities on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const textarea = getElement(editor, '[data-testid="entities-field"] textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = 'sensor.temp_*\nlight.*';
        textarea.dispatchEvent(new Event('input'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.entities).toEqual(['sensor.temp_*', 'light.*']);
    });

    it('trims whitespace from patterns', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const textarea = getElement(editor, '[data-testid="entities-field"] textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = '  sensor.temp_*  \n  light.*  ';
        textarea.dispatchEvent(new Event('input'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.entities).toEqual(['sensor.temp_*', 'light.*']);
    });

    it('filters empty lines', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const textarea = getElement(editor, '[data-testid="entities-field"] textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = 'sensor.temp_*\n\n\nlight.*\n';
        textarea.dispatchEvent(new Event('input'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.entities).toEqual(['sensor.temp_*', 'light.*']);
    });
  });

  describe('exclude input', () => {
    it('displays exclude patterns', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
        exclude: ['sensor.*_battery'],
      });
      await editor.updateComplete;

      const textarea = getElement(editor, '[data-testid="exclude-field"] textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        expect(textarea.value).toBe('sensor.*_battery');
      }
    });

    it('updates exclude patterns on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const textarea = getElement(editor, '[data-testid="exclude-field"] textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = 'sensor.*_battery\nsensor.*_unavailable';
        textarea.dispatchEvent(new Event('input'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.exclude).toEqual(['sensor.*_battery', 'sensor.*_unavailable']);
    });

    it('clears exclude when empty', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
        exclude: ['sensor.*_battery'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const textarea = getElement(editor, '[data-testid="exclude-field"] textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = '';
        textarea.dispatchEvent(new Event('input'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.exclude).toBeUndefined();
    });
  });

  describe('label section', () => {
    it('checkbox is checked when show=true (default)', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      expect(isSectionEnabled(editor, 'label')).toBe(true);
    });

    it('checkbox is unchecked when show=false', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
        label: { show: false },
      });
      await editor.updateComplete;

      expect(isSectionEnabled(editor, 'label')).toBe(false);
    });

    it('checkbox reflects show state', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const checkbox = getElement(editor, '[data-testid="label-section"] input[type="checkbox"]');
      expect(checkbox instanceof HTMLInputElement && checkbox.checked).toBe(true);
    });

    it('unchecking checkbox sets show=false', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const checkbox = getElement(editor, '[data-testid="label-section"] input[type="checkbox"]');
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.label?.show).toBe(false);
    });

    it('updates label.prefix on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      // ha-textfield components - set value property and dispatch input
      const inputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="label-section"] ha-textfield'
      );
      const prefixInput = inputs?.[0];
      if (isHaTextfield(prefixInput)) {
        prefixInput.value = 'Room: ';
        prefixInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.label?.prefix).toBe('Room: ');
    });
  });

  describe('value section', () => {
    it('checkbox is checked when show=true (default)', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      expect(isSectionEnabled(editor, 'value')).toBe(true);
    });

    it('checkbox reflects show state', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const checkbox = getElement(editor, '[data-testid="value-section"] input[type="checkbox"]');
      expect(checkbox instanceof HTMLInputElement && checkbox.checked).toBe(true);
    });

    it('updates value.suffix on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const inputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="value-section"] ha-textfield'
      );
      const suffixInput = inputs?.[1];
      if (isHaTextfield(suffixInput)) {
        suffixInput.value = ' %';
        suffixInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.value?.suffix).toBe(' %');
    });
  });

  describe('icon section', () => {
    it('checkbox is checked when show=true (default)', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      expect(isSectionEnabled(editor, 'icon')).toBe(true);
    });

    it('checkbox reflects show state', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const checkbox = getElement(editor, '[data-testid="icon-section"] input[type="checkbox"]');
      expect(checkbox instanceof HTMLInputElement && checkbox.checked).toBe(true);
    });

    it('updates icon.icon via ha-icon-picker', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const iconPicker = getElement(editor, '[data-testid="icon-section"] ha-icon-picker');
      if (iconPicker) {
        iconPicker.dispatchEvent(
          new CustomEvent('value-changed', { detail: { value: 'mdi:thermometer' } })
        );
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.icon?.icon).toBe('mdi:thermometer');
    });
  });

  describe('size section', () => {
    it('renders size section', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const sizeSection = getElement(editor, '[data-testid="size-section"]');
      expect(sizeSection).toBeTruthy();
    });

    it('displays equal checkbox state', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
        size: { equal: true },
      });
      await editor.updateComplete;

      const checkboxes = editor.shadowRoot?.querySelectorAll(
        '[data-testid="size-section"] .checkbox-field input[type="checkbox"]'
      );
      const equalCheckbox = checkboxes?.[0];
      expect(equalCheckbox instanceof HTMLInputElement && equalCheckbox.checked).toBe(true);
    });

    it('updates size.equal on checkbox change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const checkboxes = editor.shadowRoot?.querySelectorAll(
        '[data-testid="size-section"] .checkbox-field input[type="checkbox"]'
      );
      const equalCheckbox = checkboxes?.[0];
      if (equalCheckbox instanceof HTMLInputElement) {
        equalCheckbox.checked = true;
        equalCheckbox.dispatchEvent(new Event('change'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.size?.equal).toBe(true);
    });

    it('updates size.inverse on checkbox change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const checkboxes = editor.shadowRoot?.querySelectorAll(
        '[data-testid="size-section"] .checkbox-field input[type="checkbox"]'
      );
      const inverseCheckbox = checkboxes?.[1];
      if (inverseCheckbox instanceof HTMLInputElement) {
        inverseCheckbox.checked = true;
        inverseCheckbox.dispatchEvent(new Event('change'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.size?.inverse).toBe(true);
    });
  });

  describe('layout section', () => {
    it('renders layout section', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const layoutSection = getElement(editor, '[data-testid="layout-section"]');
      expect(layoutSection).toBeTruthy();
    });

    it('updates height on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const inputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="layout-section"] ha-textfield'
      );
      const heightInput = inputs?.[0];
      if (isHaTextfield(heightInput)) {
        heightInput.value = '300';
        heightInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.height).toBe(300);
    });

    it('updates gap on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const inputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="layout-section"] ha-textfield'
      );
      const gapInput = inputs?.[1];
      if (isHaTextfield(gapInput)) {
        gapInput.value = '8';
        gapInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.gap).toBe(8);
    });
  });

  describe('data section', () => {
    it('renders data section', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const dataSection = getElement(editor, '[data-testid="data-section"]');
      expect(dataSection).toBeTruthy();
    });

    it('displays order dropdown with default value', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const select = getElement(editor, '[data-testid="data-section"] ha-select');
      expect(select).toBeTruthy();
      if (isHaSelect(select)) {
        expect(select.value).toBe('desc');
      }
    });

    it('updates order on dropdown change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const select = getElement(editor, '[data-testid="data-section"] ha-select');
      if (isHaSelect(select)) {
        select.value = 'asc';
        select.dispatchEvent(new Event('selected', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.order).toBe('asc');
    });

    it('updates limit on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const inputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="data-section"] ha-textfield'
      );
      const limitInput = inputs?.[0];
      if (isHaTextfield(limitInput)) {
        limitInput.value = '10';
        limitInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.limit).toBe(10);
    });

    it('updates filter.above on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const inputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="data-section"] ha-textfield'
      );
      const aboveInput = inputs?.[1];
      if (isHaTextfield(aboveInput)) {
        aboveInput.value = '50';
        aboveInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.filter?.above).toBe(50);
    });

    it('updates filter.unavailable on checkbox change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const checkbox = editor.shadowRoot?.querySelector(
        '[data-testid="data-section"] .checkbox-field input[type="checkbox"]'
      );
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.filter?.unavailable).toBe(true);
    });
  });

  describe('colors section', () => {
    it('renders colors section', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const colorsSection = getElement(editor, '[data-testid="colors-section"]');
      expect(colorsSection).toBeTruthy();
    });

    it('displays color inputs with default values', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const colorInputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="colors-section"] input[type="color"]'
      );
      expect(colorInputs?.length).toBeGreaterThanOrEqual(3);
    });

    it('updates color.low on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const colorInputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="colors-section"] input[type="color"]'
      );
      const lowInput = colorInputs?.[0];
      if (lowInput instanceof HTMLInputElement) {
        lowInput.value = '#ff0000';
        lowInput.dispatchEvent(new Event('input'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.color?.low).toBe('#ff0000');
    });

    it('updates color.scale.neutral on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const inputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="colors-section"] ha-textfield'
      );
      const neutralInput = inputs?.[1];
      if (isHaTextfield(neutralInput)) {
        neutralInput.value = '50';
        neutralInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.color?.scale?.neutral).toBe(50);
    });

    it('updates color.unavailable on input', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      // color.unavailable is the 4th color input (after low, mid, high)
      const colorInputs = editor.shadowRoot?.querySelectorAll(
        '[data-testid="colors-section"] input[type="color"]'
      );
      const unavailableInput = colorInputs?.[3];
      if (unavailableInput instanceof HTMLInputElement) {
        unavailableInput.value = '#555555';
        unavailableInput.dispatchEvent(new Event('input'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.color?.unavailable).toBe('#555555');
    });
  });

  describe('sparkline section', () => {
    it('renders sparkline section', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const sparklineSection = getElement(editor, '[data-testid="sparkline-section"]');
      expect(sparklineSection).toBeTruthy();
    });

    it('has show checkbox checked by default', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const checkbox = getElement(
        editor,
        '[data-testid="sparkline-section"] input[type="checkbox"]'
      );
      expect(checkbox instanceof HTMLInputElement && checkbox.checked).toBe(true);
    });

    it('updates sparkline.show on checkbox change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const checkbox = getElement(
        editor,
        '[data-testid="sparkline-section"] input[type="checkbox"]'
      );
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.sparkline?.show).toBe(false);
    });

    it('updates sparkline.period on dropdown change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const selects = editor.shadowRoot?.querySelectorAll(
        '[data-testid="sparkline-section"] ha-select'
      );
      const periodSelect = selects?.[0];
      if (isHaSelect(periodSelect)) {
        periodSelect.value = '7d';
        periodSelect.dispatchEvent(new Event('selected', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.sparkline?.period).toBe('7d');
    });

    it('updates sparkline.mode on dropdown change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const selects = editor.shadowRoot?.querySelectorAll(
        '[data-testid="sparkline-section"] ha-select'
      );
      const modeSelect = selects?.[1];
      if (isHaSelect(modeSelect)) {
        modeSelect.value = 'light';
        modeSelect.dispatchEvent(new Event('selected', { bubbles: true }));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.sparkline?.mode).toBe('light');
    });

    it('updates sparkline.line.show on checkbox change', async () => {
      editor.setConfig({
        type: 'custom:treemap-card',
        entities: ['sensor.*'],
      });
      await editor.updateComplete;

      const configChangedPromise = waitForConfigChange(editor);

      const checkboxes = editor.shadowRoot?.querySelectorAll(
        '[data-testid="sparkline-section"] .checkbox-field input[type="checkbox"]'
      );
      const lineCheckbox = checkboxes?.[0];
      if (lineCheckbox instanceof HTMLInputElement) {
        lineCheckbox.checked = false;
        lineCheckbox.dispatchEvent(new Event('change'));
      }

      const newConfig = await configChangedPromise;
      expect(newConfig.sparkline?.line?.show).toBe(false);
    });
  });
});
