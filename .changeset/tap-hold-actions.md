---
'ha-treemap-card': minor
---

Tap and hold actions for tiles

You can now configure what happens when you tap or hold a tile:

```yaml
tap_action:
  action: more-info # default - open entity details
hold_action:
  action: navigate
  navigation_path: /lovelace/power-detail
```

Supported actions: `more-info`, `navigate`, `url`, `toggle`, `call-service`, `none`.

Per-entity overrides are also supported:

```yaml
entities:
  - entity: sensor.power_grid
    tap_action:
      action: navigate
      navigation_path: /lovelace/grid-detail
  - sensor.solar_*
```

Available in the visual editor under the new **Actions** section.
