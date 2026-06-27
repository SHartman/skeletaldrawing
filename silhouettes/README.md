# Silhouette sources

Transparent-background body silhouettes, used **only** as trace sources for the
scale-comparison overlays. They are not served to the browser — the tracer
(`scripts/silhouette.mjs`) reads them and writes vector paths to
`src/data/silhouettes.json`, which is what the site actually renders.

When a silhouette here matches an entry, the tracer prefers it over auto-tracing
the known-material raster (cleaner, and it skips the morphological-close step).

## How to make one

- **Left lateral, head to the left** (matches the skeletals).
- **Solid fill, any single color; everything else transparent** (alpha = the body).
- **Body envelope only** — no scale bar, no credit, no bones.
- Tail tip is the **right-most** point; feet are the **lowest** point (that's how
  the overlay aligns them).
- ~1000–1500 px wide is plenty; PNG with alpha.

## Naming

`<entry-slug>-silhouette.png`, where the slug is the taxon or specimen page slug:

- `diplodocus-carnegii-silhouette.png`
- `diplodocus-hallorum-ummnh-3690-silhouette.png`   ← see catalog note below
- `diplodocus-hallorum-amnh-223-silhouette.png`

> Catalog note: the UMMNH-vs-NMMNH question (below) decides the third filename —
> if it's NMMNH, name it `diplodocus-hallorum-nmmnh-3690-silhouette.png`. Hold
> that one until confirmed; the other two are final.

After dropping files here, re-run `node scripts/silhouette.mjs`.
