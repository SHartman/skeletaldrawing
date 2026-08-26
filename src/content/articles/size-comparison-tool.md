---
title: Size comparison tool
kind: Interactive tool
summary: Pick any two to five extinct animals and see them drawn to a single scale, tails aligned and feet on a common ground line, with a human for reference. Every silhouette is measured from the reconstructions used across the site.
path: /compare/
order: 1
featured: true
draft: false
---

This entry exists to give the size-comparison tool a home on the Learn hub. `path` points the card at
`/compare/`, so the article route skips it and no separate page is generated — the same arrangement
the anatomy guide uses.

Its visibility rides `COMPARE_LIVE` in `src/lib/flags.mjs` along with every other entry point, so the
tool cannot end up half-launched. Nothing below the front matter is rendered anywhere.
