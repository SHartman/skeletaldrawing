/**
 * Check every skeletal drawing against its own baked-in scale bar.
 *
 * The site states a length for each animal and the drawing states its own scale, and nothing had ever
 * compared the two. This measures the animal's horizontal extent in pixels, divides by the bar's
 * pixel length, multiplies by what the entry says the bar represents, and compares the result with
 * the number the renderer actually scales by (`widthM`, falling back to `lengthM`).
 *
 * It found, among other things, that Giganotosaurus and Sue disagree with their own drawings in
 * OPPOSITE directions — a 6.5% relative error that flips which animal is longer, reported by a reader
 * and confirmed here — and three pages captioned "Scale bar = 1 meter" over 50 cm and 10 cm bars.
 *
 * Warns, never fails: like check-images.mjs, a measurement disagreement is a question for the author,
 * not a reason to block a deploy. Most valuable on BATCH additions, where one bad assumption repeats.
 *
 *   node scripts/check-scalebars.mjs              # audit everything
 *   node scripts/check-scalebars.mjs --csv out.csv
 *   node scripts/check-scalebars.mjs --diag <png> # dump one image's components, to tune detection
 */
import sharp from 'sharp';
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';

const DIRS = ['src/content/taxa', 'src/content/specimens'];
const TOLERANCE = 3; // percent; below this is measurement noise + honest rounding

