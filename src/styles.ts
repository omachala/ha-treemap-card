import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }

  ha-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .treemap-header {
    padding: 8px 16px 0px;
    font-size: 16px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .card-content {
    flex: 1;
    padding: 16px;
  }

  .treemap-container {
    position: relative;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
  }

  .treemap-item {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: filter 0.2s ease;
    border-radius: 8px;
  }

  .treemap-item:hover {
    filter: brightness(1.1);
  }

  .treemap-icon {
    --mdc-icon-size: 28px;
    opacity: 0.85;
  }

  /* Pulsing animation for active HVAC states (heating/cooling) */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .treemap-icon.hvac-active {
    animation: pulse 2s ease-in-out infinite;
  }

  .treemap-label {
    font-size: 14px;
    font-weight: 600;
    color: white;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    opacity: 0.9;
  }

  .treemap-value {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    opacity: 0.85;
  }

  .treemap-item.small .treemap-icon {
    --mdc-icon-size: 20px;
  }

  .treemap-item.small .treemap-label {
    font-size: 9px;
  }

  .treemap-item.small .treemap-value {
    font-size: 12px;
  }

  .treemap-item.tiny .treemap-icon {
    --mdc-icon-size: 16px;
  }

  .treemap-item.tiny .treemap-label {
    font-size: 8px;
  }

  .treemap-item.tiny .treemap-value {
    display: none;
  }

  .error {
    color: var(--error-color, #db4437);
    padding: 16px;
  }

  .empty {
    color: var(--secondary-text-color, #727272);
    padding: 16px;
    text-align: center;
  }

  /* Sparkline styles */
  .treemap-sparkline {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 20px;
    pointer-events: none;
  }

  .treemap-sparkline svg {
    width: 100%;
    height: 100%;
  }

  .treemap-item.small .treemap-sparkline {
    height: 14px;
  }

  .treemap-item.tiny .treemap-sparkline {
    display: none;
  }
`;
