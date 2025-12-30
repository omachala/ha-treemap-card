import { css } from 'lit';

export const editorStyles = css`
  :host {
    display: block;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Info message for YAML-only features */
  .info-message {
    padding: 12px 16px;
    background: var(--secondary-background-color, #f5f5f5);
    border-radius: 8px;
    font-size: 14px;
    color: var(--secondary-text-color, #666);
  }

  /* Field styling */
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--secondary-text-color, #666);
  }

  .field-helper {
    font-size: 11px;
    color: var(--secondary-text-color, #888);
  }

  /* Inputs */
  .input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 4px;
    font-size: 14px;
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #333);
    box-sizing: border-box;
  }

  .input:focus {
    outline: none;
    border-color: var(--primary-color, #03a9f4);
  }

  .textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #333);
    box-sizing: border-box;
    resize: vertical;
  }

  .textarea:focus {
    outline: none;
    border-color: var(--primary-color, #03a9f4);
  }

  /* ha-expansion-panel */
  ha-expansion-panel input[type='checkbox'] {
    width: 16px;
    height: 16px;
    margin: 0 8px 0 0;
    cursor: pointer;
    accent-color: var(--primary-color, #03a9f4);
  }

  ha-expansion-panel .content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Docs link at end of section */
  .docs-link {
    align-self: flex-end;
    color: var(--secondary-text-color, #888);
    opacity: 0.6;
    transition: opacity 0.2s;
    padding: 4px 8px;
    margin: -4px -8px;
    min-width: 40px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .docs-link:hover {
    opacity: 1;
  }

  .docs-link ha-icon {
    --mdc-icon-size: 20px;
  }

  /* Color picker row */
  .color-row {
    display: flex;
    gap: 16px;
  }

  .color-field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  .color-field input[type='color'] {
    width: 48px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 4px;
    cursor: pointer;
    background: none;
  }

  .color-field input[type='color']::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-field input[type='color']::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }

  .color-field span {
    font-size: 11px;
    color: var(--secondary-text-color, #666);
  }

  /* Inline input field */
  .inline-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Side-by-side fields */
  .field-row {
    display: flex;
    gap: 8px;
  }

  .field-row ha-textfield,
  .field-row ha-select {
    flex: 1;
  }

  /* Checkbox with label */
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--primary-text-color, #333);
  }

  .checkbox-field input[type='checkbox'] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--primary-color, #03a9f4);
  }

  .checkbox-field input[type='checkbox']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox-field input[type='checkbox']:disabled + span {
    opacity: 0.5;
  }

  /* Color + scale value row */
  .color-scale-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .color-scale-row .color-field {
    margin: 0;
  }

  .color-scale-row ha-textfield {
    flex: 1;
  }

  /* Footer banner */
  .footer-banner {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 8px;
    font-size: 13px;
    color: var(--secondary-text-color, #888);
  }

  .footer-banner a {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--secondary-text-color, #888);
    text-decoration: none;
    transition: color 0.2s;
    padding: 10px 12px;
    min-height: 44px;
    box-sizing: border-box;
    border-radius: 8px;
  }

  .footer-banner a:hover {
    color: var(--primary-text-color, #333);
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
  }

  .footer-banner ha-icon {
    --mdc-icon-size: 18px;
  }

  .footer-banner .separator {
    opacity: 0.3;
  }
`;
