// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static output: Cloudflare Pages serves the `dist` folder directly, no adapter needed.
export default defineConfig({
  site: 'https://federg-conjunta.pages.dev',
  trailingSlash: 'always',
  // The CMS admin lives in public/admin/ and must not end up in the sitemap
  integrations: [sitemap({ filter: (page) => !page.includes('/admin/') })],
  // Images in Markdown bodies also get srcset and sizes, like the ones placed with <Image>
  image: {
    layout: 'constrained',
  },
  build: {
    inlineStylesheets: 'always',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
