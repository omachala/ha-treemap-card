# Treemap Card for Home Assistant

A custom Lovelace card that displays data as a treemap visualization - similar to stock market heatmaps like Finviz. Rectangle sizes represent relative values, colors indicate performance or status.

## Features

- **Two data modes**: Entity list with wildcards, or single entity with JSON array attribute
- **Squarified layout**: Optimized rectangle aspect ratios for readability
- **Configurable colors**: Custom low/high colors with optional neutral point and clamping
- **Flexible field mapping**: Map any JSON fields to label, value, size, color
- **Click actions**: Tap rectangles to open entity more-info dialog

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Go to Frontend > Custom repositories
3. Add this repository URL
4. Install "Treemap Card"
5. Refresh browser

### Manual

1. Download `treemap-card.js` from the [latest release](https://github.com/yourusername/ha-treemap-card/releases)
2. Copy to `config/www/treemap-card.js`
3. Add resource in Settings > Dashboards > Resources:
   ```
   /local/treemap-card.js
   ```

## Usage Modes

### Mode 1: Entity List

Display multiple entities directly. Uses entity state as value, friendly_name as label.

```yaml
type: custom:treemap-card
title: Battery Status
entities:
  - sensor.phone_battery
  - sensor.tablet_battery
  - sensor.laptop_battery
```

### Mode 2: Wildcard Matching

Match entities by pattern using `*` wildcard.

```yaml
type: custom:treemap-card
title: All Batteries
entities:
  - sensor.*_battery
```

### Mode 3: JSON Array from Entity Attribute

Read structured data from a single entity's attribute. Useful for custom sensors with complex data.

```yaml
type: custom:treemap-card
title: Portfolio
entity: sensor.portfolio_holdings
data_attribute: holdings
label:
  param: ticker
value:
  param: todayPct
  suffix: '%'
size:
  param: value
color:
  low: '#b91c1c'
  high: '#16a34a'
  scale:
    neutral: 0
    min: -8
    max: 8
```

The entity should have an attribute like:
```json
{
  "holdings": [
    {"ticker": "NVDA", "value": 1500, "todayPct": 2.5},
    {"ticker": "AMD", "value": 800, "todayPct": -1.2, "icon": "mdi:chip"}
  ]
}
```

## Examples

### Room Temperatures

```yaml
type: custom:treemap-card
title: Temperatures
entities:
  - sensor.*_temperature
color:
  low: '#3b82f6'
  high: '#ef4444'
```

### Equal Size Grid

When you want uniform rectangles (only color varies):

```yaml
type: custom:treemap-card
title: Status Overview
entity: sensor.my_data
size:
  equal: true
```

### Custom Labels with Regex Replace

```yaml
type: custom:treemap-card
entity: sensor.data
label:
  param: name
  replace: '_temperature//g'
  prefix: 'Room: '
```

### Hide Elements

```yaml
type: custom:treemap-card
entity: sensor.data
icon:
  show: false
value:
  show: false
```

### Color Scale with Neutral Point

For data centered around zero (like percentage changes):

```yaml
type: custom:treemap-card
entity: sensor.data
color:
  low: '#b91c1c'
  high: '#16a34a'
  scale:
    neutral: 0
    min: -8
    max: 8
```

With this config:
- `0%` = neutral (gray-ish)
- `-8%` or below = full red
- `+8%` or above = full green
- Values between are interpolated

## Configuration Reference

### Data Source

| Option | Description |
|--------|-------------|
| `entity` | Single entity with data array in attributes |
| `entities` | List of entity IDs (supports `*` wildcards) |
| `data_attribute` | Attribute name containing data array (default: `holdings`) |

### Label (for entity mode with JSON)

| Option | Default | Description |
|--------|---------|-------------|
| `label.param` | `ticker` | Field name for label |
| `label.show` | `true` | Show/hide label |
| `label.prefix` | | Text before label |
| `label.suffix` | | Text after label |
| `label.replace` | | Regex: `pattern/replacement/flags` |

### Value

| Option | Default | Description |
|--------|---------|-------------|
| `value.param` | `todayPct` | Field name for displayed value |
| `value.show` | `true` | Show/hide value |
| `value.prefix` | | Text before value |
| `value.suffix` | | Text after value |

### Size

| Option | Default | Description |
|--------|---------|-------------|
| `size.param` | same as `value.param` | Field for rectangle sizing |
| `size.equal` | `false` | Use equal-sized grid layout |

### Color

| Option | Default | Description |
|--------|---------|-------------|
| `color.low` | `#b91c1c` (red) | Color for low values |
| `color.high` | `#16a34a` (green) | Color for high values |
| `color.scale.neutral` | | Center point for color scale |
| `color.scale.min` | data min | Value at which color is fully low |
| `color.scale.max` | data max | Value at which color is fully high |
| `color_param` | same as `value.param` | Field for color calculation |

### Icon

| Option | Default | Description |
|--------|---------|-------------|
| `icon.param` | `icon` | Field name for MDI icon |
| `icon.show` | `true` | Show/hide icon |

### Layout

| Option | Default | Description |
|--------|---------|-------------|
| `title` | | Card title |
| `height` | auto | Fixed height in pixels (auto = 80px per item, min 200) |
| `gap` | `4` | Gap between rectangles in pixels |

### Entities Mode Options

These apply when using `entities` instead of `entity`:

| Option | Default | Description |
|--------|---------|-------------|
| `value_attribute` | `state` | Attribute to use as value |
| `label_attribute` | `friendly_name` | Attribute to use as label |

## License

MIT
