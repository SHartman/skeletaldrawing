// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';
import remarkTaxonLinks from './src/lib/remark-taxon-links.mjs';
import rehypeFigures from './src/lib/rehype-figures.mjs';

// https://astro.build/config
export default defineConfig({
  // Canonical production origin — drives <link rel="canonical">, sitemap, and
  // absolute URLs in structured data. (URL preservation is a hard rule; see CLAUDE.md §3.)
  site: 'https://www.skeletaldrawing.com',

  // Option A URLs use trailing-slash directory paths (e.g. /theropods/tyrannosaurus-rex/).
  trailingSlash: 'always',
  // `inlineStylesheets: 'always'` — ship CSS inside the HTML instead of as <link> requests.
  //
  // Astro's default ('auto') only inlines stylesheets under 4 KB, and ours miss: BaseLayout.css is
  // 7.2 KB (63% of it the 14 @font-face declarations) and the per-page CSS runs to ~18 KB. So every
  // page made TWO render-blocking requests that Lighthouse costed at ~700 ms of simulated mobile
  // first paint — not bandwidth (the files are tiny) but serial round trips the browser can only
  // discover after parsing the HTML.
  //
  // Brotli-measured, a taxon page goes 4.7 KB + 3.6 KB of separate CSS (3 round trips) -> 7.8 KB in
  // one. Inlining is FEWER bytes as well as fewer requests on a first visit, because CSS compresses
  // better in the HTML's context. The cost is that CSS is no longer cached across pages, so each
  // later page in a session carries ~3 KB it would otherwise reuse — bytes that ride along in a
  // response already in flight, versus round trips that block painting. Worth it here, where most
  // traffic arrives cold from search onto one deep page.
  build: { format: 'directory', inlineStylesheets: 'always' },

  // Outbound links in CMS prose open in a new tab with the noopener safety attribute.
  // We deliberately do NOT add rel="nofollow": editorial links to museums/papers are a
  // trust/E-E-A-T signal and should be followed. Internal links (root-relative) are untouched.
  markdown: {
    // Italicised taxon names in taxa/specimen prose become links to their own pages, resolved at
    // build so a mention starts linking the day its target page exists. See the plugin for rules
    // (never self-links, first mention only, genus -> hub when >=2 species).
    remarkPlugins: [remarkTaxonLinks],
    // rehypeFigures: markdown image titles -> visible captions, plus optional {width=… left|right}
    // directives. Only touches images that opt in (a title or a {…}); see the plugin header.
    rehypePlugins: [[rehypeExternalLinks, { target: '_blank', rel: ['noopener'] }], rehypeFigures],
  },

  integrations: [sitemap()],
});
