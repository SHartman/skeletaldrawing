/**
 * Cladistic nesting for the galleries (CLAUDE.md §5 faceted filtering).
 *
 * Each taxon's `clade` field holds only its MOST SPECIFIC clade(s); the full ancestry is
 * derived here from a parent map. That way a filter on a broad clade (e.g. Macronaria) catches
 * everything nested within it (titanosaurs included), every page can render a consistent and
 * complete lineage, and adding a taxon means typing one clade, not a hand-maintained path that
 * silently drifts. Update the map on the rare occasion consensus actually moves.
 *
 * The topology is a mainstream consensus; a few debated nodes are simplified (e.g. exact
 * placement of Lognkosauria/Saltasauridae, Coelophysoidea mono/paraphyly, avialan internal
 * order). It's meant to be vetted and edited by the maintainer — it's just data.
 */

// child clade -> immediate parent. Roots (Sauropodomorpha, Theropoda) are absent (no parent).
const PARENT: Record<string, string> = {
  // ── Sauropodomorpha ────────────────────────────────────────────────────
  // basal (non-sauropod) sauropodomorphs hang directly off the root:
  Plateosauridae: 'Sauropodomorpha',
  Riojasauridae: 'Sauropodomorpha',
  Massospondylidae: 'Sauropodomorpha',
  Melanorosauridae: 'Sauropodomorpha',
  Anchisauria: 'Sauropodomorpha',
  Sauropoda: 'Sauropodomorpha',
  Eusauropoda: 'Sauropoda',
  Mamenchisauridae: 'Eusauropoda',
  Neosauropoda: 'Eusauropoda',
  Diplodocoidea: 'Neosauropoda',
  Rebbachisauridae: 'Diplodocoidea',
  Dicraeosauridae: 'Diplodocoidea',
  Diplodocidae: 'Diplodocoidea',
  Apatosaurinae: 'Diplodocidae',
  Diplodocinae: 'Diplodocidae',
  Macronaria: 'Neosauropoda',
  Camarasauridae: 'Macronaria',
  Titanosauriformes: 'Macronaria',
  Brachiosauridae: 'Titanosauriformes',
  Somphospondyli: 'Titanosauriformes',
  Titanosauria: 'Somphospondyli',
  Lognkosauria: 'Titanosauria',
  Saltasauridae: 'Titanosauria',

  // ── Theropoda (backbone — extend with families as theropod entries land) ──
  Neotheropoda: 'Theropoda',
  Coelophysoidea: 'Neotheropoda',
  Averostra: 'Neotheropoda',
  Ceratosauria: 'Averostra',
  Abelisauroidea: 'Ceratosauria',
  Abelisauridae: 'Abelisauroidea',
  Tetanurae: 'Averostra',
  Megalosauroidea: 'Tetanurae',
  Spinosauridae: 'Megalosauroidea',
  Avetheropoda: 'Tetanurae',
  Allosauroidea: 'Avetheropoda',
  Carcharodontosauridae: 'Allosauroidea',
  Coelurosauria: 'Avetheropoda',
  Compsognathidae: 'Coelurosauria',
  Tyrannosauroidea: 'Coelurosauria',
  Tyrannosauridae: 'Tyrannosauroidea',
  Maniraptoriformes: 'Coelurosauria',
  Ornithomimosauria: 'Maniraptoriformes',
  Maniraptora: 'Maniraptoriformes',
  Therizinosauria: 'Maniraptora',
  Oviraptorosauria: 'Maniraptora',
  Paraves: 'Maniraptora',
  Dromaeosauridae: 'Paraves',
  Troodontidae: 'Paraves',
  Avialae: 'Paraves',

  // families/clades used by the theropod gallery (A–K batch):
  Allosauridae: 'Allosauroidea',
  Megalosauridae: 'Megalosauroidea',
  Ornithomimidae: 'Ornithomimosauria',
  // round-2 (L–Z) additions:
  Noasauridae: 'Abelisauroidea',
  Alvarezsauridae: 'Maniraptora',
  // Anchiornithids and scansoriopterygids are kept as BASAL PARAVES, not avialans: their position
  // is genuinely unsettled — recovered as troodontids or basal paravians as often as avialans over
  // the last decade — so we don't assert the avialan placement. Scansoriopterygids occasionally
  // fall below Paraves (as maniraptorans), but we stop at Paraves for now.
  Anchiornithidae: 'Paraves',
  Scansoriopterygidae: 'Paraves',
  // Avialae → bird internal topology. Still the busiest branch for consensus; vet against usage.
  Archaeopterygidae: 'Avialae',
  Pygostylia: 'Avialae',
  Avibrevicauda: 'Pygostylia',
  Ornithothoraces: 'Avibrevicauda',
  Enantiornithines: 'Ornithothoraces',
  Euornithes: 'Ornithothoraces',
  Ornithuromorpha: 'Euornithes',
  Aves: 'Ornithuromorpha',
};

