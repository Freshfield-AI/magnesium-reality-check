# Freshfield Magnesium | CHFA NOW Toronto

A standalone retailer presentation page, derived from Freshfield's Magnesium Bisglycinate PDP calculator. It is **not** a Shopify page. The iPad presentation leads with Freshfield's product and brand story, then offers an educational label-math estimate and a seller-led opening-order prompt.

- `template.html` is the editable source. `python3 build.py` embeds the official Freshfield white/teal logo, Freshfield display font and an existing Freshfield outdoor photo into `index.html`. This makes the HTML self-contained.
- `sw.js` caches the page after its first online visit, enabling an offline revisit. Test on the actual iPad in Airplane Mode before the event.
- Calculator assumptions: theoretical anhydrous percentages (bisglycinate 14.1%, citrate 16%, oxide 60%); capsule volumes 0.68, 0.90, 1.37 mL for sizes 0, 00, 000; illustrative powder-density range 0.6–1.0 g/mL from the linked [capsule size chart](https://www.lfacapsulefillers.com/capsule-size-chart). These are **not** tests of a competing product's purity, absorption, or ingredients.
- Freshfield example: 60.5 mg elemental per capsule, size 00, as in the approved internal formula. The page does **not** publish proprietary formula weights or actual supplier assay.
- Source: the Magnesium Bisglycinate Canada PDP calculator as observed on 2026-09-25. The PDP itself is not changed by this repo.

Do not use an old PDP bottle mockup as a hero asset until its NPN artwork is checked against the live licence. The current page instead embeds Freshfield's own outdoor photo. Internal formulation and claim-audit notes stay outside this public repository.
