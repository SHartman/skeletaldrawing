/**
 * Trace body silhouettes from Scott's skeletal PNGs for the scale-comparison overlay.
 *
 * The drawings are line art on white: the flesh outline is a SOLID BLACK silhouette
 * with bones knocked out in white. We trace the KNOWN-MATERIAL image (single left
 * lateral, mostly solid black body — cleaner and unambiguous even when the
 * reconstruction is a two-view plate), fill the enclosed bone voids (flood the
 * background in from the border; keep everything it can't reach), take the largest
 * component, and trace its outer boundary. The "1 m" bar + credit fall out as small
 * separate blobs.
 *
 * Pipeline per image: flatten→grayscale→downscale → threshold to black mask →
 * label components, keep the largest → Moore-neighbor boundary trace → Ramer–
 * Douglas–Peucker simplify → emit a normalized SVG path + bbox + real length.
 *
 * Output: src/data/silhouettes.json, keyed by taxon slug. Re-run after adding or
 * re-flagging `overlay` specimens:  node scripts/silhouette.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TRACE_WIDTH = 1000; // downscale target — plenty for a simplified outline
const BLACK = 128; // luminance threshold (0–255) below which a pixel is "flesh"
const CLOSE = 6; // morphological-close radius (px) — seals mouth/rib gaps before fill
const RDP_EPS = 1.4; // simplify tolerance in downscaled px
const HOLE_MIN_FRAC = 0.0025; // owner-silhouette interior pockets below this share of the canvas are ignored (specks)

// ----- minimal frontmatter read (flat fields + one nested image src) -----
function readSpecimen(file) {
  const txt = readFileSync(file, 'utf8');
  const fm = txt.split('---')[1] ?? '';
  const get = (re) => (fm.match(re)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  const overlay = /overlay:\s*true/.test(fm);
  const taxon = get(/\btaxon:\s*([^\n]+)/);
  const lengthM = parseFloat(get(/\blengthM:\s*([\d.]+)/));
  const widthM = parseFloat(get(/\bwidthM:\s*([\d.]+)/)); // NaN when absent → dropped downstream
  const nickname = get(/\bnickname:\s*([^\n]+)/);
  const catalog = get(/\bcatalog:\s*([^\n]+)/);
  const reconSrc = get(/reconstruction:\s*\n\s*src:\s*([^\n]+)/);
  const rigorousSrc = get(/rigorous:\s*\n\s*src:\s*([^\n]+)/);
  const slug = file.split(/[\\/]/).pop().replace(/\.md$/, '');
  // Known-material image is the cleaner silhouette source; fall back to reconstruction.
  const traceSrc = rigorousSrc || reconSrc;
  return { slug, taxon, overlay, lengthM, widthM, nickname, catalog, traceSrc };
}

// ----- binary morphology: `iters` passes of a 3×3 (Chebyshev) kernel -----
function morph(src, W, H, iters, grow) {
  let a = src;
  for (let it = 0; it < iters; it++) {
    const b = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = a[i];
        if (grow ? !v : v) {
          loop: for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx,
                ny = y + dy;
              const o = nx < 0 || ny < 0 || nx >= W || ny >= H ? 0 : a[ny * W + nx];
              if (grow ? o : !o) {
                v = grow ? 1 : 0;
                break loop;
              }
            }
        }
        b[i] = v;
      }
    a = b;
  }
  return a;
}

// ----- connected components (4-neighbour) → largest component mask -----
function largestComponent(mask, W, H) {
  const label = new Int32Array(W * H).fill(0);
  const stack = [];
  let best = 0,
    bestSize = 0,
    cur = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s]) continue;
    cur++;
    let size = 0;
    stack.push(s);
    label[s] = cur;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % W,
        y = (p / W) | 0;
      const nb = [];
      if (x > 0) nb.push(p - 1);
      if (x < W - 1) nb.push(p + 1);
      if (y > 0) nb.push(p - W);
      if (y < H - 1) nb.push(p + W);
      for (const q of nb) if (mask[q] && !label[q]) {
        label[q] = cur;
        stack.push(q);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = cur;
    }
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

// ----- connected components (4-neighbour) → list with bbox + size, plus the label map -----
function labelComponents(mask, W, H) {
  const label = new Int32Array(W * H);
  const comps = [];
  const stack = [];
  let cur = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s]) continue;
    cur++;
    let size = 0,
      minX = W,
      minY = H,
      maxX = 0,
      maxY = 0;
    stack.push(s);
    label[s] = cur;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % W,
        y = (p / W) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const nb = [];
      if (x > 0) nb.push(p - 1);
      if (x < W - 1) nb.push(p + 1);
      if (y > 0) nb.push(p - W);
      if (y < H - 1) nb.push(p + W);
      for (const q of nb) if (mask[q] && !label[q]) {
        label[q] = cur;
        stack.push(q);
      }
    }
    comps.push({ id: cur, size, minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY });
  }
  return { label, comps };
}

// ----- Moore-neighbour boundary tracing (clockwise) -----
function traceBoundary(mask, W, H) {
  const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] ? 1 : 0);
  let s = null;
  outer: for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (get(x, y)) {
        s = [x, y];
        break outer;
      }
  if (!s) return [];
  // 8 neighbours, clockwise: W, NW, N, NE, E, SE, S, SW
  const d = [
    [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1],
  ];
  const contour = [s];
  let p = s;
  let b = [s[0] - 1, s[1]]; // backtrack (background) pixel
  const max = W * H * 8;
  for (let count = 0; count < max; count++) {
    let bi = 0;
    for (let k = 0; k < 8; k++)
      if (p[0] + d[k][0] === b[0] && p[1] + d[k][1] === b[1]) {
        bi = k;
        break;
      }
    let found = null,
      fk = -1;
    for (let j = 1; j <= 8; j++) {
      const k = (bi + j) % 8;
      const nx = p[0] + d[k][0],
        ny = p[1] + d[k][1];
      if (get(nx, ny)) {
        found = [nx, ny];
        fk = k;
        break;
      }
    }
    if (!found) break;
    b = [p[0] + d[(fk + 7) % 8][0], p[1] + d[(fk + 7) % 8][1]];
    p = found;
    if (p[0] === s[0] && p[1] === s[1]) break;
    contour.push(p);
  }
  return contour;
}

// ----- Ramer–Douglas–Peucker simplification -----
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const sqd = (p, a, b) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const cx = a[0] + t * dx,
      cy = a[1] + t * dy;
    return (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const e2 = eps * eps;
  while (stack.length) {
    const [a, b] = stack.pop();
    let idx = -1,
      dmax = e2;
    for (let i = a + 1; i < b; i++) {
      const d = sqd(pts[i], pts[a], pts[b]);
      if (d > dmax) {
        dmax = d;
        idx = i;
      }
    }
    if (idx !== -1) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

async function traceImage(file, { alpha = false } = {}) {
  let W, H;
  let mask;
  if (alpha) {
    // Owner-supplied transparent silhouette: the alpha channel IS the body, already solid.
    // No threshold/close/fill — and crucially no erode, which would sever a thin whip-tail.
    const { data, info } = await sharp(file)
      .ensureAlpha()
      .resize({ width: TRACE_WIDTH })
      .raw()
      .toBuffer({ resolveWithObject: true });
    W = info.width;
    H = info.height;
    mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = data[i * info.channels + 3] > 16 ? 1 : 0;
  } else {
    // Skeletal raster: solid-black flesh with bones knocked out in white.
    const { data, info } = await sharp(file)
      .flatten({ background: '#ffffff' })
      .resize({ width: TRACE_WIDTH })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    W = info.width;
    H = info.height;
    const mask0 = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask0[i] = data[i * info.channels] < BLACK ? 1 : 0;

    // Morphological CLOSE with fill: dilate to seal the thin white channels where a bone
    // void opens to the exterior (mouth gap, rib gaps), fill the now-enclosed voids, erode back.
    const dil = morph(mask0, W, H, CLOSE, true);
    const outside = new Uint8Array(W * H);
    const q = [];
    const seed = (x, y) => {
      const i = y * W + x;
      if (!dil[i] && !outside[i]) {
        outside[i] = 1;
        q.push(i);
      }
    };
    for (let x = 0; x < W; x++) {
      seed(x, 0);
      seed(x, H - 1);
    }
    for (let y = 0; y < H; y++) {
      seed(0, y);
      seed(W - 1, y);
    }
    while (q.length) {
      const p = q.pop();
      const x = p % W,
        y = (p / W) | 0;
      if (x > 0) seed(x - 1, y);
      if (x < W - 1) seed(x + 1, y);
      if (y > 0) seed(x, y - 1);
      if (y < H - 1) seed(x, y + 1);
    }
    const filled = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) filled[i] = outside[i] ? 0 : 1;
    mask = morph(filled, W, H, CLOSE, false); // erode back: undo the dilation
  }

  const big = largestComponent(mask, W, H);
  const outer = rdp(traceBoundary(big, W, H), RDP_EPS);

  // Interior holes — owner (alpha) silhouettes only. An enclosed transparent pocket is intentional
  // negative space (e.g. the gap framed by overlapping limbs) that the outer-only trace would fill.
  // We flood the background inward from the border; whatever's neither body nor reachable is a hole,
  // traced as an extra subpath. Rendered with fill-rule:evenodd, those subpaths cut back out. A size
  // floor drops tracing specks. The raster path is left alone — there, enclosed voids are bones it
  // deliberately fills shut.
  const holes = [];
  if (alpha) {
    const outside = new Uint8Array(W * H);
    const stack = [];
    const mark = (x, y) => { const i = y * W + x; if (!big[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { mark(x, 0); mark(x, H - 1); }
    for (let y = 0; y < H; y++) { mark(0, y); mark(W - 1, y); }
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      if (x > 0) mark(x - 1, y); if (x < W - 1) mark(x + 1, y); if (y > 0) mark(x, y - 1); if (y < H - 1) mark(x, y + 1);
    }
    const holeMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) holeMask[i] = !big[i] && !outside[i] ? 1 : 0;
    const { label, comps } = labelComponents(holeMask, W, H);
    const minArea = HOLE_MIN_FRAC * W * H;
    for (const c of comps) {
      if (c.size < minArea) continue;
      const m = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) if (label[i] === c.id) m[i] = 1;
      const hc = rdp(traceBoundary(m, W, H), RDP_EPS);
      if (hc.length >= 3) holes.push(hc);
    }
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = +(maxX - minX).toFixed(1),
    h = +(maxY - minY).toFixed(1);
  const sub = (c) =>
    c.map(([x, y], i) => `${i ? 'L' : 'M'}${+(x - minX).toFixed(1)} ${+(y - minY).toFixed(1)}`).join('') + 'Z';
  const path = [outer, ...holes].map(sub).join('');
  return { w, h, path, points: outer.length, holes: holes.length };
}

// Trace the human scale reference from the owner's transparent adult+child PNG. The file
// also carries a 1 m bar and a "1m" label as separate blobs; we keep only the components
// taller than 40% of the tallest (the two people), drop the bar/text, and emit one path of
// two subpaths in a shared coordinate space (relative size + stance preserved as drawn).
// The taller figure (the ~1.8 m adult) sets the overall height; the child scales with it.
async function traceHuman(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize({ width: TRACE_WIDTH })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = data[i * info.channels + 3] > 16 ? 1 : 0;

  const { label, comps } = labelComponents(mask, W, H);
  const maxH = Math.max(...comps.map((c) => c.h));
  const figures = comps.filter((c) => c.h >= 0.4 * maxH); // people only — drops the bar + "1m"

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const c of figures) {
    minX = Math.min(minX, c.minX);
    minY = Math.min(minY, c.minY);
    maxX = Math.max(maxX, c.maxX);
    maxY = Math.max(maxY, c.maxY);
  }
  const subs = [];
  for (const c of figures.sort((a, b) => a.minX - b.minX)) {
    const m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (label[i] === c.id) m[i] = 1;
    const contour = rdp(traceBoundary(m, W, H), RDP_EPS);
    subs.push(
      contour
        .map(([x, y], i) => `${i ? 'L' : 'M'}${+(x - minX).toFixed(1)} ${+(y - minY).toFixed(1)}`)
        .join('') + 'Z',
    );
  }
  return { w: +(maxX - minX).toFixed(1), h: +(maxY - minY).toFixed(1), path: subs.join(''), figures: subs.length };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const binomial = (slug) => {
  const [g, s] = slug.split('-');
  return s ? `${cap(g)} ${s}` : cap(g);
};

// Curated genus-level comparisons, drawn from owner-supplied transparent silhouettes in
// silhouettes/. Lengths come from the content entries (single source of truth); labels are
// explicit for legend clarity. Output is keyed by the genus slug (what the genus hub passes).
const GENUS_GROUPS = {
  diplodocus: [
    { file: 'diplodocus-carnegii-silhouette.png', taxon: 'diplodocus-carnegii', label: 'D. carnegii' },
    { file: 'diplodocus-hallorum-nmmnh-3690-silhouette.png', taxon: 'diplodocus-hallorum', specimen: 'nmmnh-3690', label: 'D. hallorum · NMMNH 3690' },
    { file: 'diplodocus-hallorum-amnh-223-silhouette.png', taxon: 'diplodocus-hallorum', specimen: 'amnh-223', label: 'D. hallorum · AMNH 223' },
  ],
  // A. jimmadseni is specimen-rich, so it's shown per specimen (Big Al + Little Al), matching the hub.
  allosaurus: [
    { file: 'allosaurus-fragilis-skeletal.png', taxon: 'allosaurus-fragilis', label: 'A. fragilis' },
    { file: 'allosaurus-jimmadseni-big-al-mor-693-skeletal.png', taxon: 'allosaurus-jimmadseni', specimen: 'big-al', label: 'A. jimmadseni · Big Al' },
    { file: 'allosaurus-jimmadseni-little-al-juvenile-skeletal.png', taxon: 'allosaurus-jimmadseni', specimen: 'little-al', label: 'A. jimmadseni · Little Al (juv.)' },
  ],
  torvosaurus: [
    { file: 'torvosaurus-gurneyi-known-elements.png', taxon: 'torvosaurus-gurneyi', label: 'T. gurneyi' },
    { file: 'torvosaurus-tanneri-skeletal.png', taxon: 'torvosaurus-tanneri', label: 'T. tanneri' },
  ],
  apatosaurus: [
    { file: 'apatosaurus-louisae-silhouette.png', taxon: 'apatosaurus-louisae', label: 'A. louisae' },
    { file: 'apatosaurus-ajax-silhouette.png', taxon: 'apatosaurus-ajax', label: 'A. ajax' },
  ],
  // Ornithischian genus hubs — juveniles/subadults labelled so the legend reads honestly.
  edmontosaurus: [
    { file: 'edmontosaurus-regalis-skeletal.png', taxon: 'edmontosaurus-regalis', label: 'E. regalis' },
    { file: 'edmontosaurus-annectens-skeletal.png', taxon: 'edmontosaurus-annectens', label: 'E. annectens' },
  ],
  parasaurolophus: [
    { file: 'parasaurolophus-walkeri-type-specimen-rom-768-skeletal.png', taxon: 'parasaurolophus-walkeri', label: 'P. walkeri' },
    { file: 'parasaurolophus-cyrtocristatus-fmnh-p27393-skeletal.png', taxon: 'parasaurolophus-cyrtocristatus', label: 'P. cyrtocristatus' },
    { file: 'parasaurolophus-sp-juvenile-ram-14000-skeletal.png', taxon: 'parasaurolophus-sp', label: 'P. sp. · juvenile' },
  ],
  triceratops: [
    { file: 'triceratops-horridus-skeletal.png', taxon: 'triceratops-horridus', label: 'T. horridus' },
    { file: 'triceratops-sp-yoshi-skeletal.png', taxon: 'triceratops-sp', label: 'T. sp. · MOR 3027' },
    { file: 'triceratops-prorsus-skeletal-subadult.png', taxon: 'triceratops-prorsus', label: 'T. prorsus · subadult' },
  ],
};

// Ontogenetic (growth-series) comparisons: several growth stages of ONE taxon, drawn to a common
// scale on that taxon's own page (flagged by `growthSeries` in the .md; keyed <taxon-slug>-growth).
// Maiasaura is bonebed-derived, so each stage is composited to size rather than a single specimen —
// lengths are given here (widthM ≈ lengthM per the owner) instead of read from per-stage entries.
const GROWTH_GROUPS = {
  'maiasaura-peeblesorum-growth': [
    { file: 'maiasaura-peeblesorum-hatchling-skeletal.png', lengthM: 0.5, label: 'Hatchling' },
    { file: 'maiasaura-peeblesorum-yearling-skeletal.png', lengthM: 2.75, label: 'Yearling' },
    { file: 'maiasaura-peeblesorum-subadult-two-years-skeletal.png', lengthM: 5, label: 'Subadult · 2 yr' },
    { file: 'maiasaura-peeblesorum-adult-skeletal.png', lengthM: 7, label: 'Adult' },
  ],
  // Postosuchus: two real specimens (adult + subadult), not bonebed composites — so widthM is given
  // per stage (horizontal extent differs from length in this semi-erect posture).
  'postosuchus-kirkpatricki-growth': [
    { file: 'postosuchus-kirkpatricki-ttup-9002-skeletal-juvenile.png', lengthM: 3.8, widthM: 3.73, label: 'Subadult · TTUP 9002' },
    { file: 'postosuchus-kirkpatricki-ttup-9000-skeletal.png', lengthM: 5, widthM: 4.89, label: 'Adult · TTUP 9000' },
  ],
  // Hypacrosaurus stebingeri: adult + juvenile of ONE species (the juvenile was formerly mislabelled
  // H. altispinus, which collapsed a would-be genus hub into this growth series). Juvenile silhouette
  // is the owner's hand-corrected trace (the auto-trace bridged the overlapping fore/hind limbs).
  'hypacrosaurus-stebingeri-growth': [
    { file: 'hypacrosaurus-stebingeri-juvenile-silhouette.png', lengthM: 1, label: 'Juvenile' },
    { file: 'hypacrosaurus-stebingeri-adult-skeletal.png', lengthM: 5, widthM: 4.92, label: 'Adult' },
  ],
};

// widthM → a spreadable {widthM} only when it's a real number, so absent values stay out of the JSON.
const wm = (v) => (Number.isFinite(v) ? { widthM: v } : {});
const numField = (txt, key) => {
  const m = txt.match(new RegExp(`\\b${key}:\\s*([\\d.]+)`));
  return m ? parseFloat(m[1]) : undefined;
};
const entryDims = (g) => {
  const file = g.specimen ? `src/content/specimens/${g.specimen}.md` : `src/content/taxa/${g.taxon}.md`;
  const txt = readFileSync(file, 'utf8');
  return { lengthM: numField(txt, 'lengthM') ?? null, widthM: numField(txt, 'widthM') };
};

// specimen slug → owner silhouette file, so the specimen pass prefers it over raster tracing.
const silBySpecimen = {};
for (const group of Object.values(GENUS_GROUPS))
  for (const g of group) if (g.specimen) silBySpecimen[g.specimen] = g.file;
// Overlay specimens with an owner body silhouette outside the genus groups — the Archaeopteryx pair,
// so the Archaeopteryx hub's scale comparison shows both specimens (Thermopolis + Chicago).
Object.assign(silBySpecimen, {
  'archaeopteryx-thermopolis': 'archaeopteryx-lithographica-thermopolis-specimen-silhouette.png',
  'archaeopteryx-chicago': 'archaeopteryx-chicago-specimen-silhouette.png',
});

const out = {};

// ----- pass 1: every overlay specimen (owner silhouette if present, else raster trace) -----
const dir = 'src/content/specimens';
const specs = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => readSpecimen(join(dir, f)))
  .filter((s) => s.overlay && s.traceSrc);

for (const s of specs.sort((a, b) => b.lengthM - a.lengthM)) {
  const ownerSil = silBySpecimen[s.slug];
  const useSil = ownerSil && existsSync(join('silhouettes', ownerSil));
  const { w, h, path, points } = useSil
    ? await traceImage(join('silhouettes', ownerSil), { alpha: true })
    : await traceImage(join('public', s.traceSrc.replace(/^\//, '')), { alpha: false });
  (out[s.taxon] ??= []).push({ slug: s.slug, label: s.nickname || s.catalog, lengthM: s.lengthM, ...wm(s.widthM), w, h, path });
  console.log(`${s.taxon}/${s.slug}: ${s.lengthM} m${Number.isFinite(s.widthM) ? ` (w ${s.widthM} m)` : ''}  bbox ${w}x${h}  ${points} pts${useSil ? '  (silhouette)' : ''}`);
}

// ----- pass 2: curated genus comparisons from owner silhouettes -----
for (const [key, group] of Object.entries(GENUS_GROUPS)) {
  const items = [];
  for (const g of group) {
    const file = join('silhouettes', g.file);
    if (!existsSync(file)) {
      console.log(`(skip ${key}: missing ${g.file})`);
      continue;
    }
    const { lengthM, widthM } = entryDims(g);
    const { w, h, path, points } = await traceImage(file, { alpha: true });
    items.push({ slug: g.specimen || g.taxon, label: g.label, lengthM, ...wm(widthM), w, h, path });
    console.log(`${key}/${g.label}: ${lengthM} m${Number.isFinite(widthM) ? ` (w ${widthM} m)` : ''}  bbox ${w}x${h}  ${points} pts`);
  }
  if (items.length) out[key] = items.sort((a, b) => b.lengthM - a.lengthM);
}

// ----- pass 2b: ontogenetic growth series (owner silhouettes, per-stage lengths) -----
for (const [key, group] of Object.entries(GROWTH_GROUPS)) {
  const items = [];
  for (const g of group) {
    const file = join('silhouettes', g.file);
    if (!existsSync(file)) { console.log(`(skip ${key}: missing ${g.file})`); continue; }
    const { w, h, path, points, holes } = await traceImage(file, { alpha: true });
    items.push({ slug: g.file.replace(/\.png$/, ''), label: g.label, lengthM: g.lengthM, widthM: g.widthM ?? g.lengthM, w, h, path });
    console.log(`${key}/${g.label}: ${g.lengthM} m  bbox ${w}x${h}  ${points} pts${holes ? `  (${holes} hole${holes > 1 ? 's' : ''} cut)` : ''}`);
  }
  if (items.length) out[key] = items.sort((a, b) => b.lengthM - a.lengthM);
}

// ----- pass 3: taxon-level silhouettes for the compare-tool catalog -----
// Every full-body owner silhouette whose taxon already exists gets a taxon-keyed entry, so the
// /compare/ catalog grows on its own. Partial (known-material/elements) silhouettes are skipped —
// they don't span the full body, so length-scaling them would be wrong. Genus-grouped taxa
// (pass 2) and overlay specimens (pass 1) are left to those passes.
const SIL_DIR = 'silhouettes';
const NON_TAXON = new Set(['psittacosaurus-glyph.png', 'Humans.png']);
// Every one of these is a full-body body-envelope silhouette — including the "known-material/
// elements" ones (the owner sometimes traces the silhouette off the known-material drawing; the
// silhouette is still the whole animal regardless of how complete the real fossil is). So a known-*
// file is only DEMOTED, never dropped: it's used as the fallback when a taxon has no plain -skeletal
// silhouette (e.g. Puertasaurus), and skipped only as a duplicate when a plain skeletal exists.
const isKnown = (f) => /known-(material|elements|remains)/i.test(f);
// A silhouette source carries one of these tokens (README convention) — keeping the keyword
// requirement means a stray non-silhouette PNG dropped in the folder won't get traced by accident.
const isSilFile = (f) => /silhouette|skeletal|known-(material|elements|remains)/i.test(f);
const taxonSlugOf = (f) => {
  const t = f.replace(/\.png$/i, '').toLowerCase().split('-');
  return `${t[0]}-${t[1]}`;
};

// Source files that aren't clean body-only silhouettes yet (scale humans / ground line baked in).
// Drop until a body-only version is supplied; then remove from this set and it auto-ingests.
const SKIP_SLUGS = new Set();

// Owner silhouettes that shouldn't drive a taxon's compare entry yet: a second specimen shown only as
// a page figure (Barosaurus ROM 3670), and a juvenile whose ontogeny-comparison structure isn't settled
// (Sinornithosaurus "Dave", NGMC 91). They stay in the folder — just not ingested as the taxon's silhouette.
const SKIP_FILES = new Set([
  'barosaurus-lentus-rom-3670-silhouette.png',
  'sinornithosaurus-millenii-ngmc-91-dave-skeletal.png',
  // Maiasaura growth stages — labelled figures on the taxon page, not the taxon's overlay silhouette
  // (the adult is). They stay for a future growth-series comparison.
  'maiasaura-peeblesorum-hatchling-skeletal.png',
  'maiasaura-peeblesorum-yearling-skeletal.png',
  'maiasaura-peeblesorum-subadult-two-years-skeletal.png',
  // Kentrosaurus alternate hip-based spine placement — a hypothesis figure, not the body silhouette.
  'kentrosaurus-aethiopicus-skeletal-with-alternaive-hip-based-spine-placement.png',
  // Hypacrosaurus stebingeri: the ADULT -skeletal is the taxon's overlay/gallery silhouette; the combined
  // plate and the juvenile silhouette are the growth-series figures/stages, not the taxon silhouette.
  'hypacrosaurus-stebingeri-adult-and-juvenile-skeletals.png',
  'hypacrosaurus-stebingeri-juvenile-silhouette.png',
  // Balaenoptera feeding-behavior pose (ballooned throat pleats) — a page figure, not the body
  // envelope; the plain -skeletal.png is the silhouette the overlay/compare catalog should scale.
  'balaenoptera-musculus-skeletal-feeding-behavior.png',
  // Platypus credited copy — duplicate of -skeletal-male.png; use the plain one for tracing.
  'ornithorhynchus-anatinus-skeletal-male-credited.png',
]);
const filesByTaxon = {};
for (const f of readdirSync(SIL_DIR))
  if (/\.png$/i.test(f) && !NON_TAXON.has(f) && !SKIP_FILES.has(f) && isSilFile(f)) (filesByTaxon[taxonSlugOf(f)] ??= []).push(f);

const catalogAdds = [];
for (const [slug, fs] of Object.entries(filesByTaxon).sort()) {
  if (SKIP_SLUGS.has(slug)) {
    console.log(`(skip ${slug}: silhouette has embedded scale figures — needs a body-only version)`);
    continue;
  }
  if (GENUS_GROUPS[slug.split('-')[0]]) continue; // curated genus group owns these
  if (out[slug]) continue; // already produced by the overlay-specimen pass
  const taxPath = `src/content/taxa/${slug}.md`;
  if (!existsSync(taxPath)) continue; // taxon page not built yet — wait for its .md
  const taxTxt = readFileSync(taxPath, 'utf8');
  const lm = taxTxt.match(/\blengthM:\s*([\d.]+)/);
  if (!lm) continue; // no numeric length → can't scale it
  const lengthM = parseFloat(lm[1]);
  const widthM = numField(taxTxt, 'widthM'); // optional horizontal-extent override for the overlay
  // Prefer a plain skeletal silhouette; fall back to a known-* one only when that's all there is.
  const pick =
    fs.find((f) => /-silhouette\.png$/i.test(f) && !isKnown(f)) ??
    fs.find((f) => /without-armor/i.test(f)) ??
    fs.find((f) => /-skeletal/i.test(f) && !/with-armor/i.test(f) && !isKnown(f)) ??
    fs.find((f) => !isKnown(f)) ??
    fs[0]; // only a known-material silhouette exists (e.g. Puertasaurus) — still full-body
  const { w, h, path, points, holes } = await traceImage(join(SIL_DIR, pick), { alpha: true });
  out[slug] = [{ slug, label: binomial(slug), lengthM, ...wm(widthM), w, h, path }];
  catalogAdds.push(slug);
  console.log(`taxon ${slug}: ${lengthM} m  bbox ${w}x${h} (ar ${(w / h).toFixed(2)})  ${points} pts${holes ? `  (${holes} hole${holes > 1 ? 's' : ''} cut)` : ''}  <- ${pick}`);
}
console.log(`\npass 3 added ${catalogAdds.length} taxon silhouettes to the catalog`);

// ----- human scale reference (owner's adult + child silhouette) -----
const humanFile = join(SIL_DIR, 'Humans.png');
if (existsSync(humanFile)) {
  const human = await traceHuman(humanFile);
  writeFileSync('src/data/human.json', JSON.stringify(human, null, 2));
  console.log(`human: bbox ${human.w}x${human.h} (ar ${(human.w / human.h).toFixed(2)}), ${human.figures} figures`);
}

writeFileSync('src/data/silhouettes.json', JSON.stringify(out, null, 2));
console.log(`\nWrote src/data/silhouettes.json (${Object.values(out).flat().length} silhouettes across ${Object.keys(out).length} groups)`);
