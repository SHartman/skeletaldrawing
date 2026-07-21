/**
 * Mirror CMS-uploaded skeletals into the Astro image pipeline.
 *
 * The CMS (Sveltia) writes uploads only to `public/images/skeletals/`, but the pages render the
 * OPTIMIZED copy that Astro builds from `src/assets/skeletals/` (falling back to the raw public
 * path when the asset copy is missing — see src/lib/images.ts). So a skeletal added purely through
 * the CMS would display unoptimized, and a REPLACED image would keep showing the old optimized one.
 *
 * This runs before `astro build` and copies anything that's missing or has changed, so an upload
 * made from the CMS on any device gets responsive AVIF/WebP variants with no local tooling.
 *
 * Safe to re-run: it compares size, then content hash, and copies only on a real difference.
 */
import { readdirSync, existsSync, mkdirSync, copyFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const SRC = 'public/images/skeletals';
const DST = 'src/assets/skeletals';

if (!existsSync(SRC)) {
  console.log(`asset sync: no ${SRC} — nothing to do`);
  process.exit(0);
}
if (!existsSync(DST)) mkdirSync(DST, { recursive: true });

const hash = (p) => createHash('sha1').update(readFileSync(p)).digest('hex');

let added = 0;
let updated = 0;
let total = 0;

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

console.log(`asset sync: ${added} added, ${updated} updated, ${total} images checked`);