/** Full ancestry of a single clade, root-first and inclusive of the clade itself. */
function ancestry(clade: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let c: string | undefined = clade;
  while (c && !seen.has(c)) {
    chain.unshift(c);
    seen.add(c);
    c = PARENT[c];
  }
  return chain;
}

/** Depth from the root (root = 1) — used to order an expanded set broad→specific. */
const depth = (clade: string): number => ancestry(clade).length;

/**
 * Expand a taxon's authored clade(s) into the full, de-duplicated lineage, ordered
 * broad→specific. Robust to either a single terminal clade or a longer hand-authored path; a
 * clade not in the map simply contributes itself (so nothing is lost — it just isn't nested
 * until added to PARENT).
 */
export function expandClades(authored: string[]): string[] {
  const set = new Set<string>();
  for (const a of authored) for (const node of ancestry(a)) set.add(node);
  return [...set].sort((a, b) => depth(a) - depth(b));
}

/**
 * Navigable "landmark" clades — the curated pool the gallery clade-nav draws its chips from.
 * Every OTHER clade still lives in PARENT for lineage, breadcrumb, and JSON-LD; it simply never
 * appears as a chip. This is an editorial layer on top of the topology (chips can skip
 * non-landmark waypoints like Avetheropoda or the thin post-Pygostylia bird chain). Curated with
 * the maintainer, 2026-07: population + recognizability, singletons generally held back until a
 * clade fattens up. Promoting a clade to a chip later is a one-line add here.
 */
export const LANDMARKS: ReadonlySet<string> = new Set([
  // ── Theropoda ──
  'Theropoda', 'Ceratosauria', 'Abelisauridae', 'Tetanurae', 'Megalosauroidea', 'Spinosauridae',
  'Allosauroidea', 'Allosauridae', 'Carcharodontosauridae', 'Coelurosauria', 'Tyrannosauroidea',
  'Tyrannosauridae', 'Compsognathidae', 'Maniraptoriformes', 'Ornithomimosauria', 'Maniraptora',
  'Therizinosauria', 'Oviraptorosauria', 'Paraves', 'Dromaeosauridae', 'Troodontidae',
  'Anchiornithidae', 'Avialae', 'Pygostylia', 'Aves', 'Enantiornithines',
  // ── Sauropodomorpha ──
  'Sauropodomorpha', 'Massospondylidae', 'Sauropoda', 'Neosauropoda', 'Diplodocoidea',
  'Diplodocidae', 'Macronaria', 'Brachiosauridae', 'Titanosauria', 'Lognkosauria',
]);

/**
 * A landmark is "popular" — eligible to surface as a jump chip from a distant ancestor, rather
 * than only when you've drilled down to its immediate parent — once its subtree holds at least
 * this many taxa. Tunable; started at 6.
 */
export const POPULAR_MIN = 6;

/** Whether a clade is a curated navigation landmark. */
export const isLandmark = (clade: string): boolean => LANDMARKS.has(clade);
