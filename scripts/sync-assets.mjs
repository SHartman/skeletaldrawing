/**
 * Mirror CMS-uploaded images into the Astro image pipeline.
 *
 * The CMS (Sveltia) writes uploads only to `public/images/…`, but the pages render the OPTIMIZED
 * copy that Astro builds from `src/assets/…` (falling back to the raw public path when the asset
 * copy is missing — see src/lib/images.ts). So an image added purely through the CMS would display
 * unoptimized, and a REPLACED one would keep showing the old optimized variant.
 *
 * This runs before `astro build` and copies anything that's missing or has changed, so an upload
 * made from the CMS on any device gets responsive AVIF/WebP variants with no local tooling.
 *
 * Covers blog and article images as well as skeletals: those were being served as raw <img> at
 * full upload resolution, so a 1.2 MB phone photo was downloaded whole for a 220px thumbnail.
 *
 * Safe to re-run: it compares size, then content hash, and copies only on a real difference.
 */
import { readdirSync, existsSync, mkdirSync, copyFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

// Keep in step with the globs in src/lib/images.ts — each pair needs a loader there to be used.
const PAIRS = [
  ['public/images/skeletals', 'src/assets/skeletals'],
  ['public/images/blog', 'src/assets/blog'],
  ['public/images/articles', 'src/assets/articles'],
];

const hash = (p) => createHash('sha1').update(readFileSync(p)).digest('hex');

let added = 0;
let updated = 0;
let total = 0;

for (const [SRC, DST] of PAIRS) {
  if (!existsSync(SRC)) continue;
  if (!existsSync(DST)) mkdirSync(DST, { recursive: true });

  for (const f of readdirSync(SRC)) {
    if (!/\.(png|jpe?g|webp|avif)$/i.test(f)) continue;
    total++;
    const src = join(SRC, f);
    const dst = join(DST, f);

    if (!existsSync(dst)) {
      copyFileSync(src, dst);
      added++;
      console.log(`  + ${f}`);
      continue;
    }
    // Cheap check first; only hash when sizes match (the ambiguous case).
    if (statSync(src).size !== statSync(dst).size || hash(src) !== hash(dst)) {
      copyFileSync(src, dst);
      updated++;
      console.log(`  ~ ${f}`);
    }
  }
}

console.log(`asset sync: ${added} added, ${updated} updated, ${total} images checked`);
