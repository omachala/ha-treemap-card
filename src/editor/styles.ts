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
  }

  .checkbox-field input[type='checkbox'] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--primary-color, #03a9f4);
  }

  .checkbox-field span {
    font-size: 14px;
    color: var(--primary-text-color, #333);
  }

  .checkbox-field.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox-field.disabled input[type='checkbox'] {
    cursor: not-allowed;
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
`;
