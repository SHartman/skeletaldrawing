import type { CollectionEntry } from 'astro:content';

/**
 * Single source of truth for a taxon's machine-readable identity. The same
 * functions feed the on-page record AND the JSON-LD, so the two can never
 * drift (CLAUDE.md §3 — the point of the rebuild). Pixels travel; this text
 * and schema establish the canonical source.
 */

type TaxonData = CollectionEntry<'taxa'>['data'];
type SpecimenData = CollectionEntry<'specimens'>['data'];

const AUTHOR = {
  '@type': 'Person',
  name: 'Scott Hartman',
  url: 'https://www.skeletaldrawing.com/about/',
} as const;

const LICENSE_DEFAULT = 'https://www.skeletaldrawing.com/licensing';
const CREDIT_DEFAULT = 'Skeletal reconstruction © Scott Hartman / skeletaldrawing.com';

/**
 * Launch gate for per-skeletal drawing dates. The data is complete and committed; this only decides
 * whether it SURFACES, in the record row and in ImageObject dateCreated/dateModified.
 *
 * It exists because the owner ships a feature as one announceable moment rather than letting it
 * trickle in, and this is meant to land with a blog post. Flip to true to launch — that is the whole
 * of it, and nothing else needs touching.
 */
export const SHOW_DRAWING_DATES = true;

/**
 * How a drawing's age reads in the record row: "2011, revised 2024" when the artwork was reworked,
 * a bare year when it wasn't.
 *
 * Both years are shown rather than just the current one because the pair is the interesting fact — it
 * says the work is long-standing AND still maintained, which one figure cannot. `updated` is dropped
 * when it equals `drawn`, since "2024, revised 2024" states nothing.
 */
export function formatDrawn(drawn?: number, updated?: number): string {
  if (drawn == null) return updated != null ? String(updated) : '';
  return updated != null && updated !== drawn ? `${drawn}, revised ${updated}` : String(drawn);
}

/** ISO years for ImageObject. Omitted entirely while the feature is gated. */
function dateProps(drawn?: number, updated?: number) {
  if (!SHOW_DRAWING_DATES) return {};
  return {
    ...(drawn != null ? { dateCreated: String(drawn) } : {}),
    ...(updated != null ? { dateModified: String(updated) } : {}),
  };
}

export interface SchemaContext {
  pageUrl: string; // absolute canonical URL of the page
  imageUrl: string; // absolute URL of the primary (hero) image
  rigorousUrl?: string; // absolute URL of the known-material image when shown separately
}

/**
 * Author citation for display. Per the ICZN, parentheses mean the species was moved
 * from the genus it was originally described in (a recombination) — e.g. "Diplodocus
 * hallorum (Gillette, 1991)" vs. the original combination "Tyrannosaurus rex Osborn,
 * 1905". The `recombination` flag is the single source of truth: the stored `author`
 * is the bare "Name, year", and we add the parens only when the flag is set. Any stray
 * parens typed into the field are stripped first, so the flag always wins.
 */
export function formatAuthor(author: string, recombination = false): string {
  const bare = author.trim().replace(/^\(\s*(.*?)\s*\)$/, '$1');
  return recombination ? `(${bare})` : bare;
}

/**
 * A taxon name as HTML: the binomial italicised, but an open-nomenclature qualifier
 * ("sp.", "spp.", "indet.") kept roman, per zoological convention (e.g. *Triceratops* sp.).
 * Use with `set:html`; the containing element must NOT itself force italics.
 */
export function taxonNameHtml(name: string): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const m = name.trim().match(/^(.+?)\s+(spp?\.|indet\.)$/);
  return m ? `<i>${esc(m[1])}</i> ${esc(m[2])}` : `<i>${esc(name)}</i>`;
}

/**
 * Emphasis markers for the short single-line fields authored as plain strings in the CMS — blog
 * excerpts and article summaries. Scientific names are italic everywhere else on the site and ought
 * to be here too; the catch is that these same fields feed `<meta name="description">`,
 * `og:description` and JSON-LD, where a tag would be shown to the reader as literal angle brackets.
 *
 * So the field is authored the way the body prose already is — `_Sphenacodon_` — and rendered two
 * ways: as `<em>` where a person reads it, stripped to plain text where a machine does.
 *
 * Deliberately ONLY emphasis, not a markdown parser. Links, headings and lists have no business in
 * a teaser, and a single-rule converter has no surprises in it. Matching delimiters are required
 * (via the backreference), so a stray asterisk can't swallow the rest of the sentence.
 */
