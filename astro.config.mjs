// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Canonical production origin — drives <link rel="canonical">, sitemap, and
  // absolute URLs in structured data. (URL preservation is a hard rule; see CLAUDE.md §3.)
  site: 'https://www.skeletaldrawing.com',

  // Option A URLs use trailing-slash directory paths (e.g. /theropods/tyrannosaurus-rex/).
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [sitemap()],
});
