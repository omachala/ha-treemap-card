---
'ha-treemap-card': patch
---

Fixed negative values producing incorrectly sized rectangles. Previously, a value like `-400W` would be sized the same as `+400W` (using absolute value), making it appear larger than `100W`. Now `-400W` correctly produces the smallest rectangle.