const EMPHASIS = /([*_])([^*_\n]+?)\1/g;

/** Render `_x_` / `*x*` as italics. Escapes first, so CMS text can never inject markup. */
export function inlineEmphasisHtml(s: string): string {
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  return esc(s).replace(EMPHASIS, '<em>$2</em>');
}

/** Drop the markers, keeping the words — for descriptions, OG tags and JSON-LD. */
export function stripEmphasis(s: string): string {
  return s.replace(EMPHASIS, '$2');
}

/** A few taxa are known only from fragments and carry no restored reconstruction. */
export function isKnownMaterialOnly(d: TaxonData): boolean {
  return !d.reconstruction && !!d.rigorous;
}

/** The image shown as the hero plate: the reconstruction if present, else the known material. */
export function heroRef(d: TaxonData) {
  return d.reconstruction ?? d.rigorous!;
}

/** Scale-aware length: ≥1 m → "~12 m"; <1 m → "40 cm". `lengthLabel` overrides. */
export function formatLength(d: TaxonData): string {
  if (d.lengthLabel) return d.lengthLabel;
  const m = d.lengthM;
  if (m == null) return '';
  return m < 1 ? `${Math.round(m * 100)} cm` : `~${+m.toFixed(1)} m`;
}

/** Scale-aware length from raw meters (specimens have no lengthLabel override).
 *
 *  `decimals` defaults to 1, which is right for body lengths — a reconstructed total length is not
 *  known to the centimetre, so "~12.3 m" states the real precision. Pass 2 for directly measured
 *  ELEMENTS, where the extra figure is the whole point: adult T. rex femora run 1.26–1.33 m, so one
 *  decimal collapses five distinct bones to an identical "1.3" and the hub's sortable femur column
 *  reports nothing. Trailing zeros are still stripped, so a femur recorded as 1.30 shows "1.3"
 *  rather than claiming a precision the record doesn't have. */
export function formatMeters(m?: number, decimals = 1): string {
  if (m == null) return '';
  return m < 1 ? `${Math.round(m * 100)} cm` : `~${+m.toFixed(decimals)} m`;
}

/** US-friendly imperial length for the length record box, tiered so precision tracks the scale:
 *  under 2 ft → inches (nearest inch); 2–6 ft → nearest half-foot (the range where half a foot still
 *  matters); ≥6 ft → nearest whole foot. Returns "" when no length. */
export function formatImperial(m?: number): string {
  if (m == null) return '';
  const inch = Math.round(m * 39.3701);
  if (inch < 24) return `${inch} ${inch === 1 ? 'inch' : 'inches'}`; // under 2 ft
  const ftExact = m * 3.28084;
  const ft = ftExact < 6 ? Math.round(ftExact * 2) / 2 : Math.round(ftExact);
  const num = ft % 1 ? ft.toFixed(1) : String(ft);
  return `${num} ${ft === 1 ? 'foot' : 'feet'}`;
}

/** Scale-aware mass: ≥1 t → "~33.6 t"; ≥1 kg → "~450 kg"; <1 kg → "~300 g". */
export function formatMass(kg?: number): string {
  if (kg == null) return '';
  if (kg >= 1000) {
    const t = kg / 1000;
    return `~${+t.toFixed(t % 1 ? 1 : 0)} t`;
  }
  if (kg >= 1) return `~${Math.round(kg)} kg`;
  return `~${Math.round(kg * 1000)} g`;
}

function lengthPhrase(d: TaxonData): string {
  if (d.lengthM == null) return '';
  return d.lengthM < 1 ? `${Math.round(d.lengthM * 100)} cm` : `${d.lengthM} meters`;
}

function primaryName(d: TaxonData): string {
  const view = d.view.toLowerCase();
  const where = d.specimenId ? `${d.specimenId}, ${view}` : view;
  const kind = isKnownMaterialOnly(d) ? 'known skeletal material' : 'skeletal reconstruction';
  return `${d.taxon} — ${kind} (${where})`;
}

