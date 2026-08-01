# Genus hub copy

Editorial copy for the **synthetic genus hubs** at `/<gallery>/<genus>/`.

Those pages have no file of their own — `src/pages/[gallery]/[taxon].astro` conjures
one wherever a gallery + genus has **two or more taxa**. So there is nothing here to
create a page with; an entry only supplies the *words* for a hub that already exists.

## The filename is the key

`<genus-slug>.md`, where the slug is the lowercased genus — the same string the URL
uses. `Nanotyrannus` → `nanotyrannus.md`, reachable at `/theropods/nanotyrannus/`.

An entry whose genus has no hub does nothing. The build prints a warning naming it,
so a typo shows up rather than sitting silently unused.

## Fields, all optional

| Field | Falls back to |
|---|---|
| `intro` | the generated sentence in the header |
| `description` | a generated meta/OG description |
| body (the Markdown below the front matter) | nothing — the section isn't rendered |

`intro` replaces the lead paragraph next to the facts panel. The body renders **below**
the cards and the scale comparison, so added prose never pushes the images off the
first screen.

Underscores italicise in `intro` and `description` (`_Nanotyrannus_`), matching the
body prose and the rest of the site.

## Don't state counts

No "three species", no "five skeletals". The facts panel beside the intro derives
Skeletals shown / Species / Size range live from the entries, and a hard-coded number
goes stale the day another species is added. That is the whole reason the generated
sentence is being replaced — write about the animals, and let the panel do the
arithmetic.
