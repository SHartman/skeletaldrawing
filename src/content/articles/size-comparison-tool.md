---
title: Size comparison tool
kind: Interactive tool
summary: Wonder how big (or small) your favorite extinct animals were? Try this tool to select 1–5 animals, and see them compared to each other and people for scale. More animals are added all the time.
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
