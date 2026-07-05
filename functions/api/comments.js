// POST /api/comments — Cloudflare Pages Function (the comment form's action).
// Flow: honeypot → verify Turnstile → validate → stash in KV → email the owner a one-tap
// Approve/Discard link. NOTHING is committed to git here, so pending + spam comments trigger
// ZERO rebuilds; only an approval (see moderate.js) writes a file and costs one build.
// The commenter's email is used ONLY as the notification reply-to — it is never stored in git.

const OWNER_EMAIL = 'skeletaldrawing@gmail.com';
const FROM_EMAIL = 'Skeletal Drawing <onboarding@resend.dev>'; // works to your own inbox without domain verification
const PENDING_TTL = 60 * 60 * 24 * 30; // pending comments expire from the queue after 30 days
const RATE_MAX = 5; // max verified submissions per IP per hour (Turnstile already gates each one)

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  // Honeypot: bots fill the hidden `url` field; humans never see it. Silently accept + drop.
  if ((form.get('url') || '').toString().trim()) return json({ ok: true });

  const post = (form.get('post') || '').toString().trim();
  const postTitle = (form.get('postTitle') || '').toString().trim();
  const author = (form.get('author') || '').toString().trim();
  const email = (form.get('email') || '').toString().trim();
  const link = (form.get('link') || '').toString().trim();
  const text = (form.get('text') || '').toString().trim();
  const token = (form.get('cf-turnstile-response') || '').toString();

  if (!post || !author || !text) return json({ error: 'Missing required fields' }, 400);
  if (!/^[a-z0-9-]+$/i.test(post)) return json({ error: 'Bad post id' }, 400);
  if (author.length > 80 || email.length > 120 || link.length > 200 || text.length > 5000)
    return json({ error: 'Field too long' }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Bad email' }, 400);
  if (link && !/^https?:\/\//i.test(link)) return json({ error: 'Link must start with http' }, 400);

  if (!env.TURNSTILE_SECRET_KEY || !env.COMMENTS_KV) return json({ error: 'Server not configured' }, 500);

  // Verify the Turnstile token server-side.
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') || '',
    }),
  })
    .then((r) => r.json())
    .catch(() => ({ success: false }));
  if (!verify.success) return json({ error: 'Verification failed — please try again.' }, 403);

  // Light per-IP rate limit (backstops email/KV floods even if a bot beats Turnstile).
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rk = 'rate:' + ip;
  const count = parseInt((await env.COMMENTS_KV.get(rk)) || '0', 10);
  if (count >= RATE_MAX) return json({ error: 'Too many comments — please try again later.' }, 429);
  await env.COMMENTS_KV.put(rk, String(count + 1), { expirationTtl: 3600 });

  // Stash the pending comment under an unguessable key (the key IS the capability token; the
  // Approve/Discard link that carries it only ever goes to the owner's inbox).
  const id = crypto.randomUUID().replace(/-/g, '');
  const rec = { post, postTitle, author, email, link, text, date: new Date().toISOString() };
  await env.COMMENTS_KV.put('pending:' + id, JSON.stringify(rec), { expirationTtl: PENDING_TTL });

  await notifyOwner(env, new URL(request.url).origin, id, rec);
  return json({ ok: true });
}

async function notifyOwner(env, origin, id, rec) {
  if (!env.RESEND_API_KEY) return; // no email configured → comment waits in KV, owner just can't be pinged yet
  const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const approve = `${origin}/api/moderate?id=${id}&do=approve`;
  const discard = `${origin}/api/moderate?id=${id}&do=discard`;
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:34rem;line-height:1.55">` +
    `<p><strong>${esc(rec.author)}</strong> commented on <em>${esc(rec.postTitle || rec.post)}</em>:</p>` +
    `<blockquote style="border-left:3px solid #ccc;margin:0 0 1em;padding:2px 0 2px 14px;color:#333">${esc(rec.text).replace(/\n/g, '<br>')}</blockquote>` +
    (rec.link ? `<p style="color:#555;font-size:14px">Link: ${esc(rec.link)}</p>` : '') +
    `<p style="margin:1.4em 0"><a href="${approve}" style="background:#1b1d1f;color:#fff;padding:11px 20px;text-decoration:none;border-radius:5px">Approve &amp; publish</a>` +
    `<a href="${discard}" style="margin-left:18px;color:#b3402e">Discard</a></p>` +
    `<p style="color:#999;font-size:12px">Reply to this email to answer ${esc(rec.author)} privately (${esc(rec.email || 'no email given')}).</p></div>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      reply_to: rec.email || undefined,
      subject: `New comment from ${rec.author} — approve?`,
      html,
    }),
  }).catch(() => {});
}
