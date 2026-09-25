# Freshfield Magnesium Reality Check

Standalone, single-file presentation page for CHFA Now Toronto. The calculator markup and calculation script were copied from the live Freshfield Magnesium Bisglycinate Canada PDP on 2026-09-25. The original `lp-base.css` and `lp-calculator.css` were embedded, along with the Freshfield display font. Tablet-specific spacing and touch-target rules are additive.

- Entry point: `index.html` (works offline, no external runtime dependencies)
- Original: https://freshfield.life/products/magnesium-bisglycinate-ca#reality-check
- Input is elemental magnesium **per capsule**.
- Capsule capacities and filler headroom are approximate; the verdict follows the PDP's existing logic and is not laboratory verification of a competitor's formula.

For future updates, copy any changed calculator markup/script/CSS from the PDP and retest all four verdicts. The local `build.py` used for this event embeds the copied source and is intentionally not published.
