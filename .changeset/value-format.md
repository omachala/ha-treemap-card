---
'ha-treemap-card': minor
---

Added configurable number formatting. The card now respects each entity's display precision setting from Home Assistant. You can also override with `value.format` - use `0` for whole numbers, `0.00` for 2 decimals, or `0.0a` for abbreviated values like 2.3k or 1.5M.
