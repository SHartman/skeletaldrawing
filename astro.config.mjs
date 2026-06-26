// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';

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
    rehypePlugins: [[rehypeExternalLinks, { target: '_blank', rel: ['noopener'] }]],
  },

  integrations: [sitemap()],
});
