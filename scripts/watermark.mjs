// Prepare a clean skeletal drawing for the site: auto-crop to a consistent
// margin, then stamp the baked-in credit. One pass, every image identical.
//
//   npm run credit -- drawing.png                 → drawing-credited.png
//   npm run credit -- drawing.png out.png          → explicit output
//   npm run credit -- folder                       → folder-credited/ (batch)
//   npm run credit -- folder outdir                → batch into chosen folder
//
//   Flags:  --no-trim          skip auto-crop (just stamp)
//           --margin <pct>     white margin to leave around content (default 1.5)
//
// Auto-crop finds the bounding box of all non-white content (skeleton + scale
// bar), then re-frames it with a uniform white margin — so however you export,
// every drawing ends up tightly and identically framed. The credit is then
// scaled to 25% width and placed bottom-right at 2% padding. Non-destructive:
// originals are never touched. If the cropped drawing intrudes into the credit
// zone, the run WARNS so you can check that image.

import sharp from 'sharp';
import { readFile, readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CREDIT_SVG = join(here, 'credit.svg');

const WIDTH_FRAC = 0.25; // credit width as a fraction of image width
const PAD_FRAC = 0.02; // credit padding from right & bottom (fraction of width)
const DEFAULT_MARGIN_PCT = 1.5; // white margin left around content when trimming
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// Bounding box of non-white, non-transparent pixels.
function contentBBox(data, w, h, ch) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const alpha = ch === 4 ? data[i + 3] : 255;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (alpha > 16 && lum < 250) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

// Fraction of a rectangle occupied by dark (drawing) pixels — for the credit-zone guard.
function darkFraction(data, w, h, ch, rect) {
  const x1 = Math.max(0, rect.left), y1 = Math.max(0, rect.top);
  const x2 = Math.min(w, rect.left + rect.width), y2 = Math.min(h, rect.top + rect.height);
  let dark = 0, total = 0;
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const i = (y * w + x) * ch;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      total++;
      if (lum < 180) dark++;
    }
  }
  return total ? dark / total : 0;
}

async function processOne(inputPath, outputPath, { trim, marginPct }) {
  let base = await sharp(inputPath).png().toBuffer();

  if (trim) {
    const { data, info } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bb = contentBBox(data, info.width, info.height, info.channels);
    if (bb) {
      const cw = bb.maxX - bb.minX + 1;
      const ch = bb.maxY - bb.minY + 1;
      const margin = Math.round(Math.max(cw, ch) * (marginPct / 100));
      base = await sharp(base)
        .extract({ left: bb.minX, top: bb.minY, width: cw, height: ch })
        .extend({ top: margin, bottom: margin, left: margin, right: margin, background: '#ffffff' })
        .png()
        .toBuffer();
    }
  }

  const { width: W, height: H } = await sharp(base).metadata();
  const creditW = Math.round(W * WIDTH_FRAC);
  const pad = Math.round(W * PAD_FRAC);
  const credit = await sharp(await readFile(CREDIT_SVG)).resize({ width: creditW }).png().toBuffer();
  const creditH = (await sharp(credit).metadata()).height ?? 0;
  const left = Math.max(0, W - creditW - pad);
  const top = Math.max(0, H - creditH - pad);

  // credit-zone collision guard
  const { data, info } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frac = darkFraction(data, info.width, info.height, info.channels, {
    left, top, width: creditW, height: creditH,
  });

  await sharp(base).composite([{ input: credit, left, top }]).png().toFile(outputPath);
  return { W, H, collision: frac > 0.01 };
}

function usage() {
  console.error('Usage: npm run credit -- <input.png | folder> [output] [--no-trim] [--margin <pct>]');
  process.exit(1);
}

// ---- args ----
const argv = process.argv.slice(2);
let trim = true, marginPct = DEFAULT_MARGIN_PCT;
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--no-trim') trim = false;
  else if (a === '--margin') marginPct = parseFloat(argv[++i]);
  else if (a.startsWith('--margin=')) marginPct = parseFloat(a.slice(9));
  else pos.push(a);
}
const [inputArg, outputArg] = pos;
if (!inputArg) usage();
if (!Number.isFinite(marginPct) || marginPct < 0) {
  console.error('Invalid --margin value');
  process.exit(1);
}

const info = await stat(inputArg).catch(() => null);
if (!info) {
  console.error(`Not found: ${inputArg}`);
  process.exit(1);
}

const opts = { trim, marginPct };
const warn = (r, name) => (r.collision ? `   ⚠ drawing intrudes into the credit zone — check ${name}` : '');

if (info.isDirectory()) {
  const outDir = outputArg || `${inputArg.replace(/[\\/]+$/, '')}-credited`;
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(inputArg)).filter((f) => EXTS.has(extname(f).toLowerCase()));
  if (files.length === 0) {
    console.error(`No images (${[...EXTS].join(', ')}) found in ${inputArg}`);
    process.exit(1);
  }
  console.log(`Stamping ${files.length} image(s)${trim ? ` (trim, ${marginPct}% margin)` : ''} → ${outDir}`);
  let warned = 0;
  for (const f of files) {
    const r = await processOne(join(inputArg, f), join(outDir, `${basename(f, extname(f))}.png`), opts);
    if (r.collision) warned++;
    console.log(`  ✓ ${f}  (${r.W}×${r.H})${warn(r, f)}`);
  }
  console.log(`Done${warned ? ` — ${warned} image(s) flagged for review` : ''}.`);
} else {
  const out = outputArg || join(dirname(inputArg), `${basename(inputArg, extname(inputArg))}-credited.png`);
  const r = await processOne(inputArg, out, opts);
  console.log(`✓ ${out}  (${r.W}×${r.H})${warn(r, basename(inputArg))}`);
}
