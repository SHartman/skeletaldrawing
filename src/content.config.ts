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
});

// A bonus figure shown below the main plates (e.g. a speculative armor variant).
const figureRef = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
});

// Sveltia materializes empty fields as '' (strings) or null (numbers). Normalize
// those to `undefined` so optional fields stay optional and defaults still apply.
const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const optStr = z.preprocess(blank, z.string().optional());
const optNum = z.preprocess(blank, z.number().optional());
const defStr = (d: string) => z.preprocess(blank, z.string().default(d));
const nullableDefault = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v == null ? undefined : v), s);

const taxa = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/taxa' }),
  schema: z
    .object({
      taxon: z.string(),                  // binomial, rendered italic
      author: z.string(),                 // nomenclatural author citation, e.g. "Osborn, 1905"
      gallery: z.string(),                // section bucket / URL parent, e.g. "sauropods-and-kin"
      clade: z.array(z.string()),         // ORDERED cladistic path, broad → specific
      family: optStr,                     // card "family" line; defaults to the last clade node
      specimenId: optStr,                 // catalog number, verbatim, e.g. "GPIT/RE/7288"
      specimenName: optStr,               // nickname, e.g. "The Nation's T. rex"
      alsoKnownAs: nullableDefault(z.array(z.string()).default([])),
      lengthM: optNum,                    // numeric metres — sorting + the scale figure
      lengthLabel: optStr,                // display override; else scale-aware (m / cm)
      massKg: optNum,                     // body mass; scale-aware display (kg → tonnes)
      massSource: optStr,                 // provenance, e.g. "PaleoGDI" (future credit/link)
      lifeStage: optStr,                  // e.g. "Juvenile" — renders a record cell
      view: defStr('Left lateral'),
      basis: optStr,
      scaleBar: defStr('1 metre'),        // caption value, e.g. "1 metre", "50 cm"
      license: defStr('https://www.skeletaldrawing.com/licensing'),
      creditText: defStr('Skeletal reconstruction © Scott Hartman / skeletaldrawing.com'),
      drawingCredit: defStr('© Scott Hartman'), // shown in the plate caption
      reconstruction: nullableDefault(imageRef.optional()), // the hero — present for most taxa
      rigorous: nullableDefault(imageRef.optional()),       // known-material diagram
      additionalFigures: nullableDefault(z.array(figureRef).default([])), // bonus figures
      featured: nullableDefault(z.boolean().default(false)),
    })
    // A taxon needs at least one image. Most have a reconstruction; a few are
    // known-material only (e.g. Puertasaurus) and carry just `rigorous`.
    .refine((d) => d.reconstruction || d.rigorous, {
      message: 'Each taxon needs at least a reconstruction or a known-material (rigorous) image.',
    }),
});

const specimens = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/specimens' }),
  schema: z.object({
    taxon: z.string(),                   // parent taxon slug (→ reference('taxa') in Phase 3)
    catalog: z.string(),                 // e.g. "FMNH PR 2081"
    nickname: z.string().optional(),     // e.g. "Sue"
    institution: z.string().optional(),
    lengthM: z.number().optional(),
    femurM: z.number().optional(),
    completenessPct: z.number().optional(),
    collectedYear: z.number().optional(),
    formation: z.string().optional(),
    locality: z.string().optional(),
    repository: z.string().optional(),
    view: z.string().default('Left lateral'),
    basis: z.string().optional(),
    license: z.string().optional(),
    creditText: z.string().optional(),
    reconstruction: imageRef,
    rigorous: imageRef.optional(),
    featured: z.boolean().default(false),
  }),
});

// Reserved for later phases (defined when their first entry/template lands):
//   post        — dated blog
//   article     — evergreen explainers (own namespace /articles/)
//   page        — standalone pages (About spokes, licensing, …)
//   publication — phase 2 (folding in scotthartman.info)

export const collections = { taxa, specimens };
