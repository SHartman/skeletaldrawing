import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* ----------------------------------------------------------------------------
   Content collections (Astro Content Layer API).
   Source of truth for the data model is CLAUDE.md §4. Site content lives in
   src/content/**, is committed/pushed, and is what Sveltia will write to.

   Image fields store a PUBLIC path string (+ descriptive alt). That path is
   stable and shareable — good for JSON-LD contentUrl / og:image — and is
   CMS-friendly. Build-time responsive optimization is layered on at render.
   -------------------------------------------------------------------------- */

const imageRef = z.object({
  src: z.string(), // public path, e.g. /images/skeletals/<descriptive-name>.png
  alt: z.string(), // descriptive alt text (taxon + view + length) — hard rule §3
  caption: z.string().optional(), // optional visible caption (used by the blog lead image)
});

// Sveltia materializes empty fields as '' (strings) or null (numbers). Normalize
// those to `undefined` so optional fields stay optional and defaults still apply.
const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const optStr = z.preprocess(blank, z.string().optional());
const optNum = z.preprocess(blank, z.number().optional());
const optDate = z.preprocess(blank, z.coerce.date().optional()); // CMS-stamped "date added"
const defStr = (d: string) => z.preprocess(blank, z.string().default(d));
const nullableDefault = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v == null ? undefined : v), s);

// A bonus figure shown below the main plates. An optional `label` (e.g.
// "Muscle reconstruction") gives it a heading and its own ImageObject; without
// one it renders as a plain figure (e.g. a speculative armor variant).
const figureRef = z.object({
  src: z.string(),
  alt: z.string(),
  label: optStr,
  caption: optStr,
  // For a THIRD-PARTY figure (e.g. a CC-BY paper figure): attribution + a link to the original.
  // The credit names the real authors/journal/licence; source links the paper. Own figures omit both.
  credit: optStr,
  source: optStr,
});

const taxa = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/taxa' }),
  schema: z
    .object({
      taxon: z.string(),                  // binomial, rendered italic
      author: z.string(),                 // bare author citation, e.g. "Osborn, 1905" (no parens)
      commonName: optStr,                 // popular/vernacular name (esp. extant taxa), e.g. "Northern
                                          // Cardinal", "Platypus" — shown under the binomial + searchable
      recombination: nullableDefault(z.boolean().default(false)), // ICZN: parenthesizes the author
      gallery: z.string(),                // section bucket / URL parent, e.g. "sauropods-and-kin"
      clade: z.array(z.string()),         // most-specific clade(s); full lineage derived in lib/clades
      family: optStr,                     // card "family" line; defaults to the most-specific clade
      specimenId: optStr,                 // catalog number, verbatim, e.g. "GPIT/RE/7288"
      specimenName: optStr,               // nickname, e.g. "The Nation's T. rex"
      alsoKnownAs: nullableDefault(z.array(z.string()).default([])),
      lengthM: optNum,                    // numeric meters — sorting + the scale figure (biology: along the spine)
      widthM: optNum,                     // max HORIZONTAL extent in meters, for the scale overlay; falls
                                          // back to lengthM. Corrects upright/raised-neck taxa whose spine
                                          // length overstates their horizontal footprint (see ScaleComparison)
      lengthLabel: optStr,                // display override; else scale-aware (m / cm)
      massKg: optNum,                     // body mass; scale-aware display (kg → tonnes)
      massSource: optStr,                 // provenance, e.g. "PaleoGDI" (future credit/link)
      lifeStage: optStr,                  // e.g. "Juvenile" — renders a record cell
      sex: optStr,                        // e.g. "Male" / "Female" — for sexually dimorphic taxa (mammals,
                                          // pterosaurs). Optional: renders a record cell only when set.
      view: defStr('Left lateral'),
      basis: optStr,
      scaleBar: defStr('1 meter'),        // caption value, spelled out, e.g. "1 meter", "50 centimeters"
      license: defStr('https://www.skeletaldrawing.com/licensing'),
      creditText: defStr('Skeletal reconstruction © Scott Hartman / skeletaldrawing.com'),
      drawingCredit: defStr('© Scott Hartman'), // shown in the plate caption
      reconstruction: nullableDefault(imageRef.optional()), // the hero — present for most taxa
      rigorous: nullableDefault(imageRef.optional()),       // known-material diagram
      additionalFigures: nullableDefault(z.array(figureRef).default([])), // bonus figures
      featured: nullableDefault(z.boolean().default(false)),
      // Render an ontogenetic growth-series scale overlay on this taxon's page (reads the
      // <slug>-growth silhouette group; the growth stages are its additionalFigures). See lib/schema.
      growthSeries: nullableDefault(z.boolean().default(false)),
      // Withhold an outdated/superseded skeletal without losing the page: render an "under
      // revision" notice + the supplied placeholder (a black silhouette), keep all live metadata
      // and the URL/301s/links, and don't assert the placeholder as the reconstruction in SEO.
      underRevision: nullableDefault(z.boolean().default(false)),
      added: optDate, // when this was added — feeds the home page's rotating "newest" plate
    })
    // A taxon needs at least one image. Most have a reconstruction; a few are
    // known-material only (e.g. Puertasaurus) and carry just `rigorous`.
    .refine((d) => d.reconstruction || d.rigorous, {
      message: 'Each taxon needs at least a reconstruction or a known-material (rigorous) image.',
    }),
});

