/**
 * Auto-link italicised taxon names in taxa/specimen bodies to their pages.
 *
 * Why build-time rather than baked into the Markdown: it is self-healing. A mention of a taxon that
 * has no page yet is simply left alone, and becomes a link automatically the day that page exists —
 * no revisiting old entries. (CLAUDE.md §3: internal links spread the domain's authority onto the
 * per-taxon pages, which is the whole point of the rebuild.)
 *
 * It matches only EMPHASIS nodes, never raw text. The owner italicises scientific names
 * consistently, so this is precise and effectively false-positive free — and because it works on the
 * parsed AST it can never nest a link inside an existing one or touch code spans.
 *
 * Rules:
 *   - never link a page to itself (its own binomial or genus — 73% of all mentions)
 *   - first mention of a given target per page only
 *   - genus resolves to that taxon's page, or to the synthetic genus hub when >=2 species share it
 *   - punctuation caught inside the italics is moved outside the link
 *   - abbreviated forms (_A. fragilis_) are deliberately skipped: resolving them needs context
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TAXA_DIR = 'src/content/taxa';
const TRAILING = /[.,;:!?)\]]+$/;

function buildCatalog() {
  const taxa = [];
  for (const f of readdirSync(TAXA_DIR)) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    const txt = readFileSync(join(TAXA_DIR, f), 'utf8');
    const end = txt.indexOf('---', 3);
    const fm = end === -1 ? '' : txt.slice(0, end);
    const name = (fm.match(/^taxon:\s*"?(.+?)"?\s*$/m) || [])[1];
    const gallery = (fm.match(/^gallery:\s*"?(.+?)"?\s*$/m) || [])[1];
    if (!name || !gallery) continue;
    taxa.push({ slug: f.replace(/\.md$/, ''), name: name.trim(), gallery: gallery.trim(), genus: name.trim().split(/\s+/)[0] });
  }

  const slugSet = new Set(taxa.map((t) => t.slug));
  const byBinomial = new Map();
  for (const t of taxa) byBinomial.set(t.name.toLowerCase(), `/${t.gallery}/${t.slug}/`);

  // Mirror the router's synthetic genus hub: a gallery+genus with >=2 taxa and no taxon on that slug.
  const groups = new Map();
  for (const t of taxa) {
    const k = `${t.gallery}|${t.genus}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const byGenus = new Map();
  for (const [k, list] of groups) {
    const [gallery, genus] = k.split('|');
    const g = genus.toLowerCase();
    const hub = list.length >= 2 && !slugSet.has(g);
    byGenus.set(g, hub ? `/${gallery}/${g}/` : `/${gallery}/${list[0].slug}/`);
  }

  return { byBinomial, byGenus, bySlug: new Map(taxa.map((t) => [t.slug, t])) };
}

// Built once per process. A production build always starts fresh, so it is always current; in dev,
// adding a NEW taxon needs a server restart before its mentions start linking.
let CATALOG = null;
const catalog = () => (CATALOG ??= buildCatalog());

const textOf = (node) =>
  node.type === 'text' ? node.value : Array.isArray(node.children) ? node.children.map(textOf).join('') : '';

export default function remarkTaxonLinks() {
  return (tree, file) => {
    const path = (file?.history?.[0] || file?.path || '').replace(/\\/g, '/');
    if (!/\/src\/content\/(taxa|specimens)\//.test(path)) return; // reference content only

    const { byBinomial, byGenus, bySlug } = catalog();
    const fm = file?.data?.astro?.frontmatter ?? {};
    const selfSlug = path.split('/').pop().replace(/\.md$/, '');

    // A taxon page's own name is its `taxon` binomial; a specimen page belongs to its parent taxon,
    // whose SLUG is that specimen's `taxon` field. Either way, don't link the page to its own animal.
    const own = bySlug.get(selfSlug) ?? (typeof fm.taxon === 'string' ? bySlug.get(fm.taxon) : null);
    const selfNames = new Set();
    let selfUrl = null;
    if (own) {
      selfNames.add(own.name.toLowerCase());
      selfNames.add(own.genus.toLowerCase());
      selfUrl = `/${own.gallery}/${own.slug}/`;
    }

    const linked = new Set();

    const walk = (node, parent, index, inLink) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'code' || node.type === 'inlineCode' || node.type === 'html') return;
      const nowInLink = inLink || node.type === 'link' || node.type === 'linkReference';

      if (!nowInLink && node.type === 'emphasis' && parent && Array.isArray(parent.children)) {
        const raw = textOf(node);
        const clean = raw.replace(TRAILING, '').trim();
        const key = clean.toLowerCase();
        if (clean && !selfNames.has(key) && !/^[A-Z]\.\s/.test(clean)) {
          const url = byBinomial.get(key) ?? byGenus.get(key);
          if (url && url !== selfUrl && !linked.has(url)) {
            linked.add(url);
            const trail = raw.slice(clean.length);
            const link = {
              type: 'link',
              url,
              title: null,
              children: [{ type: 'emphasis', children: [{ type: 'text', value: clean }] }],
            };
            parent.children.splice(index, 1, ...(trail ? [link, { type: 'text', value: trail }] : [link]));
            return; // replaced — don't descend
          }
        }
      }

      // backwards, so splicing a child never shifts an index we still need
      if (Array.isArray(node.children)) for (let i = node.children.length - 1; i >= 0; i--) walk(node.children[i], node, i, nowInLink);
    };

    walk(tree, null, -1, false);
  };
}
