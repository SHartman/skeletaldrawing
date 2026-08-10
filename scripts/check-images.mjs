/**
 * Find image files that nothing references, and flag the ones that look like renames.
 *
 * Why this exists: uploading a REPLACEMENT image under a changed filename is silent and lossy. The
 * CMS writes the new file, points the entry at it, and leaves the old one in place — where
 * sync-assets dutifully mirrors it into src/assets and the build ships it. Nothing errors.
 *
 * The leftover file is only the visible half. The costly half is that a skeletal's filename is its
 * canonical identity in two places Google reads: `<image:loc>` in the image sitemap, and
 * `contentUrl` on every ImageObject (see sitemap-images.xml.ts). Rename the file and the structured
 * data now asserts a different URL, so whatever image-search history the old one had starts over.
 * Overwriting in place avoids all of it — the delivered /_astro/ variant is content-hashed, so the
 * cache busts on its own while the canonical URL holds still.
 *
 * So an orphan whose bytes match a referenced file is reported differently from one that is merely
 * stale: the first is a rename that cost something, the second is just cruft.
 *
 * WARNS, never fails. A staged image the owner hasn't wired up yet is legitimate, and blocking a
 * CMS publish over housekeeping would be a bad trade. Run on demand with `npm run check:images`.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

// EVERY content collection, discovered rather than listed. The first version hardcoded the five that
// existed then, and the day `genera` was added its images started reporting as unreferenced — a false
// positive, which is the one failure mode that makes a check worth ignoring. A directory scan cannot
// go stale when the next collection lands.
const CONTENT_ROOT = 'src/content';
const CONTENT_DIRS = existsSync(CONTENT_ROOT)
  ? readdirSync(CONTENT_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(CONTENT_ROOT, d.name))
  : [];
// [served directory, its mirror under src/assets]. sync-assets.mjs copies one to the other and never
// prunes, so a file deleted from public/ leaves its mirror behind forever unless it is removed too.
const PAIRS = [
  ['public/images/skeletals', 'src/assets/skeletals'],
  ['public/images/blog', 'src/assets/blog'],
  ['public/images/articles', 'src/assets/articles'],
];

// Every filename mentioned anywhere in content. Deliberately a substring test rather than parsing
// paths: a filename can appear in front matter, in Markdown prose, or inside an HTML tag, and all
// three count as a reference.
// Percent-decoded as well as raw. A filename with a space is written `Luigi%20review.png` in Markdown
// but sits on disk as `Luigi review.png`, so a raw substring test misses it and reports a referenced
// image as an orphan. Decoding can throw on a stray `%`, so it falls back to the original.
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const haystack = CONTENT_DIRS.filter(existsSync)
  .flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.md')).map((f) => readFileSync(join(d, f), 'utf8')))
  .flatMap((t) => [t, decode(t)])
  .join('\n');

const hash = (p) => createHash('sha1').update(readFileSync(p)).digest('hex');
const orphans = [];

for (const [pub, mirror] of PAIRS) {
  if (!existsSync(pub)) continue;
  const files = readdirSync(pub).filter((f) => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(f));
  const used = files.filter((f) => haystack.includes(f));
  const usedHashes = new Map(used.map((f) => [hash(join(pub, f)), f]));

  for (const f of files) {
    if (haystack.includes(f)) continue;
    const twin = usedHashes.get(hash(join(pub, f)));
    orphans.push({
      pub: join(pub, f),
      mirror: existsSync(join(mirror, f)) ? join(mirror, f) : null,
      kb: Math.round(statSync(join(pub, f)).size / 1024),
      renamedTo: twin ?? null,
    });
  }
}

if (!orphans.length) {
  console.log('✓ images: every file is referenced');
} else {
  const renames = orphans.filter((o) => o.renamedTo);
  const stale = orphans.filter((o) => !o.renamedTo);
  const kb = orphans.reduce((n, o) => n + o.kb, 0);
  console.log(`\n⚠ ${orphans.length} unreferenced image${orphans.length === 1 ? '' : 's'} (${kb} KB)`);

  for (const o of renames) {
    console.log(`\n  RENAMED — identical bytes to a file still in use:`);
    console.log(`    ${o.pub}`);
    console.log(`      now referenced as: ${o.renamedTo}`);
    console.log(`      the old name was this image's canonical contentUrl + sitemap entry, so that`);
    console.log(`      association resets. Overwrite in place next time and the URL holds still.`);
    if (o.mirror) console.log(`    mirror to remove too: ${o.mirror}`);
  }
  for (const o of stale) {
    console.log(`\n  UNREFERENCED (${o.kb} KB): ${o.pub}`);
    if (o.mirror) console.log(`    mirror to remove too: ${o.mirror}`);
  }
  console.log(`\n  Not an error — a staged image may not be wired up yet. Delete both copies when it is cruft.\n`);
}
