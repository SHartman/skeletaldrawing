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
//
// COST — read `public/_routes.json` alongside this file. A root _middleware runs on EVERY request
// Pages routes through Functions, which by default means every image, font, CSS and JS file too:
// ~94% of this site's files are static assets (6,305 in /_astro/ + 587 in /images/), and on
// 2026-07-24 that burned 67,626 of the then-free tier's 100,000 daily Functions requests — on a
// static site, for a header only HTML needs. _routes.json excludes the asset directories so this
// runs on HTML and /api/* only. If you add a new top-level asset directory, exclude it there too.
//
// That exclusion is what carried the 2026-08-28 launch. The tool went viral: 1.7M requests in a
// week, of which only 211,046 (~12%) reached Functions — the rest were excluded assets. Unexcluded,
// all 1.7M would have invoked this, blowing the daily ceiling on the launch morning and failing
// requests SITE-WIDE, since everything HTML routes through here. Zero errors were recorded.
//
// The account moved to Workers Paid ($5/mo) on 2026-08-30, so the ceiling is now 10M requests/month
// rather than 100k/day and a spike can no longer take the site down. Keep the exclusions anyway:
// past the included tier the requests are billed, and the compare tool is unusually asset-light
// (inlined CSS, inline catalogue JSON), so its traffic maps close to 1:1 onto Functions calls.
//
// Why not delete this middleware and gate pages.dev behind Cloudflare Access instead: the Pages
// "Preview access → Restrict previews" toggle covers per-commit PREVIEW URLs only. The stable
// production alias (skeletaldrawing.pages.dev) — the one Google would actually find — is managed
// separately in Zero Trust, so that toggle alone does not replace this header.
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
