import type { CollectionEntry } from 'astro:content';

/**
 * The genus hub rule, in one place.
 *
 * Genus hubs at `/<gallery>/<genus>/` are SYNTHETIC — no file backs them; getStaticPaths conjures
 * one wherever a gallery+genus has enough species. Three separate things now need to know whether a
 * given genus has a hub: the route builder, the species page (which links up to it), and the
 * silhouette tracer (which derives the hub's scale comparison). When that rule was written out by
 * hand in each of them it drifted, and the failure is always silent — a hub with no comparison, or a
 * link to a page that doesn't exist. So it lives here and gets imported.
 */

/** First word of the binomial, lowercased. This is the string the hub route is built from, so it has
 *  to be derived this exact way everywhere — not from the file slug, which can differ. */
export function genusSlugOf(taxonName: string): string {
  return taxonName.split(' ')[0].toLowerCase();
}

/** `${gallery}::${genusSlug}` for every genus that actually gets a hub page: two or more taxa in the
 *  same gallery, and no taxon already sitting on that slug (a taxon page wins the URL). */
export function genusHubKeys(taxa: CollectionEntry<'taxa'>[]): Set<string> {
  const taxonIds = new Set(taxa.map((t) => t.id));
  const counts = new Map<string, number>();
  for (const t of taxa) {
    const key = `${t.data.gallery}::${genusSlugOf(t.data.taxon)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const keys = new Set<string>();
  for (const [key, n] of counts) {
    if (n >= 2 && !taxonIds.has(key.split('::')[1])) keys.add(key);
  }
  return keys;
}

/** The hub URL for a taxon, or null when its genus has no hub. */
export function genusHubHref(
  gallery: string,
  taxonName: string,
  hubKeys: Set<string>,
): string | null {
  const slug = genusSlugOf(taxonName);
  return hubKeys.has(`${gallery}::${slug}`) ? `/${gallery}/${slug}/` : null;
}
