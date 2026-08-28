---
title: Size comparison tool
kind: Interactive tool
summary: Pick one to five animals and see how big they were, drawn to a single scale with a 1.8 m human for reference. Every animal on the site is available, with more added all the time.
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
