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
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TRACE_WIDTH = 1000; // downscale target — plenty for a simplified outline
const BLACK = 128; // luminance threshold (0–255) below which a pixel is "flesh"
const CLOSE = 6; // morphological-close radius (px) — seals mouth/rib gaps before fill
const RDP_EPS = 1.4; // simplify tolerance in downscaled px

// ----- minimal frontmatter read (flat fields + one nested image src) -----
function readSpecimen(file) {
  const txt = readFileSync(file, 'utf8');
  const fm = txt.split('---')[1] ?? '';
  const get = (re) => (fm.match(re)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  const overlay = /overlay:\s*true/.test(fm);
  const taxon = get(/\btaxon:\s*([^\n]+)/);
  const lengthM = parseFloat(get(/\blengthM:\s*([\d.]+)/));
  const nickname = get(/\bnickname:\s*([^\n]+)/);
  const catalog = get(/\bcatalog:\s*([^\n]+)/);
  const reconSrc = get(/reconstruction:\s*\n\s*src:\s*([^\n]+)/);
  const rigorousSrc = get(/rigorous:\s*\n\s*src:\s*([^\n]+)/);
  const slug = file.split(/[\\/]/).pop().replace(/\.md$/, '');
  // Known-material image is the cleaner silhouette source; fall back to reconstruction.
  const traceSrc = rigorousSrc || reconSrc;
  return { slug, taxon, overlay, lengthM, nickname, catalog, traceSrc };
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

async function traceImage(publicSrc) {
  const file = join('public', publicSrc.replace(/^\//, ''));
  const { data, info } = await sharp(file)
    .flatten({ background: '#ffffff' })
    .resize({ width: TRACE_WIDTH })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height;
  const mask0 = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask0[i] = data[i * info.channels] < BLACK ? 1 : 0;

  // Morphological CLOSE with fill: dilate to seal the thin white channels where a
  // bone void opens to the exterior (mouth gap, gaps between ribs), fill the now-
  // enclosed voids, then erode back to the true body size.
  const mask = morph(mask0, W, H, CLOSE, true);

  // Fill enclosed voids: flood the white background in from the border; any pixel it
  // can't reach (black flesh OR white bone now sealed inside the body) becomes solid.
  const outside = new Uint8Array(W * H);
  const q = [];
  const seed = (x, y) => {
    const i = y * W + x;
    if (!mask[i] && !outside[i]) {
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
  const sil = morph(filled, W, H, CLOSE, false); // erode back: undo the dilation

  const big = largestComponent(sil, W, H);
  let contour = traceBoundary(big, W, H);
  contour = rdp(contour, RDP_EPS);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of contour) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = +(maxX - minX).toFixed(1),
    h = +(maxY - minY).toFixed(1);
  const path =
    contour
      .map(([x, y], i) => `${i ? 'L' : 'M'}${+(x - minX).toFixed(1)} ${+(y - minY).toFixed(1)}`)
      .join('') + 'Z';
  return { w, h, path, points: contour.length };
}

// ----- run over all overlay specimens -----
const dir = 'src/content/specimens';
const specs = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => readSpecimen(join(dir, f)))
  .filter((s) => s.overlay && s.traceSrc);

const out = {};
for (const s of specs.sort((a, b) => b.lengthM - a.lengthM)) {
  const { w, h, path, points } = await traceImage(s.traceSrc);
  (out[s.taxon] ??= []).push({
    slug: s.slug,
    label: s.nickname || s.catalog,
    lengthM: s.lengthM,
    w,
    h,
    path,
  });
  console.log(`${s.taxon}/${s.slug}: ${s.lengthM} m  bbox ${w}x${h}  ${points} pts  aspect ${(w / h).toFixed(2)}:1`);
}

writeFileSync('src/data/silhouettes.json', JSON.stringify(out, null, 2));
console.log(`\nWrote src/data/silhouettes.json (${Object.values(out).flat().length} silhouettes)`);
