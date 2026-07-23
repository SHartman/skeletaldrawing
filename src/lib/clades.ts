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

  // ── Ornithischia (bird-hipped dinosaurs) — backbone for the ornithischians gallery ──
  // Basal taxa whose position is unstable (Pisanosaurus, Lesothosaurus, Laquintasaura, Eocursor)
  // are authored as bare `Ornithischia` and simply sit at the root.
  Heterodontosauridae: 'Ornithischia',
  Thyreophora: 'Ornithischia',
  Stegosauria: 'Thyreophora',
  Huayangosauridae: 'Stegosauria',
  Stegosauridae: 'Stegosauria',
  Ankylosauria: 'Thyreophora',
  Polacanthidae: 'Ankylosauria',
  Nodosauridae: 'Ankylosauria',
  Ankylosauridae: 'Ankylosauria',
  Neornithischia: 'Ornithischia',
  Thescelosauridae: 'Neornithischia',
  Ornithopoda: 'Neornithischia',
  Iguanodontia: 'Ornithopoda',
  Rhabdodontidae: 'Iguanodontia',
  Hadrosauroidea: 'Iguanodontia',
  Hadrosauridae: 'Hadrosauroidea',
  Saurolophinae: 'Hadrosauridae',
  Lambeosaurinae: 'Hadrosauridae',
  Marginocephalia: 'Neornithischia',
  Pachycephalosauria: 'Marginocephalia',
  Pachycephalosauridae: 'Pachycephalosauria',
  Ceratopsia: 'Marginocephalia',
  Psittacosauridae: 'Ceratopsia',
  Neoceratopsia: 'Ceratopsia',
  Protoceratopsidae: 'Neoceratopsia',
  Leptoceratopsidae: 'Neoceratopsia',
  Ceratopsidae: 'Neoceratopsia',
  Centrosaurinae: 'Ceratopsidae',
  Chasmosaurinae: 'Ceratopsidae',

  // ── Synapsida (mammals and their forerunners) — backbone for the synapsids gallery ──
  // Cetacea is nested inside Artiodactyla (whales are artiodactyls — the Cetartiodactyla result).
  // Fruitafossor is authored as bare `Mammalia`; its position among early mammals is unsettled.
  Eupelycosauria: 'Synapsida',
  Edaphosauridae: 'Eupelycosauria',
  Sphenacodontia: 'Eupelycosauria',
  Sphenacodontidae: 'Sphenacodontia',
  Therapsida: 'Synapsida',
  Cynodontia: 'Therapsida',
  Mammaliaformes: 'Cynodontia',
  Mammalia: 'Mammaliaformes',
  Monotremata: 'Mammalia',
  Theria: 'Mammalia',
  Metatheria: 'Theria',
  Eutheria: 'Theria',
  Placentalia: 'Eutheria',
  Afrotheria: 'Placentalia',
  Macroscelidea: 'Afrotheria',
  Proboscidea: 'Afrotheria',
  Xenarthra: 'Placentalia',
  Cingulata: 'Xenarthra',
  Boreoeutheria: 'Placentalia',
  Laurasiatheria: 'Boreoeutheria',
  Carnivora: 'Laurasiatheria',
  Felidae: 'Carnivora',
  Perissodactyla: 'Laurasiatheria',
  Equidae: 'Perissodactyla',
  Artiodactyla: 'Laurasiatheria',
  Camelidae: 'Artiodactyla',
  Tayassuidae: 'Artiodactyla',
  Bovidae: 'Artiodactyla',
  Cetacea: 'Artiodactyla',

  // ── Non-dinosaurs ── the "weirdo gallery": jawed vertebrates entire, rooted at Gnathostomata (the
  // only clade all its members share). It is a GRADE, not a group — defined by exclusion — so the
  // backbone is deliberately long. Basal grades that are paraphyletic (e.g. "Placodermi") are skipped:
  // Arthrodira attaches straight to Gnathostomata rather than assert a non-clade parent.
  Arthrodira: 'Gnathostomata',                 // stem gnathostome (placoderm grade); Dunkleosteus
  Actinopterygii: 'Gnathostomata',
  Teleostei: 'Actinopterygii',
  Ichthyodectiformes: 'Teleostei',
  Ichthyodectidae: 'Ichthyodectiformes',
  // Tetrapoda here is the CROWN clade (Lissamphibia + Amniota and their last common ancestor) —
  // the owner's usage and the most common modern one. Stem taxa therefore hang off Tetrapodomorpha
  // OUTSIDE it: Ichthyostega is a stem tetrapod, not a tetrapod. (Sarcopterygii is still skipped;
  // Tetrapodomorpha attaches straight to Gnathostomata until there's a reason to fill the gap.)
  Tetrapodomorpha: 'Gnathostomata',
  Ichthyostegidae: 'Tetrapodomorpha',
  Tetrapoda: 'Tetrapodomorpha',
  Lissamphibia: 'Tetrapoda',
  Anura: 'Lissamphibia',
  Amniota: 'Tetrapoda',
  Sauropsida: 'Amniota',                       // reptile line (Synapsida is its own gallery)
  // turtles — Pan-Testudines; internal turtle topology kept coarse
  Testudinata: 'Sauropsida',
  Paracryptodira: 'Testudinata',
  Baenidae: 'Paracryptodira',
  Pleurosternidae: 'Paracryptodira',
  Cryptodira: 'Testudinata',
  Trionychidae: 'Cryptodira',
  Adocidae: 'Cryptodira',
  Nanhsiungchelyidae: 'Cryptodira',
  Protostegidae: 'Cryptodira',                 // sea turtles; exact placement debated
  // lepidosaurs
  Lepidosauria: 'Sauropsida',
  Squamata: 'Lepidosauria',
  Dolichosauridae: 'Squamata',                 // marine squamates near mosasaurs
  Mosasauridae: 'Squamata',                    // mosasaurs (Tylosaurus); owner has more in the pipeline
  // sauropterygians — plesiosaurs. Position within Sauropsida is unsettled; attached broadly here,
  // like the ichthyosaurs below. Rhomaleosaurids and elasmosaurids are both nested under Plesiosauria
  // (sensu lato) — a coarse but defensible split for two taxa; refine if the branch fills out.
  Sauropterygia: 'Sauropsida',
  Plesiosauria: 'Sauropterygia',
  Rhomaleosauridae: 'Plesiosauria',
  Elasmosauridae: 'Plesiosauria',
  // ichthyosaurs — position within Sauropsida uncertain; attached broadly
  Ichthyosauria: 'Sauropsida',
  Ichthyosauridae: 'Ichthyosauria',
  Stenopterygiidae: 'Ichthyosauria',
  Ophthalmosauridae: 'Ichthyosauria',
  // archosauromorphs → the archosaur radiation
  Archosauromorpha: 'Sauropsida',
  Archosauria: 'Archosauromorpha',
  // ── croc line ──
  Pseudosuchia: 'Archosauria',
  Parasuchidae: 'Pseudosuchia',                // phytosaurs as basal pseudosuchians (owner's tentative call)
  Stagonolepididae: 'Pseudosuchia',            // aetosaurs
  Poposauroidea: 'Pseudosuchia',
  Rauisuchidae: 'Pseudosuchia',
  Crocodylomorpha: 'Pseudosuchia',
  Thalattosuchia: 'Crocodylomorpha',
  Teleosauridae: 'Thalattosuchia',
  Notosuchia: 'Crocodylomorpha',
  Mahajangasuchidae: 'Notosuchia',
  Neosuchia: 'Crocodylomorpha',
  Goniopholididae: 'Neosuchia',
  Crocodylia: 'Neosuchia',
  Alligatoroidea: 'Crocodylia',
  Alligatoridae: 'Alligatoroidea',
  Caimaninae: 'Alligatoridae',
  // ── bird line (non-dinosaurian avemetatarsalians) ──
  Avemetatarsalia: 'Archosauria',
  Aphanosauria: 'Avemetatarsalia',
  Ornithodira: 'Avemetatarsalia',
  Pterosauromorpha: 'Ornithodira',
  Pterosauria: 'Pterosauromorpha',
  Rhamphorhynchidae: 'Pterosauria',
  Pterodactyloidea: 'Pterosauria',
  Pteranodontidae: 'Pterodactyloidea',
  Azhdarchoidea: 'Pterodactyloidea',
  Tapejaridae: 'Azhdarchoidea',
  Azhdarchidae: 'Azhdarchoidea',
  Dinosauromorpha: 'Ornithodira',
  Lagerpetidae: 'Dinosauromorpha',
  Dinosauriformes: 'Dinosauromorpha',          // Marasuchus sits here; Dinosauria (other galleries) would too
  Silesauridae: 'Dinosauriformes',
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
  // ── Ornithischia ──
  'Ornithischia', 'Heterodontosauridae', 'Thyreophora', 'Stegosauria', 'Ankylosauria',
  'Neornithischia', 'Thescelosauridae', 'Ornithopoda', 'Iguanodontia', 'Hadrosauridae',
  'Saurolophinae', 'Lambeosaurinae', 'Marginocephalia', 'Pachycephalosauria', 'Ceratopsia',
  'Neoceratopsia', 'Leptoceratopsidae', 'Ceratopsidae', 'Centrosaurinae', 'Chasmosaurinae',
  // ── Synapsida ── (backbone waypoints like Theria/Eutheria/Boreoeutheria stay off the chip pool)
  'Synapsida', 'Eupelycosauria', 'Edaphosauridae', 'Sphenacodontidae', 'Therapsida', 'Mammalia',
  'Monotremata', 'Metatheria', 'Placentalia', 'Afrotheria', 'Macroscelidea', 'Proboscidea',
  'Xenarthra', 'Cingulata', 'Laurasiatheria', 'Carnivora', 'Felidae', 'Perissodactyla', 'Equidae',
  'Artiodactyla', 'Camelidae', 'Tayassuidae', 'Bovidae', 'Cetacea',
  // ── Non-dinosaurs ── (broad recognizable nodes + the clades with ≥2 taxa; singletons stay off the
  // chip pool but still render as a taxon's own terminal and in its lineage)
  // NB Tetrapodomorpha is deliberately absent: it exists in PARENT purely to hold the crown-Tetrapoda
  // boundary honest, and its only non-tetrapod member is Ichthyostega. Making it a chip would add a
  // step to the Gnathostomata → Tetrapoda → Amniota ladder — already the longest backbone on the
  // site — for one taxon. Promote it here (one word) if the stem ever fattens up.
  // Plesiosauria is a chip (2 taxa: Rhomaleosaurus + Thalassomedon). Mosasauridae stays off for now —
  // a singleton (Tylosaurus) held under Squamata until the owner's pipeline mosasaurs land.
  'Gnathostomata', 'Actinopterygii', 'Ichthyodectidae', 'Tetrapoda', 'Amniota', 'Sauropsida',
  'Testudinata', 'Cryptodira', 'Baenidae', 'Trionychidae', 'Ichthyosauria', 'Plesiosauria', 'Squamata',
  'Archosauromorpha', 'Archosauria', 'Pseudosuchia', 'Crocodylomorpha', 'Notosuchia', 'Neosuchia',
  'Crocodylia', 'Alligatoroidea', 'Alligatoridae', 'Avemetatarsalia', 'Pterosauria', 'Pterodactyloidea',
  'Azhdarchoidea', 'Azhdarchidae', 'Silesauridae',
]);

