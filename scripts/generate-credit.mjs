// One-time (rare) generator for the baked-in image credit stamp.
//
// Converts the fixed credit string into VECTOR OUTLINES (IBM Plex Mono) and
// writes scripts/credit.svg. Doing this once means the ongoing watermark tool
// needs no font installed and no font-rendering dependency — it just scales and
// composites this vector stamp. Re-run only to change the text/font/spacing/color:
//   node scripts/generate-credit.mjs
//
// Tunables below are matched to the existing handoff drawings (see watermark.mjs).

import opentype from 'opentype.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TEXT = '© SCOTT HARTMAN · SKELETALDRAWING.COM';
const FONT_URL =
  'https://cdn.jsdelivr.net/gh/IBM/plex@v6.4.0/IBM-Plex-Mono/fonts/complete/ttf/IBMPlexMono-Regular.ttf';
const FILL = '#5C636B'; // design --slate; reads as the discreet gray at small size
const LETTER_SPACING_EM = 0.05; // tracking; tuned so size matches the existing credit
const FONT_SIZE = 100; // arbitrary internal unit; the SVG is scaled at composite time

const here = dirname(fileURLToPath(import.meta.url));

const res = await fetch(FONT_URL);
if (!res.ok) throw new Error(`Font fetch failed: ${res.status} ${FONT_URL}`);
const font = opentype.parse(await res.arrayBuffer());

const tracking = LETTER_SPACING_EM * FONT_SIZE;
const full = new opentype.Path();
let x = 0;
for (const g of font.stringToGlyphs(TEXT)) {
  full.extend(g.getPath(x, 0, FONT_SIZE));
  x += (g.advanceWidth / font.unitsPerEm) * FONT_SIZE + tracking;
}

const bb = full.getBoundingBox();
const w = bb.x2 - bb.x1;
const h = bb.y2 - bb.y1;
// Rasterize crisply: give the SVG a large intrinsic size (downscaled at composite time).
const scale = 2000 / w;
const W = Math.round(w * scale);
const H = Math.round(h * scale);
const d = full.toPathData(2);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${bb.x1.toFixed(2)} ${bb.y1.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}"><path d="${d}" fill="${FILL}"/></svg>\n`;

writeFileSync(join(here, 'credit.svg'), svg);
console.log(`wrote scripts/credit.svg  intrinsic ${W}x${H}  (aspect ${(w / h).toFixed(2)}:1)`);
console.log(`text: "${TEXT}"  fill ${FILL}  tracking ${LETTER_SPACING_EM}em`);
