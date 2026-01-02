# ha-treemap-card

## 0.12.0

### Minor Changes

- 94e8c36: Add visual configuration editor - no more YAML-only setup! Configure entities, colors, labels, sparklines, and all options directly in the UI.

## 0.11.0

### Minor Changes

- 3441859: Add `color.target` option to apply gradient color to text instead of background

## 0.10.0

### Minor Changes

- d599a56: Show unavailable sensors in your treemap with `filter.unavailable: true`. Perfect for battery monitoring dashboards where dead sensors matter as much as low batteries. Customize the color with `color.unavailable`.

## 0.9.0

### Minor Changes

- 82afa65: Added configurable number formatting. The card now respects each entity's display precision setting from Home Assistant. You can also override with `value.precision` (decimal places) and `value.abbreviate` (show 2.3k, 1.5M for large numbers).

## 0.8.1

### Patch Changes

- 50d247d: Fixed entities with the same name displaying incorrect values

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
