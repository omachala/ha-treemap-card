/**
 * Visual configuration editor for treemap-card
 *
 * Supports entities mode only. JSON mode is YAML-only.
 * Uses Home Assistant's official form components for consistent UI.
 */

import { LitElement, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { set } from 'es-toolkit/compat';
import { isEntityConfig, type HomeAssistant, type TreemapCardConfig } from '../types';
import type { LovelaceCardEditor } from './types';
import { editorStyles } from './styles';
import { localize } from '../localize';

const REPO_URL = 'https://github.com/omachala/ha-treemap-card';

/**
 * Get value from HA component or native input
 */
function getEventValue(e: Event): string {
  const target = e.target;
  // HA components and native inputs both have .value
  if (target && typeof target === 'object' && 'value' in target) {
    return String(target.value ?? '');
  }
  return '';
}

/**
 * Get checkbox state from event
 */
function getCheckboxValue(e: Event): boolean {
  const target = e.target;
  if (target instanceof HTMLInputElement) {
    return target.checked;
  }
  return false;
}

@customElement('treemap-card-editor')
export class TreemapCardEditor extends LitElement implements LovelaceCardEditor {
  static override styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public lovelace?: unknown;
  @state() private _config?: TreemapCardConfig;

  public setConfig(config: TreemapCardConfig): void {
    this._config = { ...config };
  }

  /**
   * Shorthand for localize with current hass context
   */
  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _fireConfigChanged(): void {
    if (!this._config) return;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Generic handler for text input changes
   */
  private _handleTextChange(path: string, e: Event): void {
    if (!this._config) return;
    const value = getEventValue(e) || undefined;
    this._config = set({ ...this._config }, path, value);
    this._fireConfigChanged();
  }

  /**
   * Generic handler for checkbox changes
   */
  private _handleBoolChange(path: string, e: Event): void {
    if (!this._config) return;
    const value = getCheckboxValue(e);
    this._config = set({ ...this._config }, path, value);
    this._fireConfigChanged();
  }

  /**
   * Generic handler for number input changes
   */
  private _handleNumberChange(path: string, e: Event): void {
    if (!this._config) return;
    const strValue = getEventValue(e);
    const value = strValue ? parseFloat(strValue) : undefined;
    this._config = set({ ...this._config }, path, value);
    this._fireConfigChanged();
  }

  /**
   * Handler for entities textarea (splits lines into array)
   */
  private _handleEntitiesChange(e: Event): void {
    if (!this._config) return;
    const value = getEventValue(e);
    const entities = value
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    this._config = set({ ...this._config }, 'entities', entities);
    this._fireConfigChanged();
  }

  /**
   * Handler for ha-icon-picker value-changed event
   */
  private _handleIconChange(e: CustomEvent): void {
    if (!this._config) return;
    // HA components use untyped CustomEvent.detail
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const value: string | undefined = e.detail?.value || undefined;
    this._config = set({ ...this._config }, 'icon.icon', value);
    this._fireConfigChanged();
  }

  /**
   * Handler for find/replace inputs (combines into 'find/replace' format)
   */
  private _handleReplaceChange(field: 'find' | 'replace', e: Event): void {
    if (!this._config) return;
    const inputValue = getEventValue(e);
    const current = this._config.label?.replace ?? '/';
    const parts = current.split('/');
    const find = field === 'find' ? inputValue : (parts[0] ?? '');
    const replace = field === 'replace' ? inputValue : (parts[1] ?? '');
    const newReplace = find || replace ? `${find}/${replace}` : undefined;
    this._config = set({ ...this._config }, 'label.replace', newReplace);
    this._fireConfigChanged();
  }

  /**
   * Handler for exclude textarea (splits lines into array, removes if empty)
   */
  private _handleExcludeChange(e: Event): void {
    if (!this._config) return;
    const value = getEventValue(e);
    const exclude = value
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    this._config = set({ ...this._config }, 'exclude', exclude.length > 0 ? exclude : undefined);
    this._fireConfigChanged();
  }

  private _docsUrl(anchor: string): string {
    return `${REPO_URL}?tab=readme-ov-file#${anchor}`;
  }

  private _renderDocsLink(anchor: string): TemplateResult {
    return html`
      <a class="docs-link" href=${this._docsUrl(anchor)} target="_blank" rel="noopener">
        <ha-icon icon="mdi:help-circle-outline"></ha-icon>
      </a>
    `;
  }

  private _renderToggleSection(opts: {
    id: string;
    title: string;
    checked: boolean;
    onToggle: (e: Event) => void;
    content: TemplateResult;
    docsAnchor?: string;
  }): TemplateResult {
    return html`
      <ha-expansion-panel outlined data-testid="${opts.id}-section">
        <input
          slot="leading-icon"
          type="checkbox"
          .checked=${opts.checked}
          @change=${opts.onToggle}
          @click=${(e: Event) => e.stopPropagation()}
        />
        <span slot="header">${opts.title}</span>
        <div class="content">
          ${opts.content} ${opts.docsAnchor ? this._renderDocsLink(opts.docsAnchor) : ''}
        </div>
      </ha-expansion-panel>
    `;
  }

  protected override render(): TemplateResult {
    if (!this._config) {
      return html`<div class="editor">${this._t('editor.no_config')}</div>`;
    }

    // JSON mode (entity attribute) - show message to use YAML
    if (this._config.entity) {
      return html`
        <div class="editor">
          <ha-alert alert-type="info">${this._t('editor.yaml_only')}</ha-alert>
        </div>
      `;
    }

    const entities =
      this._config.entities?.map(e => (isEntityConfig(e) ? e.entity : e)).join('\n') ?? '';
    const exclude = this._config.exclude?.join('\n') ?? '';
    const label = this._config.label ?? {};
    const value = this._config.value ?? {};
    const icon = this._config.icon ?? {};

    return html`
      <div class="editor">
        <!-- Entities -->
        <div class="field" data-testid="entities-field">
          <label class="field-label">${this._t('editor.entities.label')}</label>
          <textarea
            class="textarea"
            .value=${entities}
            @input=${this._handleEntitiesChange}
            placeholder="sensor.temperature_*&#10;climate.*&#10;light.living_*"
            rows="3"
          ></textarea>
          <span class="field-helper">${this._t('editor.entities.helper')}</span>
        </div>

        <!-- Exclude -->
        <div class="field" data-testid="exclude-field">
          <label class="field-label">${this._t('editor.exclude.label')}</label>
          <textarea
            class="textarea"
            .value=${exclude}
            @input=${this._handleExcludeChange}
            rows="2"
          ></textarea>
        </div>

        <!-- Label section -->
        ${this._renderToggleSection({
          id: 'label',
          title: this._t('editor.label.title'),
          checked: label.show !== false,
          onToggle: (e: Event) => this._handleBoolChange('label.show', e),
          docsAnchor: 'label',
          content: html`
            <div class="field-row">
              <ha-textfield
                label=${this._t('editor.label.prefix')}
                .value=${label.prefix ?? ''}
                @input=${(e: Event) => this._handleTextChange('label.prefix', e)}
              ></ha-textfield>
              <ha-textfield
                label=${this._t('editor.label.suffix')}
                .value=${label.suffix ?? ''}
                @input=${(e: Event) => this._handleTextChange('label.suffix', e)}
              ></ha-textfield>
            </div>
            <div class="field-row">
              <ha-textfield
                label=${this._t('editor.label.find')}
                .value=${label.replace?.split('/')[0] ?? ''}
                @input=${(e: Event) => this._handleReplaceChange('find', e)}
                placeholder=${this._t('editor.label.find_placeholder')}
              ></ha-textfield>
              <ha-textfield
                label=${this._t('editor.label.replace')}
                .value=${label.replace?.split('/')[1] ?? ''}
                @input=${(e: Event) => this._handleReplaceChange('replace', e)}
                placeholder=${this._t('editor.label.replace_placeholder')}
              ></ha-textfield>
            </div>
          `,
        })}

        <!-- Value section -->
        ${this._renderToggleSection({
          id: 'value',
          title: this._t('editor.value.title'),
          checked: value.show !== false,
          onToggle: (e: Event) => this._handleBoolChange('value.show', e),
          docsAnchor: 'value',
          content: html`
            <div class="field-row">
              <ha-textfield
                label=${this._t('editor.value.prefix')}
                .value=${value.prefix ?? ''}
                @input=${(e: Event) => this._handleTextChange('value.prefix', e)}
              ></ha-textfield>
              <ha-textfield
                label=${this._t('editor.value.suffix')}
                .value=${value.suffix ?? ''}
                @input=${(e: Event) => this._handleTextChange('value.suffix', e)}
                placeholder=${this._t('editor.value.suffix_placeholder')}
              ></ha-textfield>
            </div>
            <div class="field-row">
              <ha-textfield
                type="number"
                label=${this._t('editor.value.precision')}
                .value=${value.precision ?? ''}
                @input=${(e: Event) => this._handleNumberChange('value.precision', e)}
                placeholder="1"
              ></ha-textfield>
            </div>
            <label class="checkbox-field">
              <input
                type="checkbox"
                .checked=${value.abbreviate ?? false}
                @change=${(e: Event) => this._handleBoolChange('value.abbreviate', e)}
              />
              <span>${this._t('editor.value.abbreviate')}</span>
            </label>
          `,
        })}

        <!-- Icon section -->
        ${this._renderToggleSection({
          id: 'icon',
          title: this._t('editor.icon.title'),
          checked: icon.show !== false,
          onToggle: (e: Event) => this._handleBoolChange('icon.show', e),
          docsAnchor: 'icon',
          content: html`
            <ha-icon-picker
              label=${this._t('editor.icon.override')}
              .hass=${this.hass}
              .value=${icon.icon ?? ''}
              @value-changed=${this._handleIconChange}
            ></ha-icon-picker>
          `,
        })}

        <!-- Sparkline section -->
        <ha-expansion-panel outlined data-testid="sparkline-section">
          <input
            slot="leading-icon"
            type="checkbox"
            .checked=${this._config.sparkline?.show !== false}
            @change=${(e: Event) => this._handleBoolChange('sparkline.show', e)}
            @click=${(e: Event) => e.stopPropagation()}
          />
          <span slot="header">${this._t('editor.sparkline.title')}</span>
          <div class="content">
            <ha-select
              label=${this._t('editor.sparkline.period')}
              .value=${this._config.sparkline?.period ?? '24h'}
              @selected=${(e: Event) => this._handleTextChange('sparkline.period', e)}
              @closed=${(e: Event) => e.stopPropagation()}
            >
              <ha-list-item value="12h">${this._t('editor.sparkline.period_12h')}</ha-list-item>
              <ha-list-item value="24h">${this._t('editor.sparkline.period_24h')}</ha-list-item>
              <ha-list-item value="7d">${this._t('editor.sparkline.period_7d')}</ha-list-item>
              <ha-list-item value="30d">${this._t('editor.sparkline.period_30d')}</ha-list-item>
            </ha-select>
            <ha-select
              label=${this._t('editor.sparkline.mode')}
              .value=${this._config.sparkline?.mode ?? 'dark'}
              @selected=${(e: Event) => this._handleTextChange('sparkline.mode', e)}
              @closed=${(e: Event) => e.stopPropagation()}
            >
              <ha-list-item value="dark">${this._t('editor.sparkline.mode_dark')}</ha-list-item>
              <ha-list-item value="light">${this._t('editor.sparkline.mode_light')}</ha-list-item>
            </ha-select>
            <label class="checkbox-field">
              <input
                type="checkbox"
                .checked=${this._config.sparkline?.line?.show !== false}
                @change=${(e: Event) => this._handleBoolChange('sparkline.line.show', e)}
              />
              <span>${this._t('editor.sparkline.show_line')}</span>
            </label>
            <label class="checkbox-field">
              <input
                type="checkbox"
                .checked=${this._config.sparkline?.fill?.show !== false}
                @change=${(e: Event) => this._handleBoolChange('sparkline.fill.show', e)}
              />
              <span>${this._t('editor.sparkline.show_fill')}</span>
            </label>
            <label class="checkbox-field">
              <input
                type="checkbox"
                .checked=${this._config.sparkline?.hvac?.show !== false}
                @change=${(e: Event) => this._handleBoolChange('sparkline.hvac.show', e)}
              />
              <span>${this._t('editor.sparkline.show_hvac')}</span>
            </label>
            ${this._renderDocsLink('sparkline')}
          </div>
        </ha-expansion-panel>

        <!-- Colors section -->
        <ha-expansion-panel outlined data-testid="colors-section">
          <span slot="header">${this._t('editor.colors.title')}</span>
          <div class="content">
            <ha-select
              label=${this._t('editor.colors.target')}
              .value=${this._config.color?.target ?? 'background'}
              @selected=${(e: Event) => this._handleTextChange('color.target', e)}
              @closed=${(e: Event) => e.stopPropagation()}
            >
              <ha-list-item value="background"
                >${this._t('editor.colors.target_background')}</ha-list-item
              >
              <ha-list-item value="foreground"
                >${this._t('editor.colors.target_foreground')}</ha-list-item
              >
            </ha-select>
            <span class="field-label">${this._t('editor.colors.gradient')}</span>
            <div class="color-scale-row">
              <label class="color-field">
                <input
                  type="color"
                  .value=${this._config.color?.low ?? '#b91c1c'}
                  @input=${(e: Event) => this._handleTextChange('color.low', e)}
                />
              </label>
              <ha-textfield
                type="number"
                label=${this._t('editor.colors.low')}
                .value=${this._config.color?.scale?.min ?? ''}
                @input=${(e: Event) => this._handleNumberChange('color.scale.min', e)}
                placeholder=${this._t('editor.colors.auto')}
              ></ha-textfield>
            </div>
            <div class="color-scale-row">
              <label class="color-field">
                <input
                  type="color"
                  .value=${this._config.color?.mid ?? '#888888'}
                  @input=${(e: Event) => this._handleTextChange('color.mid', e)}
                />
              </label>
              <ha-textfield
                type="number"
                label=${this._t('editor.colors.mid')}
                .value=${this._config.color?.scale?.neutral ?? ''}
                @input=${(e: Event) => this._handleNumberChange('color.scale.neutral', e)}
                placeholder=${this._t('editor.colors.middle')}
              ></ha-textfield>
            </div>
            <div class="color-scale-row">
              <label class="color-field">
                <input
                  type="color"
                  .value=${this._config.color?.high ?? '#16a34a'}
                  @input=${(e: Event) => this._handleTextChange('color.high', e)}
                />
              </label>
              <ha-textfield
                type="number"
                label=${this._t('editor.colors.high')}
                .value=${this._config.color?.scale?.max ?? ''}
                @input=${(e: Event) => this._handleNumberChange('color.scale.max', e)}
                placeholder=${this._t('editor.colors.auto')}
              ></ha-textfield>
            </div>
            <div class="color-scale-row">
              <label class="color-field">
                <input
                  type="color"
                  .value=${this._config.color?.unavailable ?? '#868e96'}
                  @input=${(e: Event) => this._handleTextChange('color.unavailable', e)}
                />
              </label>
              <span class="color-label">${this._t('editor.colors.unavailable')}</span>
            </div>
            <span class="field-label">${this._t('editor.colors.hvac_colors')}</span>
            <div class="color-row">
              <label class="color-field">
                <input
                  type="color"
                  .value=${this._config.color?.hvac?.heating ?? '#ff6b35'}
                  @input=${(e: Event) => this._handleTextChange('color.hvac.heating', e)}
                />
                <span>${this._t('editor.colors.heating')}</span>
              </label>
              <label class="color-field">
                <input
                  type="color"
                  .value=${this._config.color?.hvac?.cooling ?? '#4dabf7'}
                  @input=${(e: Event) => this._handleTextChange('color.hvac.cooling', e)}
                />
                <span>${this._t('editor.colors.cooling')}</span>
              </label>
              <label class="color-field">
                <input
                  type="color"
                  .value=${this._config.color?.hvac?.off ?? '#868e96'}
                  @input=${(e: Event) => this._handleTextChange('color.hvac.off', e)}
                />
                <span>${this._t('editor.colors.off')}</span>
              </label>
            </div>
            ${this._renderDocsLink('color')}
          </div>
        </ha-expansion-panel>

        <!-- Size section -->
        <ha-expansion-panel outlined data-testid="size-section">
          <span slot="header">${this._t('editor.size.title')}</span>
          <div class="content">
            <label class="checkbox-field">
              <input
                type="checkbox"
                .checked=${this._config.size?.equal ?? false}
                @change=${(e: Event) => this._handleBoolChange('size.equal', e)}
              />
              <span>${this._t('editor.size.equal')}</span>
            </label>
            <label class="checkbox-field">
              <input
                type="checkbox"
                .checked=${this._config.size?.inverse ?? false}
                .disabled=${this._config.size?.equal ?? false}
                @change=${(e: Event) => this._handleBoolChange('size.inverse', e)}
              />
              <span>${this._t('editor.size.inverse')}</span>
            </label>
            <div class="field-row">
              <ha-textfield
                type="number"
                label=${this._t('editor.size.min')}
                .value=${this._config.size?.min ?? ''}
                .disabled=${this._config.size?.equal ?? false}
                @input=${(e: Event) => this._handleNumberChange('size.min', e)}
                placeholder=${this._t('editor.colors.auto')}
              ></ha-textfield>
              <ha-textfield
                type="number"
                label=${this._t('editor.size.max')}
                .value=${this._config.size?.max ?? ''}
                .disabled=${this._config.size?.equal ?? false}
                @input=${(e: Event) => this._handleNumberChange('size.max', e)}
                placeholder=${this._t('editor.colors.auto')}
              ></ha-textfield>
            </div>
            ${this._renderDocsLink('size')}
          </div>
        </ha-expansion-panel>

        <!-- Data section (order, filter, limit) -->
        <ha-expansion-panel outlined data-testid="data-section">
          <span slot="header">${this._t('editor.data.title')}</span>
          <div class="content">
            <ha-select
              label=${this._t('editor.data.order')}
              .value=${this._config.order ?? 'desc'}
              @selected=${(e: Event) => this._handleTextChange('order', e)}
              @closed=${(e: Event) => e.stopPropagation()}
            >
              <ha-list-item value="desc">${this._t('editor.data.desc')}</ha-list-item>
              <ha-list-item value="asc">${this._t('editor.data.asc')}</ha-list-item>
            </ha-select>
            <ha-textfield
              type="number"
              label=${this._t('editor.data.limit')}
              .value=${this._config.limit ?? ''}
              @input=${(e: Event) => this._handleNumberChange('limit', e)}
              placeholder=${this._t('editor.data.all')}
            ></ha-textfield>
            <div class="field-row">
              <ha-textfield
                type="number"
                label=${this._t('editor.data.above')}
                .value=${this._config.filter?.above ?? ''}
                @input=${(e: Event) => this._handleNumberChange('filter.above', e)}
              ></ha-textfield>
              <ha-textfield
                type="number"
                label=${this._t('editor.data.below')}
                .value=${this._config.filter?.below ?? ''}
                @input=${(e: Event) => this._handleNumberChange('filter.below', e)}
              ></ha-textfield>
            </div>
            <label class="checkbox-field">
              <input
                type="checkbox"
                .checked=${this._config.filter?.unavailable ?? false}
                @change=${(e: Event) => this._handleBoolChange('filter.unavailable', e)}
              />
              <span>${this._t('editor.data.unavailable')}</span>
            </label>
            ${this._renderDocsLink('order--filter')}
          </div>
        </ha-expansion-panel>

        <!-- Layout section -->
        <ha-expansion-panel outlined data-testid="layout-section">
          <span slot="header">${this._t('editor.layout.title')}</span>
          <div class="content">
            <div class="field-row">
              <ha-textfield
                type="number"
                label=${this._t('editor.layout.height')}
                .value=${this._config.height ?? ''}
                @input=${(e: Event) => this._handleNumberChange('height', e)}
                placeholder=${this._t('editor.colors.auto')}
              ></ha-textfield>
              <ha-textfield
                type="number"
                label=${this._t('editor.layout.gap')}
                .value=${this._config.gap ?? ''}
                @input=${(e: Event) => this._handleNumberChange('gap', e)}
                placeholder="6"
              ></ha-textfield>
            </div>
            ${this._renderDocsLink('layout')}
          </div>
        </ha-expansion-panel>

        <!-- Footer banner -->
        <div class="footer-banner">
          <a href=${REPO_URL} target="_blank" rel="noopener">
            <ha-icon icon="mdi:book-open-variant"></ha-icon>
            ${this._t('editor.footer.docs')}
          </a>
          <span class="separator">|</span>
          <a href="${REPO_URL}/issues" target="_blank" rel="noopener">
            <ha-icon icon="mdi:bug-outline"></ha-icon>
            ${this._t('editor.footer.issues')}
          </a>
          <span class="separator">|</span>
          <a href=${REPO_URL} target="_blank" rel="noopener">
            <ha-icon icon="mdi:star-outline"></ha-icon>
            ${this._t('editor.footer.star')}
          </a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'treemap-card-editor': TreemapCardEditor;
  }
}
