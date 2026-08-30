# Catalog-only silhouettes

Animals the **size-comparison tool** should be able to draw that should *not* get a page of their own.

A taxon entry builds a skeletal page, lands in a gallery, and counts toward "N reconstructions".
That is right for a reconstruction and wrong for a modern elephant, a second human figure, or a
single vertebra's worth of a giant. Those live here instead: same catalog, no page, no gallery, no
effect on any count.

Typical entries:

- **Extant animals** — an elephant, a blue whale calf, a horse. Useful on their own and needed
  anyway for the mass-estimation work.
- **Extra human figures** — "Child, 1.2 m", "Adult, 1.6 m". The tool already draws a default adult
  and child; these are for a visitor who wants a specific one *as one of their five picks*.
- **Ontogenetic stages** with nowhere else to live. If the taxon has a real growth series, use
  `growthStages` on the taxon instead — that gets the overlay and the measurements table too.
- **One-off specimens** too fragmentary or too incidental for a specimen page.

## Adding one

1. Put the silhouette PNG in `/silhouettes` (transparent background, the same way the other
   silhouette files are made — not a white-background skeletal).
2. Add a `.md` file here. The filename is the catalog id and must be unique across *every* taxon,
   specimen and genus slug; the tracer refuses the entry and says so if it collides.

```yaml
---
label: Loxodonta africana          # exactly what the legend shows
taxon: Loxodonta africana          # the italic part; omit for "Child, 1.2 m"
lengthM: 6.5                       # biological length — the number in the legend
widthM: 6.1                        # horizontal extent if the pose differs; omit if the same
silhouette: loxodonta-africana-silhouette.png
---

Anything below the front matter is a note to yourself. Nothing renders it.
```

`gallery` and `clade` are optional filter facets. Leave them off for anything that has no home in
the site's galleries — the entry is still reachable by search, which is how a visitor looks for an
elephant anyway. Inventing a "modern animals" gallery here would put a chip on the tool that
corresponds to nothing anywhere else on the site.

`draft: true` hides an entry completely — the tracer skips it, so it never reaches the tool.

3. Re-run the tracer: `node scripts/silhouette.mjs`. It reports each entry it picks up, and refuses
   loudly (without failing the build) on a missing file, a missing `lengthM`, or a colliding id.

## The empty-collection warning

While this folder holds nothing but the README, every build prints:

```
[WARN] [glob-loader] No files found matching "**/*.md,!README.md" in directory "src/content/silhouettes"
```

That is Astro noting an empty collection, not a fault, and it disappears with the first entry.

## What lives where

Only **geometry** goes into `src/data/silhouettes.json`. The label, the italic span and the facets
are read from this collection by `/compare/` at build time, so fixing a name is an edit here — not a
re-trace.
