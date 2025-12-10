# Treemap Card for Home Assistant

Visualize data as a treemap - like Finviz stock heatmaps. Rectangle sizes show relative values, colors indicate status.

<img src="docs/humidity-example.png" width="470" alt="Humidity Treemap">
<img src="docs/portfolio-example.png" width="470" alt="Portfolio Treemap">

## Installation

### HACS

1. Go to HACS > Frontend > Custom repositories
2. Add `https://github.com/omachala/ha-treemap-card`
3. Install "Treemap Card" and refresh browser

### Manual

Download `treemap-card.js` from [releases](https://github.com/omachala/ha-treemap-card/releases) to `config/www/`, then add as resource: `/local/treemap-card.js`

## Two Modes

### Entities Mode

Use `entities` to display HA entities directly. Supports wildcards.

```yaml
type: custom:treemap-card
title: Humidity
entities:
  - sensor.*_humidity
height: 300
size:
  equal: true
filter:
  above: 0
  below: 100
color:
  high: '#1157f0'
  low: '#f0b913'
  scale:
    neutral: 60
    min: 50
    max: 100
label:
  replace: ' Humidity$//'
value:
  suffix: ' %'
```

### JSON Attribute Mode

Use `entity` to read an array of objects from an entity attribute. Map any fields to label, value, size, color.

```yaml
type: custom:treemap-card
entity: sensor.trading_portfolio_holdings
label:
  param: ticker
value:
  param: todayPct
  suffix: ' %'
size:
  param: value
color:
  low: '#b91c1c'
  high: '#16a34a'
  scale:
    neutral: 0
    min: -4
    max: 4
height: 400
```

## Configuration

### Data Source

| Option | Description |
|--------|-------------|
| `entity` | Single entity with array in attributes |
| `entities` | List of entity IDs (supports `*` wildcards) |
| `data_attribute` | Attribute containing the array (default: `holdings`) |

### Label

| Option | Default | Description |
|--------|---------|-------------|
| `label.param` | `ticker` | Field name for label (JSON mode) |
| `label.show` | `true` | Show/hide |
| `label.prefix` | | Text before |
| `label.suffix` | | Text after |
| `label.replace` | | Regex: `pattern/replacement/flags` |

### Value

| Option | Default | Description |
|--------|---------|-------------|
| `value.param` | `todayPct` | Field name for value (JSON mode) |
| `value.show` | `true` | Show/hide |
| `value.prefix` | | Text before |
| `value.suffix` | | Text after |

### Size

| Option | Default | Description |
|--------|---------|-------------|
| `size.param` | same as `value.param` | Field for sizing |
| `size.equal` | `false` | Equal-sized rectangles |

### Color

| Option | Default | Description |
|--------|---------|-------------|
| `color.low` | `#b91c1c` | Color for lowest values |
| `color.high` | `#16a34a` | Color for highest values |
| `color.scale.neutral` | | Value that should appear gray (e.g., `0` for profit/loss, `50` for percentages) |
| `color.scale.min` | data min | Clamp floor - values at or below this get full `color.low` (e.g., `-5` means -5% and below are full red) |
| `color.scale.max` | data max | Clamp ceiling - values at or above this get full `color.high` (e.g., `5` means +5% and above are full green) |
| `color_param` | same as `value.param` | Which field to use for coloring (if different from display value) |

### Filter

| Option | Description |
|--------|-------------|
| `filter.above` | Only include values above this |
| `filter.below` | Only include values below this |

### Layout

| Option | Default | Description |
|--------|---------|-------------|
| `title` | | Card title |
| `height` | auto | Height in pixels |
| `gap` | `6` | Gap between rectangles |

### Entities Mode Only

| Option | Default | Description |
|--------|---------|-------------|
| `value_attribute` | `state` | Attribute for value |
| `label_attribute` | `friendly_name` | Attribute for label |
| `icon.param` | `icon` | Field for MDI icon |
| `icon.show` | `true` | Show/hide icons |

## License

MIT
