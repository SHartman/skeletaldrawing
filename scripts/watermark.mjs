// Stamp the baked-in credit onto a clean skeletal drawing — consistently.
//
//   npm run credit -- path/to/drawing.png            → drawing-credited.png (same folder)
//   npm run credit -- path/to/drawing.png out.png     → explicit output file
//   npm run credit -- path/to/folder                  → folder-credited/ (batch, all images)
//   npm run credit -- path/to/folder  path/to/outdir  → batch into a chosen folder
//
// Non-destructive: originals are never modified; output always goes to a new file/folder.
// The credit (scripts/credit.svg, IBM Plex Mono outlines) is scaled to a fixed fraction of
// each image's width and placed bottom-right, so every drawing matches regardless of export
// resolution. Defaults are measured from the existing handoff drawings.

import sharp from 'sharp';
import { readFile, readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CREDIT_SVG = join(here, 'credit.svg');

const WIDTH_FRAC = 0.25; // credit width as a fraction of image width
const PAD_FRAC = 0.02; // padding from right & bottom edges (fraction of image width)
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

async function stampOne(inputPath, outputPath) {
  const svg = await readFile(CREDIT_SVG);
  const img = sharp(inputPath);
  const { width: W, height: H } = await img.metadata();
  if (!W || !H) throw new Error(`Could not read dimensions: ${inputPath}`);

  const creditW = Math.round(W * WIDTH_FRAC);
  const pad = Math.round(W * PAD_FRAC);
  const credit = await sharp(svg).resize({ width: creditW }).png().toBuffer();
  const { height: creditH } = await sharp(credit).metadata();

  const left = W - creditW - pad;
  const top = H - (creditH ?? 0) - pad;
  await img.composite([{ input: credit, left, top }]).png().toFile(outputPath);
  return { W, H, creditW, left, top };
}

function usage() {
  console.error('Usage: npm run credit -- <input.png | folder> [output]');
  process.exit(1);
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) usage();

const info = await stat(inputArg).catch(() => null);
if (!info) {
  console.error(`Not found: ${inputArg}`);
  process.exit(1);
}

if (info.isDirectory()) {
  const outDir = outputArg || `${inputArg.replace(/[\\/]+$/, '')}-credited`;
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(inputArg)).filter((f) => EXTS.has(extname(f).toLowerCase()));
  if (files.length === 0) {
    console.error(`No images (${[...EXTS].join(', ')}) found in ${inputArg}`);
    process.exit(1);
  }
  console.log(`Stamping ${files.length} image(s) → ${outDir}`);
  for (const f of files) {
    const out = join(outDir, `${basename(f, extname(f))}.png`);
    const r = await stampOne(join(inputArg, f), out);
    console.log(`  ✓ ${f}  (${r.W}×${r.H})`);
  }
  console.log('Done.');
} else {
  const out =
    outputArg || join(dirname(inputArg), `${basename(inputArg, extname(inputArg))}-credited.png`);
  const r = await stampOne(inputArg, out);
  console.log(`✓ ${out}  (${r.W}×${r.H}; credit ${r.creditW}px at ${r.left},${r.top})`);
}
