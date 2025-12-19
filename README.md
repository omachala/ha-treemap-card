<p align="center">
  <img src="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/icon.png" width="128" alt="Treemap Card Icon">
</p>

<h1 align="center">Treemap Card for Home Assistant</h1>

<p align="center">
  <a href="https://github.com/hacs/integration"><img src="https://img.shields.io/badge/HACS-Default-blue.svg?style=for-the-badge" alt="HACS Default"></a>
  <a href="https://github.com/omachala/ha-treemap-card/releases"><img src="https://img.shields.io/github/downloads/omachala/ha-treemap-card/total?style=for-the-badge" alt="Downloads"></a>
  <a href="https://github.com/omachala/ha-treemap-card/releases"><img src="https://img.shields.io/github/v/release/omachala/ha-treemap-card?style=for-the-badge&color=blue" alt="Version"></a>
  <a href="https://codecov.io/gh/omachala/ha-treemap-card"><img src="https://img.shields.io/codecov/c/github/omachala/ha-treemap-card?style=for-the-badge" alt="Coverage"></a>
</p>

<p align="center">
  A custom Lovelace card that dynamically visualizes entities as a treemap. Rectangle sizes represent relative values while colors indicate status - perfect for comparing sensors, lights, thermostats, portfolios or any numeric data at a glance.
</p>

<table border="0" cellspacing="0" cellpadding="8">
<tr>
<td border="0">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/humidity-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/humidity.png">
  <img alt="Humidity sensors" src="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/humidity.png">
</picture>
</td>
<td border="0">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/climate-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/climate.png">
  <img alt="Climate entities" src="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/climate.png">
</picture>
</td>
</tr>
<tr>
<td border="0">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/lights-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/lights.png">
  <img alt="Light entities" src="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/lights.png">
</picture>
</td>
<td border="0">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/resources-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/resources.png">
  <img alt="Resource usage" src="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/resources.png">
</picture>
</td>
</tr>
</table>

### Why Treemap Card?

- Handles thousands of items without breaking a sweat
- Works beautifully with sensors, lights, and thermostats
- Sparklines show historical trends
- Wildly configurable (colors, gradients, sizes, labels, icons, filters, wildcards, custom CSS)
- Tested and maintained

## Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=omachala&repository=ha-treemap-card&category=dashboard)

Or manually:

1. Go to HACS → Frontend
2. Search for "Treemap Card"
3. Install and restart Home Assistant

### Manual