function primaryDescription(d: TaxonData): string {
  const len = lengthPhrase(d);
  const spec = d.specimenId ? ` specimen ${d.specimenId}` : '';
  const nick = d.specimenName ? ` (“${d.specimenName}”)` : '';
  if (isKnownMaterialOnly(d)) {
    return `Known skeletal material of ${d.taxon}${spec}${nick}: elements preserved are drawn in white against a black silhouette${len ? `, estimated length approximately ${len}` : ''}. Too incompletely known to restore a full reconstruction.`;
  }
  return `Skeletal reconstruction of ${d.taxon}${spec}${nick} in ${d.view.toLowerCase()} view${len ? `, reconstructed length approximately ${len}` : ''}.`;
}

function imageNode(
  d: TaxonData,
  opts: {
    url: string;
    name: string;
    description: string;
    representative: boolean;
    drawn?: number;
    updated?: number;
  },
) {
  return {
    '@type': 'ImageObject', // a CreativeWork subtype — satisfies the §3 ImageObject+CreativeWork rule
    '@id': opts.url,
    ...dateProps(opts.drawn, opts.updated),
    name: opts.name,
    description: opts.description,
    contentUrl: opts.url,
    creator: AUTHOR,
    copyrightHolder: AUTHOR,
    creditText: d.creditText,
    copyrightNotice: d.creditText,
    license: d.license,
    acquireLicensePage: d.license,
    encodingFormat: 'image/png',
    representativeOfPage: opts.representative,
    about: {
      '@type': 'Thing',
      name: d.taxon,
      alternateName: `${d.taxon} ${formatAuthor(d.author, d.recombination)}`,
    },
  };
}

/** The representative ImageObject — also rendered in the "what search engines see" panel. */
export function primaryNode(entry: CollectionEntry<'taxa'>, ctx: SchemaContext) {
  const hero = heroRef(entry.data);
  return imageNode(entry.data, {
    url: ctx.imageUrl,
    name: primaryName(entry.data),
    description: primaryDescription(entry.data),
    representative: true,
    drawn: hero?.drawn,
    updated: hero?.updated,
  });
}

/** Full JSON-LD graph: the hero image + (when a taxon has BOTH) the known-material image. */
export function taxonImageGraph(entry: CollectionEntry<'taxa'>, ctx: SchemaContext) {
  const d = entry.data;
  const nodes: Record<string, unknown>[] = [primaryNode(entry, ctx)];

  // Only emit a separate known-material node when there is ALSO a reconstruction;
  // for known-material-only taxa the hero node above already IS the known material.
  if (d.reconstruction && d.rigorous && ctx.rigorousUrl) {
    nodes.push(
      imageNode(d, {
        url: ctx.rigorousUrl,
        name: `${d.taxon} — known material${d.specimenId ? ` (${d.specimenId})` : ''}`,
        description: `Known-material diagram of ${d.taxon}${d.specimenId ? ` ${d.specimenId}` : ''}: elements preserved in the specimen are shown in white against a black body silhouette.`,
        representative: false,
        // Its own dates: a known-material diagram is frequently a different year from the
        // reconstruction beside it (Dreadnoughtus is 2016 against the skeletal's 2010).
        drawn: d.rigorous?.drawn,
        updated: d.rigorous?.updated,
      }),
    );
  }

  return { '@context': 'https://schema.org', '@graph': nodes };
}

/* ---------------------------------------------------------------------------
   Specimens. A specimen is an instance of the skeletal page at a nested URL;
   its parent taxon supplies the binomial + author for the `about` node, since
   the specimen record itself stores only the catalog identity.
   ------------------------------------------------------------------------- */

export function specimenIsKnownMaterialOnly(s: SpecimenData): boolean {
  return !s.reconstruction && !!s.rigorous;
}

/** Hero plate: the reconstruction if present, else the known-material diagram. */
export function specimenHero(s: SpecimenData) {
  return s.reconstruction ?? s.rigorous!;
}

export interface SpecimenSchemaContext {
  taxonName: string; // parent binomial, e.g. "Tyrannosaurus rex"
  author: string; // parent author citation, e.g. "Osborn, 1905"
  recombination?: boolean; // parent's recombination flag (parenthesizes the author)
  pageUrl: string;
  imageUrl: string;
  rigorousUrl?: string;
  figures?: { url: string; label?: string; alt: string }[]; // labeled extras (e.g. muscle study)
}

