---
'ha-treemap-card': patch
---

Fixed negative values not sorting correctly. Previously, a value like `-400W` (e.g. solar generation) would sort between `1000W` and `200W` because sorting used the absolute value. Now `-400W` correctly sorts as the smallest value.
