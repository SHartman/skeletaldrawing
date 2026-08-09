// Guard for public/_redirects — run after a build (`npm run check:redirects`).
//
// WHY THIS EXISTS: on 2026-07-24, seven live pages (including the Torvosaurus and Diplodocus
// genus hubs) served ERR_TOO_MANY_REDIRECTS. The legacy-URL map had emitted a (no-slash,
// with-slash) pair per legacy URL, and wherever the legacy slug already equalled the new slug
// the with-slash line became `/x/ -> /x/ 301` — a self-redirect. Cloudflare applies _redirects
// BEFORE serving static files, so the rule shadowed a page that was building perfectly.
//
// The pre-cutover link check missed it because it validated links against dist/ and never
// applied the redirect layer on top. This script closes exactly that gap: it reasons about the
// redirect table AND the built output together. CLAUDE.md §3 calls URL preservation sacred and
// the table only grows, so this is cheap insurance.
//
// Checks (any FAIL exits non-zero):
//   1. self-loop      — source === destination
//   2. cycle          — a chain of rules that returns to a URL it already visited
//   3. duplicate      — same source listed twice (the second is dead, silently ignored)
//   4. shadow         — source is a real built page, so the redirect hides it   <- the 2026-07-24 bug
//   5. dead target    — destination is neither a built page, a static file, another rule's
//                       source, nor external; following it would 404          (warning, not fatal)
//   6. no slash twin  — a `/x` rule with no `/x/` rule; Cloudflare treats them as different keys,
//                       so the slash form 404s                     <- the 2026-08-07 bug (warning)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const REDIRECTS = join(ROOT, 'public', '_redirects');
const DIST = join(ROOT, 'dist');

// ---------------------------------------------------------------- parse
/** @type {{src:string,dest:string,status:string,line:number}[]} */
const rules = [];
readFileSync(REDIRECTS, 'utf8').split(/\r?\n/).forEach((raw, i) => {
  const t = raw.trim();
  if (!t || t.startsWith('#')) return;
  const [src, dest, status = '301'] = t.split(/\s+/);
  if (!src || !dest) return;
  rules.push({ src, dest, status, line: i + 1 });
});

// Dynamic rules (splats/placeholders) can't be resolved statically — excluded from graph checks.
const isDynamic = (r) => r.src.includes('*') || r.dest.includes('*') || /:[A-Za-z]/.test(r.dest);
const staticRules = rules.filter((r) => !isDynamic(r));
const bySrc = new Map(staticRules.map((r) => [r.src, r]));

// ------------------------------------------------- what the build actually produced
// trailingSlash: 'always' — every page is <dir>/index.html, canonical URL is '/<dir>/'.
const pages = new Set(); // canonical page URLs
const files = new Set(); // every other emitted asset, as a URL path
if (existsSync(DIST)) {
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      const url = '/' + relative(DIST, abs).split(sep).join('/');
      if (url.endsWith('/index.html')) pages.add(url.slice(0, -'index.html'.length));
      else files.add(url);
    }
  };
  walk(DIST);
}

// ---------------------------------------------------------------- checks
const fail = [];
const warn = [];
const at = (r) => `_redirects:${r.line}`;

// 1 + 3
const seenSrc = new Map();
for (const r of rules) {
  if (r.src === r.dest) fail.push(`${at(r)}  SELF-LOOP     ${r.src} -> itself`);
  if (seenSrc.has(r.src)) warn.push(`${at(r)}  DUPLICATE     ${r.src} (first at line ${seenSrc.get(r.src)}; this one is dead)`);
  else seenSrc.set(r.src, r.line);
}

// 2 — follow each chain; report the entry rule of any cycle (skip pure self-loops, already reported)
for (const r of staticRules) {
  if (r.src === r.dest) continue;
  const seen = new Set([r.src]);
  let cur = r.dest;
  for (let hops = 0; bySrc.has(cur) && hops < 25; hops++) {
    if (seen.has(cur)) { fail.push(`${at(r)}  CYCLE         ${r.src} -> ... -> ${cur} (already visited)`); break; }
    seen.add(cur);
    cur = bySrc.get(cur).dest;
  }
}

// 4 — the bug class: a rule whose source is a page the build really emits
if (pages.size) {
  for (const r of rules) {
    if (pages.has(r.src)) fail.push(`${at(r)}  SHADOWS PAGE  ${r.src} is a built page; this rule hides it`);
  }
}

// 5 — destination goes nowhere
if (pages.size) {
  for (const r of staticRules) {
    const dest = r.dest.split(/[?#]/)[0];
    if (/^https?:\/\//i.test(dest)) continue;
    if (pages.has(dest) || files.has(dest) || bySrc.has(dest)) continue;
    if (pages.has(dest + '/') || files.has(dest + '/index.html')) continue;
    warn.push(`${at(r)}  DEAD TARGET   ${r.src} -> ${dest} (not a built page)`);
  }
}

// 6 — a rule with no trailing-slash twin
//
// Cloudflare does NOT normalise trailing slashes in _redirects: `/bio` and `/bio/` are different
// keys, and a rule for one leaves the other returning 404. Verified live on 2026-08-07, when GSC
// reported `/ornithiscians/` as Not Found while `/ornithiscians` redirected correctly — the single
// URL CLAUDE.md §8 singles out as the deliberate slug correction. 103 rules were missing their twin.
//
// The per-taxon block had always been emitted in pairs, so the generator knew; the hand-written
// section and page rules did not. This is the mirror of check 4: that one catches a with-slash rule
// that shadows a real page, this catches a no-slash rule whose partner was never written.
//
// Skipped: sources with a file extension (`/x.htm/` is not a URL anyone requests), and any twin that
// would equal the destination — adding those is precisely how the 2026-07-24 redirect loop happened.
for (const r of staticRules) {
  if (r.src.endsWith('/')) continue;
  if (/\.[a-z0-9]+$/i.test(r.src.split('/').pop())) continue;
  const twin = r.src + '/';
  if (bySrc.has(twin) || twin === r.dest || pages.has(twin)) continue;
  warn.push(`${at(r)}  NO SLASH TWIN ${twin} has no rule and will 404 (${r.src} redirects fine)`);
}

// ---------------------------------------------------------------- report
const stat = existsSync(DIST) ? `${pages.size} built pages` : 'dist/ missing — run `npm run build` first (checks 4 & 5 skipped)';
console.log(`_redirects: ${rules.length} rules (${staticRules.length} static, ${rules.length - staticRules.length} dynamic) · ${stat}`);
for (const w of warn) console.log('  warn  ' + w);
for (const f of fail) console.log('  FAIL  ' + f);

if (fail.length) {
  console.error(`\n✗ ${fail.length} redirect problem(s). These break real URLs — fix before deploying.`);
  process.exit(1);
}
console.log(warn.length ? `\n✓ no fatal problems (${warn.length} warning(s))` : '\n✓ redirects clean');
