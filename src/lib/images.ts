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

/**
 * The same trick for blog and article imagery, which used to render as raw <img> on the public
 * path — so a photo straight off a phone was served at full upload resolution to a 220px
 * thumbnail. `scripts/sync-assets.mjs` mirrors these folders; the globs must be literal strings,
 * hence one per folder rather than a parameterised path.
 *
 * Both return null when there's no mirrored copy yet, and every caller keeps its plain <img>
 * fallback — an image is always better than a hole while the mirror catches up.
 */
const blogAssets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/blog/*.{png,jpg,jpeg,webp,avif}',
);
const articleAssets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/articles/*.{png,jpg,jpeg,webp,avif}',
);

const lookup = async (
  glob: Record<string, () => Promise<{ default: ImageMetadata }>>,
  dir: string,
  publicPath: string,
): Promise<ImageMetadata | null> => {
  const basename = publicPath.split('/').pop();
  if (!basename) return null;
  const loader = glob[`${dir}/${basename}`];
  if (!loader) return null;
  return (await loader()).default;
};

export const loadBlogImage = (publicPath: string) =>
  lookup(blogAssets, '/src/assets/blog', publicPath);

export const loadArticleImage = (publicPath: string) =>
  lookup(articleAssets, '/src/assets/articles', publicPath);