const specimens = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/specimens' }),
  // Same CMS empty-value hardening as `taxa` (Sveltia writes ''/null). A specimen
  // is an instance of the skeletal-page template at a nested URL (CLAUDE.md §5).
  schema: z
    .object({
      taxon: z.string(),                  // parent taxon slug (matches a taxa entry id)
      catalog: z.string(),                // e.g. "FMNH PR 2081"
      nickname: optStr,                   // e.g. "Sue"
      sex: optStr,                        // e.g. "Male" / "Female" — sexually dimorphic taxa; renders when set
      repository: optStr,                 // holding institution, e.g. "Field Museum, Chicago"
      repositoryUrl: optStr,              // museum/collection page — renders the repository as a link
      formation: optStr,
      locality: optStr,
      lengthM: optNum,                    // numeric meters — sorting + scale figure (biology: along the spine)
      widthM: optNum,                     // max horizontal extent (m) for the scale overlay; falls back to lengthM
      femurM: optNum,
      massKg: optNum,                     // scale-aware display (kg → tonnes)
      completenessPct: optNum,
      collectedYear: optNum,
      view: defStr('Left lateral'),
      basis: optStr,
      scaleBar: defStr('1 meter'),
      license: defStr('https://www.skeletaldrawing.com/licensing'),
      creditText: defStr('Skeletal reconstruction © Scott Hartman / skeletaldrawing.com'),
      drawingCredit: defStr('© Scott Hartman'),
      reconstruction: nullableDefault(imageRef.optional()), // present for most specimens
      rigorous: nullableDefault(imageRef.optional()),       // known-material diagram
      additionalFigures: nullableDefault(z.array(figureRef).default([])), // e.g. muscle study
      overlay: nullableDefault(z.boolean().default(false)), // include in the scale-comparison figure
      featured: nullableDefault(z.boolean().default(false)),// show as a card on the hub
      added: optDate, // when this was added — feeds the home page's rotating "newest" plate
    })
    // Like taxa: at least one image. Most specimens carry a reconstruction; a few
    // are too incomplete to restore and carry only the known-material diagram.
    .refine((d) => d.reconstruction || d.rigorous, {
      message: 'Each specimen needs at least a reconstruction or a known-material image.',
    }),
});

// Dated blog. Posts live at /blog/<slug>; the ~99 legacy /home/<slug> posts get 301'd here at launch.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.preprocess(blank, z.coerce.date()), // publish date — sorts the blog + home section
    kind: optStr, // category eyebrow, e.g. "Reconstruction notes"
    excerpt: optStr, // card/teaser summary
    image: nullableDefault(imageRef.optional()), // optional lead image (+ alt)
    featured: nullableDefault(z.boolean().default(false)), // pin as the home page's lead post
    draft: nullableDefault(z.boolean().default(false)), // hide from index + routes
  }),
});

// A downloadable, classroom-ready version of an article (the branded handout/deck).
// Static files live in public/downloads/ and travel with their baked-in credit + an
// explicit use grant, so an educator can take them without asking (CLAUDE.md §3).
const downloadRef = z.object({
  format: z.enum(['pdf', 'pptx']),
  src: z.string(),              // /downloads/<file>
  label: optStr,                // button label override; else "Download PDF/PowerPoint"
  note: optStr,                 // e.g. "12 MB · 18 slides"
});

