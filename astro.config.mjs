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
  build: { format: 'directory' },

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
