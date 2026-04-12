---
'ha-treemap-card': patch
---

Each entity can now have its own fixed color. Useful for category dashboards where you want consistent colors across multiple cards.

```yaml
entities:
  - entity: sensor.cost_lights
    color: '#F68C00'
    name: Lighting
  - entity: sensor.cost_heating
    color: '#B40404'
    name: Heating
```
