---
'ha-treemap-card': patch
---

Sparklines now support fixed Y-axis bounds via `sparkline.min` and `sparkline.max`. Useful when sensor values change only slightly — instead of a flat line filling the full chart, you can set `min: 0` and `max: 100` to show the actual position within a meaningful range.