const metres = (s) => {
  const m = (s || '').replace(/['"]/g, '').match(/([\d.]+)\s*(meters?|metres?|m\b|centimeters?|centimetres?|cm)/i);
  return m ? (/^c/i.test(m[2]) ? parseFloat(m[1]) / 100 : parseFloat(m[1])) : null;
};
const flat = (txt, k) => (txt.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const reconSrc = (txt) => (txt.match(/^reconstruction:\s*\n(?:\s+\w+:.*\n)*?\s+src:\s*(.+)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');

/** Connected components of the ink (4-neighbour), largest first. */
async function components(file) {
  const img = sharp(file).flatten({ background: '#fff' }).greyscale();
  const { width: W, height: H } = await img.metadata();
  const buf = await img.raw().toBuffer();
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = buf[i] < 128 ? 1 : 0;
  const label = new Int32Array(W * H);
  const comps = [];
  const st = [];
  let cur = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s]) continue;
    cur++;
    let size = 0, minX = W, minY = H, maxX = 0, maxY = 0;
    st.push(s); label[s] = cur;
    while (st.length) {
      const p = st.pop(); size++;
      const x = p % W, y = (p / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = cur; st.push(p - 1); }
      if (x < W - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = cur; st.push(p + 1); }
      if (y > 0 && mask[p - W] && !label[p - W]) { label[p - W] = cur; st.push(p - W); }
      if (y < H - 1 && mask[p + W] && !label[p + W]) { label[p + W] = cur; st.push(p + W); }
    }
    comps.push({ size, minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, fill: size / ((maxX - minX + 1) * (maxY - minY + 1)) });
  }
  comps.sort((a, b) => b.size - a.size);
  return { W, H, comps };
}

/**
 * The bar is a SOLID filled rectangle — that is what separates it from everything else thin and wide
 * in these drawings. An earlier version ranked candidates by width alone and picked Rhamphorhynchus'
 * detached wing membrane (1558 px) over its actual bar, then reported the animal as 80% too small.
 * Requiring near-total fill discriminates cleanly: every bar measured so far fills 0.96–1.00 of its
 * bounding box, while anatomy and lettering never come close.
 */
function findBar(comps, W) {
  // Width cap on top of that: some plates carry a full-width rule along the baseline, which is also a
  // solid thin rectangle. Every bar measured across this catalogue falls between 8% and 26% of the
  // image width (Herrerasaurus 8.6%, Rhamphorhynchus 10.5%, Gastornis 22%, Archaeopteryx 26%), while
  // Rhamphorhynchus' baseline rule is 52% — so 40% separates them with room on both sides.
  const cands = comps
    .slice(1)
    .filter((c) => c.w >= 40 && c.h <= 60 && c.w / c.h >= 8 && c.fill >= 0.85 && c.w <= W * 0.4);
  if (!cands.length) return null;
  cands.sort((a, b) => b.w - a.w);
  // Several bars can be genuine — a two-view plate carries one per figure. That is fine as long as
  // they agree; report it only when choosing differently would change the answer.
  const rival = cands.find((c) => Math.abs(cands[0].w / c.w - 1) * 100 > TOLERANCE);
  return { ...cands[0], ambiguous: rival ? cands.length : 0 };
}

// ----- diagnostic mode: one image, so detection can be tuned against real art -----
const diagIdx = process.argv.indexOf('--diag');
if (diagIdx > -1) {
  const file = process.argv[diagIdx + 1];
  const { W, H, comps } = await components(file);
  console.log(`${file}\n${W}x${H}, ${comps.length} components`);
  console.log('rank      size   bbox(x,y)          w     h   aspect   fill   <- bar?');
  comps.slice(0, 12).forEach((c, i) => {
    const b = findBar(comps, W); const isBar = b && c.minX === b.minX && c.minY === b.minY;
    console.log(
      String(i).padStart(4), String(c.size).padStart(9),
      `(${String(c.minX).padStart(5)},${String(c.minY).padStart(5)})`.padEnd(15),
      String(c.w).padStart(5), String(c.h).padStart(5),
      (c.w / c.h).toFixed(2).padStart(8), c.fill.toFixed(2).padStart(6),
      isBar ? '   <-- picked' : '',
    );
  });
  process.exit(0);
}

// ----- audit -----
const rows = [];
const files = DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`)).sort();
for (const path of files) {
  const slug = path.replace(/^src\/content\//, '').replace(/\.md$/, '');
  const txt = readFileSync(path, 'utf8');
  const barM = metres(flat(txt, 'scaleBar'));
  const src = reconSrc(txt);
  const widthM = parseFloat(flat(txt, 'widthM'));
  const lengthM = parseFloat(flat(txt, 'lengthM'));
  const drawnAs = Number.isFinite(widthM) ? widthM : lengthM;
  const push = (status, extra = {}) =>
    rows.push({ slug, status, barM: barM ?? '', drawnAs: Number.isFinite(drawnAs) ? drawnAs : '', usedField: Number.isFinite(widthM) ? 'widthM' : 'lengthM', ...extra });

  if (/^underRevision:\s*true/m.test(txt)) { push('under-revision'); continue; }
  if (!barM) { push('no-scaleBar'); continue; }
  if (!src) { push('no-reconstruction'); continue; }
  if (!existsSync('public' + src)) { push('image-missing'); continue; }
  if (!Number.isFinite(drawnAs)) { push('no-length'); continue; }
  try {
    const { W, comps } = await components('public' + src);
    const bar = findBar(comps, W);
    if (!bar) { push('bar-not-detected', { animalPx: comps[0].w }); continue; }
    const measured = (comps[0].w / bar.w) * barM;
    const diffPct = (measured / drawnAs - 1) * 100;
    push(Math.abs(diffPct) > TOLERANCE ? 'FLAG' : 'ok', {
      animalPx: comps[0].w, barPx: bar.w, measured: measured.toFixed(3), diffPct: diffPct.toFixed(1), note: bar.ambiguous ? bar.ambiguous + ' bar candidates disagree' : '',
    });
  } catch (e) { push('error', { note: e.message.slice(0, 60) }); }
}

const csvIdx = process.argv.indexOf('--csv');
if (csvIdx > -1) {
  const cols = ['slug', 'status', 'barM', 'drawnAs', 'usedField', 'animalPx', 'barPx', 'measured', 'diffPct', 'note'];
  writeFileSync(process.argv[csvIdx + 1], cols.join(',') + '\n' + rows.map((r) => cols.map((c) => `"${r[c] ?? ''}"`).join(',')).join('\n'));
}

const by = {};
for (const r of rows) by[r.status] = (by[r.status] || 0) + 1;
console.log('\nscale-bar check: ' + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', '));
const flags = rows.filter((r) => r.status === 'FLAG').sort((a, b) => Math.abs(+b.diffPct) - Math.abs(+a.diffPct));
for (const r of flags)
  console.log(`  !! ${r.slug}: entry ${r.drawnAs} m, drawing measures ${r.measured} m (${r.diffPct > 0 ? '+' : ''}${r.diffPct}%, bar ${r.barM} m = ${r.barPx} px)`);
for (const r of rows.filter((r) => r.status === 'bar-not-detected'))
  console.log(`  ?? ${r.slug}: no scale bar found — check the drawing, or tune findBar with --diag`);
if (flags.length) console.log('   (warning only; a disagreement is a question for the author, not a build failure)');