// Evergreen explainers and guides — the first-party content of the Learn hub
// (the anatomy guide is the flagship). Distinct from the dated blog: an article is
// durable and "updated", not "published on". Lives at /learn/<slug> by default; a
// `path` override keeps a legacy-ranking guide at its existing URL (the anatomy guide
// stays at /anatomy/ — a position-4.29 asset we will NOT move behind a redirect).
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    kind: optStr,                 // eyebrow, e.g. "Anatomy guide", "Methodology"
    summary: optStr,              // teaser shown on the Learn hub
    image: nullableDefault(imageRef.optional()), // optional lead image (+ alt)
    path: optStr,                 // canonical URL override, e.g. "/anatomy/"; else /learn/<slug>
    updated: optDate,             // evergreen: last meaningfully revised
    order: optNum,                // manual sort on the hub (lower = earlier); else by title
    downloads: nullableDefault(z.array(downloadRef).default([])), // classroom handouts/decks
    licenseNote: optStr,          // the use grant shown beside the downloads
    featured: nullableDefault(z.boolean().default(false)), // flagship card on the hub
    draft: nullableDefault(z.boolean().default(false)),
  }),
});

// Curated, ANNOTATED outbound links — the "around the web" half of the Learn hub.
// The blurb (the owner's expert take) is the whole point: a bare link list adds
// nothing in 2026, but an annotated, need-organized one serves readers AND ranks.
// Grouped by `category` on the hub; museums additionally group by `region`.
const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),            // the place / person / site
    url: z.string(),              // the outbound link
    category: z.enum(['museum', 'artist', 'blog', 'reference']),
    region: optStr,               // for museums — groups them, e.g. "North America"
    blurb: z.string(),            // REQUIRED annotation — the owner's one-line take
    order: optNum,                // manual sort within a group
    featured: nullableDefault(z.boolean().default(false)),
    draft: nullableDefault(z.boolean().default(false)),
  }),
});

// Reader comments — moderated, git-owned, static-rendered. ONE FILE PER COMMENT: a pure
// create for the serverless endpoint (no read-modify-write races), and moderation is just
// flipping `approved` or deleting the file. Archived Disqus threads import into this same
// shape, so old and new comments render through one template.
//
// The comment TEXT is the file body (not a field) — rendered escaped + linkified, never
// through the Markdown/HTML pipeline, so untrusted input can't inject markup. EMAIL IS NEVER
// STORED HERE: the repo is public; a commenter's email only ever reaches the owner's inbox
// via the notification email, never git.
const comments = defineCollection({
  // Exclude README.md — it documents the folder for GitHub browsers and is not a comment.
  loader: glob({ pattern: ['**/*.md', '!README.md'], base: './src/content/comments' }),
  schema: z.object({
    post: z.string(),        // slug of the post this belongs to (matches a `posts` entry id)
    author: z.string(),      // display name — public (commenters use real names)
    date: z.preprocess(blank, z.coerce.date()),
    approved: nullableDefault(z.boolean().default(false)), // the render gate + the moderation switch
    parent: optStr,          // id of the comment this replies to (rendered as one reply tier)
    website: optStr,         // optional commenter link, rendered rel="nofollow ugc"
    source: defStr('site'),  // 'site' | 'disqus' — provenance; tags imported archive threads
  }),
});

// Academic publications — the scholarly record folded in from scotthartman.info (CLAUDE.md §9), as
// a collection so adding a paper is a one-field CMS entry, not a code edit. Powers the list on the
// About → Research page; sorts newest-first by `year` unless `order` overrides. One file per paper.
// (These are Hartman's OWN authored works — distinct from the "where my work appears" credits list,
// which is others' books/papers that reproduce his art.)
const publications = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!README.md'], base: './src/content/publications' }),
  schema: z.object({
    authors: z.string(),        // full author string as it should read, e.g. "Lovelace, D. M., Hartman, S. A., …"
    year: z.number(),
    title: z.string(),
    venue: optStr,              // journal or book, e.g. "PLOS ONE", "Nature Communications"
    doi: optStr,                // bare DOI (e.g. "10.1371/journal.pone.0223872") — rendered as a doi.org link
    url: optStr,                // explicit link when there's no DOI
    kind: defStr('paper'),      // 'paper' | 'book' | 'chapter' — small type tag
    note: optStr,               // e.g. "Skeletal diagrams by S. Hartman" for a contributed volume
    featured: nullableDefault(z.boolean().default(false)),
    order: optNum,              // manual sort override (lower = earlier); else by year, newest first
    draft: nullableDefault(z.boolean().default(false)),
  }),
});

// Reserved for later phases (defined when their first entry/template lands):
//   page — standalone pages (About spokes if made CMS-editable, licensing, …)

export const collections = { taxa, specimens, posts, articles, resources, comments, publications };