/**
 * Clades that belong in a taxon's displayed LINEAGE but not in the gallery chip pool. The two
 * lists almost always coincide, so they were one list until Tetrapodomorpha forced them apart —
 * they answer different questions: LANDMARKS asks "is this worth a click?", this asks "would the
 * ladder mislead without it?".
 *
 * Tetrapodomorpha has to exist in PARENT to keep Tetrapoda a crown clade, and Ichthyostega is its
 * only non-tetrapod member. As a chip it would cost every visitor an extra step down the site's
 * longest backbone — and put an unfamiliar word where "Tetrapoda" currently greets them — for one
 * taxon. Left out entirely, though, Ichthyostega's ladder jumps from Gnathostomata straight to
 * Ichthyostegidae, skipping the very fact its description leads with ("a Late Devonian stem
 * tetrapod"). It earns a rung on the page without earning a chip in the gallery.
 */
const LADDER_EXTRA: ReadonlySet<string> = new Set(['Tetrapodomorpha']);

/**
 * A landmark is "popular" — eligible to surface as a jump chip from a distant ancestor, rather
 * than only when you've drilled down to its immediate parent — once its subtree holds at least
 * this many taxa. Tunable; started at 6.
 */
export const POPULAR_MIN = 6;

/** Whether a clade is a curated navigation landmark. */
export const isLandmark = (clade: string): boolean => LANDMARKS.has(clade);

/**
 * The clade chain to display on a taxon/specimen page: the landmark ancestors PLUS the taxon's
 * own most-specific clade (always kept, even if it isn't a landmark, so the terminal isn't lost).
 * Root→specific. This prunes the full lineage down to a short, readable indented ladder instead
 * of the entire ancestry, using the same curated names as the gallery chips.
 */
export function cladeLadder(authored: string[]): string[] {
  const path = expandClades(authored);
  const terminal = path.at(-1);
  // A LADDER_EXTRA rung is a STAND-IN, so it earns its place only when nothing more specific
  // already occupies it: drop it the moment a landmark appears below it in the lineage. That is
  // what puts Tetrapodomorpha on Ichthyostega's page and keeps it off every other tetrapod's,
  // where Tetrapoda sits one rung down and says it better.
  return path.filter(
    (c, i) =>
      LANDMARKS.has(c) ||
      c === terminal ||
      (LADDER_EXTRA.has(c) && !path.slice(i + 1).some((below) => LANDMARKS.has(below))),
  );
}
