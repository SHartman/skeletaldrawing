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
  imageUrl: string; // absolute URL of the canonical reconstruction image
  rigorousUrl?: string; // absolute URL of the known-material image, if present
}

export function lengthText(d: TaxonData): string {
  return d.lengthLabel ?? (d.lengthM != null ? `${d.lengthM} m` : '');
}

export function reconstructionName(d: TaxonData): string {
  const view = d.view.toLowerCase();
  return `${d.taxon} — skeletal reconstruction${d.specimenId ? ` (${d.specimenId}, ${view})` : ` (${view})`}`;
}

export function reconstructionDescription(d: TaxonData): string {
  // Use a clean numeric form here so it doesn't collide with "approximately".
  const lm = d.lengthM != null ? `${d.lengthM} metres` : (d.lengthLabel ?? '');
  const spec = d.specimenId ? ` specimen ${d.specimenId}` : '';
  const nick = d.specimenName ? ` (“${d.specimenName}”)` : '';
  return `Skeletal reconstruction of ${d.taxon}${spec}${nick} in ${d.view.toLowerCase()} view${lm ? `, reconstructed length approximately ${lm}` : ''}.`;
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
      alternateName: `${d.taxon} (${d.authority})`,
    },
  };
}

/** The recon ImageObject alone — also used to render the "what search engines see" panel. */
export function reconstructionNode(entry: CollectionEntry<'taxa'>, ctx: SchemaContext) {
  return imageNode(entry.data, {
    url: ctx.imageUrl,
    name: reconstructionName(entry.data),
    description: reconstructionDescription(entry.data),
    representative: true,
  });
}

/** Full JSON-LD graph for the page: reconstruction + (optional) known-material image. */
export function taxonImageGraph(entry: CollectionEntry<'taxa'>, ctx: SchemaContext) {
  const d = entry.data;
  const nodes: Record<string, unknown>[] = [reconstructionNode(entry, ctx)];

  if (d.rigorous && ctx.rigorousUrl) {
    nodes.push(
      imageNode(d, {
        url: ctx.rigorousUrl,
        name: `${d.taxon} — rigorous skeletal, known material${d.specimenId ? ` (${d.specimenId})` : ''}`,
        description: `Rigorous skeletal diagram of ${d.taxon}${d.specimenId ? ` ${d.specimenId}` : ''}: elements preserved in the specimen are shown in white against a black body silhouette.`,
        representative: false,
      }),
    );
  }

  return { '@context': 'https://schema.org', '@graph': nodes };
}
