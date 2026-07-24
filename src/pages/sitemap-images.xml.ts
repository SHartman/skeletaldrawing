// Image sitemap (CLAUDE.md §3): lists every skeletal image under the page it lives on, so Google
// crawls the reconstructions as images — the whole point of the rebuild. The URL sitemap
// (@astrojs/sitemap → /sitemap-index.xml) covers pages; this covers the images on them. Both are
// referenced in robots.txt and submitted to GSC.
//
// Image URLs are the stable PUBLIC paths (matching each ImageObject's contentUrl), not the hashed
// /_astro/ variants. Under-revision taxa are skipped — their placeholder isn't a real skeletal.
import { getCollection } from 'astro:content';

const SITE = 'https://www.skeletaldrawing.com';
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const abs = (src: string) => (src.startsWith('http') ? src : SITE + src);

type Img = { src: string; alt: string };
type Entry = { loc: string; images: Img[] };
const collect = (...refs: (({ src?: string; alt?: string } | null | undefined))[]): Img[] =>
  refs.filter((f): f is { src: string; alt?: string } => !!f?.src).map((f) => ({ src: f.src, alt: f.alt ?? '' }));

export async function GET() {
  const taxa = await getCollection('taxa');
  const specimens = await getCollection('specimens');
  const galleryOf = new Map(taxa.map((t) => [t.id, t.data.gallery]));
  const entries: Entry[] = [];

  for (const t of taxa) {
    if (t.data.underRevision) continue;
    const images = [
      ...collect(t.data.reconstruction, t.data.rigorous, t.data.lifeReconstruction),
      ...collect(...(t.data.additionalFigures ?? [])),
    ];
    if (images.length) entries.push({ loc: `${SITE}/${t.data.gallery}/${t.id}/`, images });
  }

  for (const s of specimens) {
    const gallery = galleryOf.get(s.data.taxon);
    if (!gallery) continue;
    const images = [
      ...collect(s.data.reconstruction, s.data.rigorous),
      ...collect(...(s.data.additionalFigures ?? [])),
    ];
    if (images.length) entries.push({ loc: `${SITE}/${gallery}/${s.data.taxon}/${s.id}/`, images });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries
      .map(
        (e) =>
          `  <url>\n    <loc>${esc(e.loc)}</loc>\n` +
          e.images
            .map(
              (i) =>
                `    <image:image><image:loc>${esc(abs(i.src))}</image:loc>` +
                (i.alt ? `<image:title>${esc(i.alt)}</image:title>` : '') +
                `</image:image>`,
            )
            .join('\n') +
          `\n  </url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