Download `treemap-card.js` from [releases](https://github.com/omachala/ha-treemap-card/releases) and follow the [official guide](https://developers.home-assistant.io/docs/frontend/custom-ui/registering-resources/).

## Data Modes

The card supports two ways to get data:

### Entities Mode

Display Home Assistant entities directly. Supports wildcards to match multiple entities at once.

```yaml
type: custom:treemap-card
entities:
  - sensor.temperature_*
  - sensor.humidity_*
exclude:
  - sensor.*_battery
```

### JSON Attribute Mode

For data where all values come from a single entity as JSON. Since Home Assistant doesn't allow JSON as sensor state values, structured data must be stored in attributes - a common pattern when feeding HA from external sources like Node-RED or custom integrations. This is ideal when you don't want (or can't) create individual sensors for each data item, especially for dynamic lists like stock portfolios, server metrics, or any array of objects.

<p align="center">
  <br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/stocks-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/stocks.png">
    <img alt="Stock portfolio treemap" src="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/stocks.png">
  </picture>
  <br><br>
</p>

```yaml
type: custom:treemap-card
entity: sensor.my_data
data_attribute: items
label:
  attribute: name
value:
  attribute: amount
```

## Entity Types

The card is optimized for three entity types, each with special handling.

### Sensors

Standard numeric sensors like temperature, humidity, battery levels, energy usage.

```yaml
type: custom:treemap-card
header:
  title: Humidity Levels
entities:
  - sensor.*_humidity
exclude:
  - sensor.*target*
size:
  equal: true
value:
  suffix: '%'
color:
  low: '#4dabf7'
  mid: '#69db7c'
  high: '#ff6b35'
  scale:
    neutral: 50
    min: 30
    max: 70
label:
  replace: ' Humidity$//'
height: 300
```

### Lights

Light entities automatically use brightness for sizing and display their actual color.

- **RGB/HS color lights**: Rectangle shows the light's actual color
- **Dimmable-only lights**: Yellow gradient based on brightness
- **Off lights**: Uses `color.low` (default: dark gray `#333333`)

```yaml
type: custom:treemap-card
header:
  title: Lights
entities:
  - light.*
color:
  low: '#1a1a1a'
  high: '#fbbf24'
height: 300
```

**Light-specific behavior:**

| Feature   | Behavior                                 |
| --------- | ---------------------------------------- |
| Size      | Based on brightness (brighter = bigger)  |
| Color     | Actual light color (RGB/HS) if available |
| Off state | Uses `color.low` value                   |
| Value     | Shows brightness percentage              |

### Climate

Climate entities (thermostats, HVAC) support special computed values that make it easy to visualize which rooms need attention.

**Standard attributes** you can use:

| Attribute             | What it shows                                       |
| --------------------- | --------------------------------------------------- |
| `current_temperature` | Current room temperature                            |
| `temperature`         | Target/setpoint temperature                         |
| `hvac_action`         | Current action: `heating`, `cooling`, `idle`, `off` |

**Computed attributes** - calculated automatically for you:

| Attribute         | What it shows                                                                            | Best for                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `temp_difference` | How far from target (always positive). A room 3°C too cold or 3°C too hot both show `3`. | Sizing - rooms furthest from target get biggest rectangles |
| `temp_offset`     | Direction from target. Too cold = negative, too hot = positive.                          | Coloring - blue for cold, red for hot                      |

**Smart offset behavior**: The card understands your heating/cooling goals:

- **Heating mode**: If the room is already warm enough, offset shows `0` (not a positive number)
- **Cooling mode**: If the room is already cool enough, offset shows `0` (not a negative number)

Example: Room at 24°C, target 21°C, mode is heating → shows `0.0°C` because it's warm enough. No action needed.

**Example: Temperature offset view**

Show how far each room is from target. Blue = too cold, green = on target, orange = too hot:

```yaml
type: custom:treemap-card
header:
  title: Temperature Offset
entities:
  - climate.*
size:
  attribute: temp_difference
  inverse: true
value:
  attribute: temp_offset
  suffix: '°C'
color:
  attribute: temp_offset
  low: '#4dabf7'
  mid: '#69db7c'
  high: '#ff6b35'
  scale:
    neutral: 0
    min: -3
    max: 3
label:
  replace: ^Wiser //
height: 350
```

**Example: Current temperature with HVAC status**

Show current temperature, colored by value but override when actively heating/cooling:

```yaml
type: custom:treemap-card
header:
  title: Room Temperatures
entities:
  - climate.*
size:
  equal: true
value:
  attribute: current_temperature
  suffix: '°C'
color:
  low: '#4dabf7'
  mid: '#69db7c'
  high: '#ff6b35'
  scale:
    neutral: 21
    min: 18
    max: 24
  hvac:
    heating: '#ff6b35'
    cooling: '#4dabf7'
label:
  replace: ^Wiser //
height: 400
```

**HVAC color behavior:**

When `color.hvac` is configured:

| State                 | Color behavior                                         |
| --------------------- | ------------------------------------------------------ |
| `heating`             | Uses `hvac.heating` color (overrides gradient)         |
| `cooling`             | Uses `hvac.cooling` color (overrides gradient)         |
| `idle`                | Uses gradient based on value (so you see temp offset)  |
| `off` / `unavailable` | Always uses `hvac.off` color (default: gray `#868e96`) |

This lets you see temperature-based colors normally, but immediately spot which rooms are actively heating or cooling.

## Configuration Reference

### Data Source

| Option           | Default | Description                                                          |
| ---------------- | ------- | -------------------------------------------------------------------- |
| `entities`       |         | List of entity IDs. Supports `*` wildcards like `sensor.*_humidity`. |
| `exclude`        |         | List of entity patterns to exclude. Supports `*` wildcards.          |
| `entity`         |         | Single entity ID with array data in attributes (JSON mode).          |
| `data_attribute` | `items` | Which attribute contains the array (JSON mode).                      |

### Label

| Option            | Default         | Description                                                                                               |
| ----------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `label.show`      | `true`          | Show/hide labels.                                                                                         |
| `label.attribute` | `friendly_name` | Field/attribute for label. Default: `friendly_name` (entities) or `label` (JSON).                         |
| `label.replace`   |                 | Regex to clean labels. Format: `pattern/replacement/flags`. Example: `^Wiser //` removes "Wiser " prefix. |
| `label.prefix`    |                 | Text before label.                                                                                        |
| `label.suffix`    |                 | Text after label.                                                                                         |
| `label.style`     |                 | CSS for labels.                                                                                           |

### Value

| Option            | Default | Description                                                                                                                                  |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `value.show`      | `true`  | Show/hide values.                                                                                                                            |
| `value.attribute` | `state` | Field/attribute for value. Default: `state` (entities) or `value` (JSON). Climate: `current_temperature`, `temperature`, `temp_offset`, etc. |
| `value.prefix`    |         | Text before value.                                                                                                                           |
| `value.suffix`    |         | Text after value. Example: `°C`, `%`.                                                                                                        |
| `value.style`     |         | CSS for values.                                                                                                                              |

### Size

| Option           | Default                   | Description                                                                                                     |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `size.attribute` | same as `value.attribute` | Field/attribute for sizing. For climate: `temp_difference` works well with `inverse: true`.                     |
| `size.equal`     | `false`                   | All rectangles same size.                                                                                       |
| `size.inverse`   | `false`                   | Low values get bigger rectangles.                                                                               |
| `size.min`       | auto                      | Minimum size floor in entity units (e.g., `5` for 5W or 5°C). Ensures zero-value items visible. `0` hides them. |
| `size.max`       |                           | Maximum size cap in entity units (e.g., `500` for 500W). Prevents outliers from dominating the layout.          |

### Color

| Option                | Default                   | Description                                                                          |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `color.low`           | `#b91c1c` (red)           | Color for lowest values. Also used for off lights.                                   |
| `color.mid`           |                           | Optional middle color. Creates three-color gradient: low → mid → high.               |
| `color.high`          | `#16a34a` (green)         | Color for highest values.                                                            |
| `color.opacity`       | `1`                       | Color opacity (0-1).                                                                 |
| `color.attribute`     | same as `value.attribute` | Field/attribute for coloring. For climate: `temp_offset`, `hvac_action`.             |
| `color.scale.neutral` |                           | Value where `mid` color appears. Example: `0` for profit/loss, `21` for temperature. |
| `color.scale.min`     | auto                      | Values at or below get full `low` color.                                             |
| `color.scale.max`     | auto                      | Values at or above get full `high` color.                                            |
| `color.hvac.heating`  | `#ff6b35`                 | Color when actively heating (climate only).                                          |
| `color.hvac.cooling`  | `#4dabf7`                 | Color when actively cooling (climate only).                                          |
| `color.hvac.idle`     |                           | Not used - idle falls back to gradient.                                              |
| `color.hvac.off`      | `#868e96`                 | Color for off/unavailable climate entities.                                          |

### Icon

| Option           | Default | Description                                            |
| ---------------- | ------- | ------------------------------------------------------ |
| `icon.show`      | `true`  | Show/hide icons.                                       |
| `icon.icon`      |         | Static icon for all items. Example: `mdi:thermometer`. |
| `icon.attribute` | `icon`  | Field/attribute containing icon.                       |
| `icon.style`     |         | CSS for icons.                                         |

### Order & Filter

| Option         | Default | Description                                                   |
| -------------- | ------- | ------------------------------------------------------------- |
| `order`        | `desc`  | Sort order: `desc` (largest first) or `asc` (smallest first). |
| `limit`        |         | Maximum items to show.                                        |
| `filter.above` |         | Only show items with value greater than this.                 |
| `filter.below` |         | Only show items with value less than this.                    |

### Layout

| Option   | Default | Description                                                                 |
| -------- | ------- | --------------------------------------------------------------------------- |
| `height` | auto    | Card height in pixels. Auto-calculates based on row count (~100px per row). |
| `gap`    | `6`     | Space between rectangles in pixels.                                         |

### Title & Header guide

Two ways to add a title - use one or the other, not both:

**`title`** - Uses Home Assistant's built-in card header. Consistent with other HA cards, but no customization options.

```yaml
title: Humidity
```

**`header`** - Custom compact header with full styling control. Takes less vertical space than HA's default.

```yaml
header:
  title: Humidity
  style: |
    font-size: 14px;
    padding: 4px 16px;
```

If both are set, `header.title` takes precedence and `title` is ignored.

### Styling guide

Customize the appearance with inline CSS. All style options accept multiline YAML strings.

```yaml
header:
  title: My Treemap
  style: |
    font-size: 20px;
    color: red;
label:
  style: |
    text-shadow: 0 0 10px rgba(0,0,0,0.5);
value:
  style: |
    font-size: 18px;
    font-weight: bold;
icon:
  style: |
    opacity: 0.8;
card_style: |
  background: transparent;
```

<table width="100%">
<tr><th>Option</th><th>Description</th></tr>
<tr><td><code>header.show</code></td><td>Show or hide custom header. Default: <code>true</code> if <code>header.title</code> is set.</td></tr>
<tr><td><code>header.title</code></td><td>Custom header text. More compact than HA's default <code>title</code>.</td></tr>
<tr><td><code>header.style</code></td><td>CSS for the custom header. Example: <code>font-size: 14px; padding: 4px 16px;</code></td></tr>
<tr><td><code>label.style</code></td><td>CSS for labels. Example: <code>text-shadow: 0 0 10px rgba(0,0,0,0.3);</code></td></tr>
<tr><td><code>value.style</code></td><td>CSS for values. Example: <code>font-size: 18px;</code></td></tr>
<tr><td><code>icon.style</code></td><td>CSS for icons. Example: <code>color: white; opacity: 0.8;</code></td></tr>
<tr><td><code>card_style</code></td><td>CSS for the entire card. Example: <code>background: transparent;</code></td></tr>
</table>

## Sparkline

Each rectangle can display a mini chart showing historical data.

<p align="center">
  <br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/radiators-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/radiators.png">
    <img alt="Radiator sensors with sparklines" src="https://raw.githubusercontent.com/omachala/ha-treemap-card/master/docs/images/radiators.png">
  </picture>
  <br><br>
</p>

**Entities mode:** Uses Home Assistant's long-term statistics (most numeric sensors).

```yaml
type: custom:treemap-card
entities:
  - sensor.temperature_*
sparkline:
  period: 24h
```

**JSON mode:** Uses data array from each item's attribute.

```yaml
type: custom:treemap-card
entity: sensor.portfolio
data_attribute: holdings
sparkline:
  attribute: history
```

### Sparkline Options

| Option                 | Default | Description                                                       |
| ---------------------- | ------- | ----------------------------------------------------------------- |
| `sparkline.show`       | `true`  | Show/hide sparklines.                                             |
| `sparkline.attribute`  |         | Field containing sparkline data array (JSON mode).                |
| `sparkline.period`     | `24h`   | Time period for entity history: `12h`, `24h`, `7d`, or `30d`.     |
| `sparkline.mode`       | `dark`  | Color mode: `dark` (dark line/fill) or `light` (light line/fill). |
| `sparkline.line.show`  | `true`  | Show/hide the line.                                               |
| `sparkline.line.style` |         | Custom CSS for line (SVG properties).                             |
| `sparkline.fill.show`  | `true`  | Show/hide the filled area under the line.                         |
| `sparkline.fill.style` |         | Custom CSS for fill (SVG properties).                             |

### Period Details

| Period | Time Range | Data Points | Best For             |
| ------ | ---------- | ----------- | -------------------- |
| `12h`  | 12 hours   | ~144        | Detailed recent view |
| `24h`  | 24 hours   | ~24         | Daily overview       |
| `7d`   | 7 days     | ~168        | Weekly trends        |
| `30d`  | 30 days    | ~30         | Monthly trends       |

### Custom Styling Examples

**Red line, no fill:**

```yaml
sparkline:
  fill:
    show: false
  line:
    style: |
      stroke: rgba(255, 0, 0, 0.5);
      stroke-width: 2;
```

**Thick white line with light fill:**

```yaml
sparkline:
  mode: light
  line:
    style: |
      stroke: rgba(255, 255, 255, 0.8);
      stroke-width: 3;
  fill:
    style: |
      fill: rgba(255, 255, 255, 0.2);
```

**Fill only, no line:**

```yaml
sparkline:
  line:
    show: false
  fill:
    style: |
      fill: rgba(0, 0, 0, 0.3);
```

> **Note:** Sparklines only appear for entities that have long-term statistics in Home Assistant. Climate entities typically don't have statistics, but their associated temperature sensors do.

## Size & Order guide

> **Tip:** You may often prefer `size.equal: true` for a clean, uniform grid layout.

Below are common sizing and ordering configurations to achieve different visual effects:

| What you want                                     | Configuration                        |
| ------------------------------------------------- | ------------------------------------ |
| Biggest values = biggest rectangles, shown first  | `order: desc` (default)              |
| Biggest values = biggest rectangles, shown last   | `order: asc`                         |
| Smallest values = biggest rectangles, shown first | `order: desc` + `size.inverse: true` |
| Smallest values = biggest rectangles, shown last  | `order: asc` + `size.inverse: true`  |
| All rectangles same size                          | `size.equal: true`                   |
| Hide zero-value items                             | `size.min: 0`                        |
| Tame outliers (e.g., cap 1000W at 100W)           | `size.max: 100`                      |
| Boost small items (e.g., 0-5 become 10)           | `size.min: 10`                       |

> **Note:** `size.min` and `size.max` use the same units as your entity values, not percentages of the layout.
>
> Example with valve sensors (0-100%):
>
> - Valve A: 75%, Valve B: 50%, Valve C: 0%, Valve D: 0%
> - **Default behavior:** Zero-value valves automatically get a small minimum size so they're visible
> - `size.min: 10` - All valves below 10% are treated as 10% for sizing
> - `size.min: 0` - Zero-value valves are hidden (no rectangle area)
>
> Example with power sensors (0-3000W):
>
> - One device at 2500W dominates the layout, others at 50-200W are tiny
> - `size.max: 500` - Caps the 2500W device to 500W for sizing, giving other devices more visible space

## Contribution & License

- Contributions welcome - issues, PRs, or just feedback.
- MIT licensed.
- No "buy me a coffee" here - I make my own ☕. But a ⭐ would be nice!
