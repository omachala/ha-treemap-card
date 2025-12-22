# ha-treemap-card

## 0.8.0

### Minor Changes

- bf58f56: Sparklines are here! Each rectangle now shows a mini chart of historical data.
  - **Enabled by default** - to disable, add `sparkline.show: false` to your config
  - Configurable time periods: `12h`, `24h` (default), `7d`, or `30d`
  - Works with entity sensors (uses HA long-term statistics) and JSON mode (uses data array from attribute)
  - Fully customizable line and fill styles via CSS
  - **Climate entities**: Shows temperature history with HVAC action bars (heating/cooling periods displayed at the bottom)

  Major performance overhaul - the card is now industry-grade:
  - Render multiple cards with hundreds of rectangles without breaking a sweat
  - Runs smoothly on low-end devices like Raspberry Pi
  - Added performance regression tests to keep the bar high

  Other improvements:
  - Icons now adapt to background color for better readability (same as labels)
  - Config cleanup: use `attribute` everywhere (old `param` still works)

## 0.7.0

### Minor Changes

- f949b99: Zero-value entities (e.g., closed valves at 0%) are now visible by default as small rectangles.

  New `size.min` and `size.max` options give you control over rectangle sizing:
  - `size.min: 10` - boost small items to minimum size of 10
  - `size.max: 500` - cap large outliers at 500 to prevent them dominating the layout
  - `size.min: 0` - hide zero-value items (previous behavior)

  Values are in entity units (e.g., watts, degrees), not percentages.

## 0.6.2

### Patch Changes

- 63de0dc: Improved release automation

## 0.6.1

### Patch Changes

- f73af43: Improved release reliability and code quality checks
- f73af43: Improved testing strategy for better reliability
