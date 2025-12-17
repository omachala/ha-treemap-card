# ha-treemap-card

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
