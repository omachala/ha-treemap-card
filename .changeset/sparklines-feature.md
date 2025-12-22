---
'ha-treemap-card': minor
---

Sparklines are here! Each rectangle now shows a mini chart of historical data.

- **Enabled by default** - to disable, add `sparkline.show: false` to your config
- Configurable time periods: `12h`, `24h` (default), `7d`, or `30d`
- Works with entity sensors (uses HA long-term statistics) and JSON mode (uses data array from attribute)
- Fully customizable line and fill styles via CSS
- **Climate entities**: Shows temperature history with HVAC action bars (heating/cooling periods displayed at the bottom)

Major performance overhaul - the card is now industry-grade:

- Render multiple cards with hundreds of rectangles without breaking a sweat
- Runs smoothly on low-end devices like Raspberry Pi
- Added performance regression tests to keep the bar high

Other improvements:

- Icons now adapt to background color for better readability (same as labels)
- Config cleanup: use `attribute` everywhere (old `param` still works)
