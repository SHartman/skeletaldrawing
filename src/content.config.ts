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

// Sveltia materializes empty fields as '' (strings) or null (numbers). Normalize
// those to `undefined` so optional fields stay optional and defaults still apply.
const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const optStr = z.preprocess(blank, z.string().optional());
const optNum = z.preprocess(blank, z.number().optional());
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
});

const taxa = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/taxa' }),
  schema: z
    .object({
      taxon: z.string(),                  // binomial, rendered italic
      author: z.string(),                 // bare author citation, e.g. "Osborn, 1905" (no parens)
      recombination: nullableDefault(z.boolean().default(false)), // ICZN: parenthesizes the author
      gallery: z.string(),                // section bucket / URL parent, e.g. "sauropods-and-kin"
      clade: z.array(z.string()),         // ORDERED cladistic path, broad → specific
      family: optStr,                     // card "family" line; defaults to the last clade node
      specimenId: optStr,                 // catalog number, verbatim, e.g. "GPIT/RE/7288"
      specimenName: optStr,               // nickname, e.g. "The Nation's T. rex"
      alsoKnownAs: nullableDefault(z.array(z.string()).default([])),
      lengthM: optNum,                    // numeric meters — sorting + the scale figure
      lengthLabel: optStr,                // display override; else scale-aware (m / cm)
      massKg: optNum,                     // body mass; scale-aware display (kg → tonnes)
      massSource: optStr,                 // provenance, e.g. "PaleoGDI" (future credit/link)
      lifeStage: optStr,                  // e.g. "Juvenile" — renders a record cell
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
      repository: optStr,                 // holding institution, e.g. "Field Museum, Chicago"
      repositoryUrl: optStr,              // museum/collection page — renders the repository as a link
      formation: optStr,
      locality: optStr,
      lengthM: optNum,                    // numeric meters — sorting + scale figure
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
    })
    // Like taxa: at least one image. Most specimens carry a reconstruction; a few
    // are too incomplete to restore and carry only the known-material diagram.
    .refine((d) => d.reconstruction || d.rigorous, {
      message: 'Each specimen needs at least a reconstruction or a known-material image.',
    }),
});

// Reserved for later phases (defined when their first entry/template lands):
//   post        — dated blog
//   article     — evergreen explainers (own namespace /articles/)
//   page        — standalone pages (About spokes, licensing, …)
//   publication — phase 2 (folding in scotthartman.info)

export const collections = { taxa, specimens };
