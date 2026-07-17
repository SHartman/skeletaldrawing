// Keep staging out of Google. Cloudflare Pages serves the SAME static HTML from the production
// custom domain (www.skeletaldrawing.com) AND from *.pages.dev (the branch/preview deploys), so a
// build-time <meta robots> can't tell them apart. This middleware runs at request time and stamps
// `X-Robots-Tag: noindex, nofollow` on every response whose HOST is a pages.dev host — so staging and
// preview deploys are crawlable-but-not-indexable and never compete with the real domain. Production
// (the custom domain, which does NOT end in .pages.dev) passes through untouched.
//
// Belt-and-suspenders: the canonical <link> already points at www.skeletaldrawing.com on every page;
// this is the harder guarantee (a header Google honours for de-indexing, unlike a canonical it may
// ignore). We deliberately do NOT Disallow in robots.txt on staging — that would stop the crawl before
// Google could see this noindex header, leaving orphan URLs indexed.
//
// NOTE: Astro's dev server does NOT run Pages Functions, so this only takes effect on Cloudflare.
export async function onRequest(context) {
  const { request, next } = context;
  const response = await next();
  const host = new URL(request.url).hostname;
  if (host.endsWith('.pages.dev')) {
    const r = new Response(response.body, response); // clone so headers are mutable
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return r;
  }
  return response;
}
