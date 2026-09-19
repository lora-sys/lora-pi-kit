# lora-visual Golden Assets v0.3

## Decision

These eight assets are frozen as the first Mode B golden set after deterministic alpha normalization and 7% safe-padding standardization.

| Asset | Programmatic | Visual review |
|---|---|---|
| `lora-thinking` | PASS | ACCEPT — closest to canonical thinking pose; face, bun, clip, hoodie and cargo language are stable. |
| `lora-writing` | PASS | ACCEPT — canonical identity holds; slightly cleaner/younger rendering but still inside v1. |
| `lora-pointing` | PASS | ACCEPT — useful full-body explainer pose; keep as the default pointing silhouette. |
| `lora-laptop` | PASS | ACCEPT — strong creator pose and reusable laptop asset; character identity remains recognizable. |
| `mochi-sitting` | PASS | ACCEPT WITH WATCH — useful canonical sitting pose; future generations should not make the fur curlier or more poodle-like. |
| `mochi-lying` | PASS | ACCEPT — strong low horizontal silhouette; good companion/background anchor. |
| `lora-mochi-study` | PASS | ACCEPT — strong relationship asset; intentionally prop-rich, so use as a scene fragment rather than a generic character sticker. |
| `lora-mochi-celebrate` | PASS | ACCEPT — expressive success/launch asset; also prop-rich, suitable for launch/finish moments. |

## Hard gates applied

- final format is RGBA PNG
- all four corner alpha values are 0
- minimum safe padding is approximately 7% on every side
- near-opaque alpha values are normalized to 255
- at least 70% of visible pixels must be fully opaque
- no regeneration or visual redesign was used during this cleanup

## Character watch list

- Keep the blank amber hair clip visible when the angle allows. It must contain no letters or symbols.
- Keep lora's loose high messy bun and face-framing strands.
- Keep the cream oversized hoodie + dark loose cargo identity as the default.
- Mochi must remain a warm-cream fictional fluffy dog with floppy ears; do not drift into strongly curly poodle/bichon styling.

## Proofs

- `proofs/golden-proof-white.jpg`
- `proofs/golden-proof-amber.jpg`
- `proofs/golden-proof-charcoal.jpg`
