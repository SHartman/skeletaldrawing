import type { CollectionEntry } from 'astro:content';

/**
 * Single source of truth for a taxon's machine-readable identity. The same
 * functions feed the on-page record AND the JSON-LD, so the two can never
 * drift (CLAUDE.md §3 — the point of the rebuild). Pixels travel; this text
 * and schema establish the canonical source.
 */

type TaxonData = CollectionEntry<'taxa'>['data'];

const AUTHOR = {
  '@type': 'Person',
  name: 'Scott Hartman',
  url: 'https://www.skeletaldrawing.com/about/',
} as const;

export interface SchemaContext {
  pageUrl: string; // absolute canonical URL of the page
  imageUrl: string; // absolute URL of the primary (hero) image
  rigorousUrl?: string; // absolute URL of the known-material image when shown separately
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
  return d.lengthM < 1 ? `${Math.round(d.lengthM * 100)} cm` : `${d.lengthM} metres`;
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
  opts: { url: string; name: string; description: string; representative: boolean },
) {
  return {
    '@type': 'ImageObject', // a CreativeWork subtype — satisfies the §3 ImageObject+CreativeWork rule
    '@id': opts.url,
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
      alternateName: `${d.taxon} (${d.author})`,
    },
  };
}

/** The representative ImageObject — also rendered in the "what search engines see" panel. */
export function primaryNode(entry: CollectionEntry<'taxa'>, ctx: SchemaContext) {
  return imageNode(entry.data, {
    url: ctx.imageUrl,
    name: primaryName(entry.data),
    description: primaryDescription(entry.data),
    representative: true,
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
      }),
    );
  }

  return { '@context': 'https://schema.org', '@graph': nodes };
}
