import type { ImageMetadata } from 'astro';

/**
 * Resolve a skeletal drawing to its in-repo source asset so Astro can generate
 * optimized, responsive variants at build time.
 *
 * Content entries store a PUBLIC path (e.g. /images/skeletals/foo.png) — that
 * path stays the stable, shareable canonical URL used for JSON-LD contentUrl
 * and og:image. For on-page rendering we want the optimized version, which
 * Astro only produces for images imported from src/. We therefore keep a copy
 * of each drawing in src/assets/skeletals/ under the SAME descriptive basename
 * and look it up here by that basename.
 *
 * Returns null if there's no src/assets copy (e.g. a CMS-added image that only
 * exists in public/) — callers fall back to a plain <img> on the public path.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/skeletals/*.{png,jpg,jpeg,webp,avif}',
);

export async function loadSkeletal(publicPath: string): Promise<ImageMetadata | null> {
  const basename = publicPath.split('/').pop();
  if (!basename) return null;
  const loader = assets[`/src/assets/skeletals/${basename}`];
  if (!loader) return null;
  return (await loader()).default;
}
