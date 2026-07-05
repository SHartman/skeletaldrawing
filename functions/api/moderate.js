// GET /api/moderate?id=<token>&do=approve|discard — the target of the Approve/Discard links in
// the owner's notification email. Approve → commit the comment file to git (approved:true,
// source:site) → Cloudflare rebuild → live. Discard → drop it. Only an approval costs a build.
// Auth = the unguessable KV key (a capability token); the link only ever reaches the owner.

const REPO = 'SHartman/skeletaldrawing';
const BRANCH = 'main';

const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const page = (title, body) =>
  new Response(
    `<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title><body style="font-family:system-ui,-apple-system,sans-serif;max-width:34rem;margin:12vh auto;padding:0 6vw;color:#1b1d1f;line-height:1.6">` +
    `<h1 style="font-weight:600;font-size:1.5rem">${esc(title)}</h1>${body}` +
    `<p style="margin-top:2rem"><a href="/blog/" style="color:#b07a2e">← back to the blog</a></p></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').replace(/[^a-f0-9]/gi, '');
  const doAction = url.searchParams.get('do');
  if (!id || !['approve', 'discard'].includes(doAction))
    return page('Invalid link', '<p>That moderation link is malformed.</p>');
  if (!env.COMMENTS_KV) return page('Not configured', '<p>The server is missing its comment store.</p>');

  const raw = await env.COMMENTS_KV.get('pending:' + id);
  if (!raw) return page('Already handled', '<p>This comment was already approved, discarded, or has expired.</p>');
  const rec = JSON.parse(raw);

  if (doAction === 'discard') {
    await env.COMMENTS_KV.delete('pending:' + id);
    return page('Discarded', `<p>The comment from <strong>${esc(rec.author)}</strong> was discarded — nothing was published.</p>`);
  }

  // Approve → write the comment file. Body is the raw text (the render layer escapes + linkifies
  // `source:site` bodies, so no HTML is trusted from the visitor). Email is NOT written.
  const slug = (rec.post || '').replace(/[^a-z0-9-]/gi, '');
  const fileId = `${slug}--site-${id.slice(0, 12)}`;
  const path = `src/content/comments/${fileId}.md`;
  const body =
    `---\n` +
    `post: ${slug}\n` +
    `author: ${JSON.stringify(rec.author)}\n` +
    `date: ${rec.date}\n` +
    `approved: true\n` +
    (rec.link ? `website: ${JSON.stringify(rec.link)}\n` : '') +
    `source: site\n` +
    `---\n${rec.text}\n`;

  const result = await commitFile(env, path, body, `Comment from ${rec.author} on ${slug}`);
  if (!result.ok)
    return page('Something went wrong', `<p>Couldn’t publish (${esc(result.error)}). The comment is still held — try the link again in a moment.</p>`);

  await env.COMMENTS_KV.delete('pending:' + id);
  return page('Approved ✓', `<p>The comment from <strong>${esc(rec.author)}</strong> is published — it’ll appear on the post within a minute, once the site rebuilds.</p>`);
}

// utf-8-safe base64 for the GitHub Contents API
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

async function commitFile(env, path, content, message) {
  if (!env.GITHUB_TOKEN) return { ok: false, error: 'no token' };
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'skeletaldrawing-comments',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message, content: b64(content), branch: BRANCH }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: `GitHub ${res.status}` };
}