function specimenIdLabel(s: SpecimenData): string {
  return s.nickname ? `${s.catalog}, “${s.nickname}”` : s.catalog;
}

function specimenName(s: SpecimenData, taxonName: string): string {
  const kind = specimenIsKnownMaterialOnly(s) ? 'known skeletal material' : 'skeletal reconstruction';
  return `${taxonName} — ${kind} (${specimenIdLabel(s)}, ${s.view.toLowerCase()})`;
}

function specimenDescription(s: SpecimenData, taxonName: string): string {
  const len = s.lengthM == null ? '' : s.lengthM < 1 ? `${Math.round(s.lengthM * 100)} cm` : `${s.lengthM} meters`;
  const comp = s.completenessPct != null ? `, about ${s.completenessPct}% complete` : '';
  const nick = s.nickname ? ` (“${s.nickname}”)` : '';
  if (specimenIsKnownMaterialOnly(s)) {
    return `Known skeletal material of ${taxonName} specimen ${s.catalog}${nick}: elements preserved are drawn in white against a black silhouette${comp}${len ? `, estimated length approximately ${len}` : ''}.`;
  }
  return `Skeletal reconstruction of ${taxonName} specimen ${s.catalog}${nick} in ${s.view.toLowerCase()} view${len ? `, reconstructed length approximately ${len}` : ''}${comp}.`;
}

function specimenImageNode(
  s: SpecimenData,
  taxonName: string,
  author: string,
  recombination: boolean | undefined,
  opts: {
    url: string;
    name: string;
    description: string;
    representative: boolean;
    drawn?: number;
    updated?: number;
  },
) {
  const credit = s.creditText || CREDIT_DEFAULT;
  const license = s.license || LICENSE_DEFAULT;
  return {
    '@type': 'ImageObject',
    '@id': opts.url,
    name: opts.name,
    description: opts.description,
    contentUrl: opts.url,
    creator: AUTHOR,
    copyrightHolder: AUTHOR,
    creditText: credit,
    copyrightNotice: credit,
    license,
    acquireLicensePage: license,
    encodingFormat: 'image/png',
    representativeOfPage: opts.representative,
    ...dateProps(opts.drawn, opts.updated),
    about: { '@type': 'Thing', name: taxonName, alternateName: `${taxonName} ${formatAuthor(author, recombination)}` },
  };
}

/** The representative ImageObject for a specimen page (also shown in the SEO panel). */
export function specimenPrimaryNode(
  entry: CollectionEntry<'specimens'>,
  ctx: SpecimenSchemaContext,
) {
  const s = entry.data;
  return specimenImageNode(s, ctx.taxonName, ctx.author, ctx.recombination, {
    url: ctx.imageUrl,
    name: specimenName(s, ctx.taxonName),
    description: specimenDescription(s, ctx.taxonName),
    representative: true,
    drawn: specimenHero(s)?.drawn,
    updated: specimenHero(s)?.updated,
  });
}

/** Full graph: hero + (when both present) known material + each labeled extra figure. */
export function specimenImageGraph(
  entry: CollectionEntry<'specimens'>,
  ctx: SpecimenSchemaContext,
) {
  const s = entry.data;
  const nodes: Record<string, unknown>[] = [specimenPrimaryNode(entry, ctx)];

  if (s.reconstruction && s.rigorous && ctx.rigorousUrl) {
    nodes.push(
      specimenImageNode(s, ctx.taxonName, ctx.author, ctx.recombination, {
        url: ctx.rigorousUrl,
        name: `${ctx.taxonName} — known material (${s.catalog})`,
        description: `Known-material diagram of ${ctx.taxonName} ${s.catalog}: elements preserved in the specimen are shown in white against a black body silhouette.`,
        representative: false,
        drawn: s.rigorous?.drawn,
        updated: s.rigorous?.updated,
      }),
    );
  }

  for (const f of ctx.figures ?? []) {
    nodes.push(
      specimenImageNode(s, ctx.taxonName, ctx.author, ctx.recombination, {
        url: f.url,
        name: f.label
          ? `${ctx.taxonName} — ${f.label.toLowerCase()} (${s.catalog})`
          : `${ctx.taxonName} — figure (${s.catalog})`,
        description: f.alt,
        representative: false,
      }),
    );
  }

  return { '@context': 'https://schema.org', '@graph': nodes };
}
