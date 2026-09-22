---
'ha-treemap-card': minor
---

Sparklines can now plot a different entity than the tile itself — show the living room temperature with outdoor humidity underneath it, or total energy with live power. You can also pick which statistic the sparkline draws (mean, min, max, sum, state or change), which finally gives energy meters a sparkline at all - Home Assistant never records a mean for them, so they have always come up blank. Both work card-wide or per entity, just like `color` and `name` already do. The visual editor sets them for the whole card and never rewrites your per-entity YAML - including a long-standing bug where editing the entity list silently discarded per-entity settings.
