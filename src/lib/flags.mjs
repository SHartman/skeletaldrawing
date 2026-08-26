// Launch flags — one switch per feature, read by every place that feature touches.
//
// WHY THIS FILE EXISTS: /compare/ shipped dark behind a `noindex` meta AND a sitemap exclusion in
// astro.config.mjs, two halves of one decision sitting in two files. Miss the second and the tool
// launches invisible to the sitemap. Adding the navigation would have made it five places to keep in
// step. They now all read from here, so launching is one boolean and there is nothing to forget.
//
// .mjs rather than .ts because astro.config.mjs imports it too, and the config is not run through the
// TypeScript pipeline.

/**
 * The interactive size-comparison tool at /compare/.
 *
 * false — the page still builds and returns 200, but carries `noindex, follow`, is excluded from the
 *         sitemap, and nothing anywhere links to it.
 * true  — indexable, in the sitemap, and the entry points light up:
 *           • the Learn hub card (its copy lives in src/content/articles/size-comparison-tool.md)
 *           • the home page's scale-comparison sampler
 *           • every genus hub, specimen hub and growth series, via ScaleComparison's toolHref
 *           • every skeletal page, under the record row
 *
 * Flip this on the day the tool launches, alongside the announcement post.
 */
export const COMPARE_LIVE = false;

/** Canonical path for the tool. Also identifies its Learn card, whose article entry overrides `path`. */
export const COMPARE_PATH = '/compare/';

/** Shared wording for the entry points, so the CTA reads the same everywhere it appears. */
export const COMPARE_CTA = 'Create your own comparison →';
