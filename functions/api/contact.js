// POST /api/contact — Cloudflare Pages Function (the contact form's action).
// Flow: honeypot → verify Turnstile → validate → email the owner. Simpler than comments: there's
// nothing to moderate or publish, so no KV queue and no rebuild — the message just lands in the
// owner's inbox with the sender set as reply-to. Reuses the SAME bindings the comment endpoint
// already has configured (TURNSTILE_SECRET_KEY, COMMENTS_KV for rate-limiting, RESEND_API_KEY), so
// enabling contact needs no new Cloudflare setup. The sender's email is used only as reply-to; it
// is never stored anywhere.

const OWNER_EMAIL = 'skeletaldrawing@gmail.com';
const FROM_EMAIL = 'Skeletal Drawing <onboarding@resend.dev>'; // reaches your own inbox without domain verification
const RATE_MAX = 5; // max verified submissions per IP per hour (Turnstile already gates each one)

// The three triage categories offered by the form's "Regarding" select. The value must be one of
// these, so the subject line the owner sees is always trustworthy (never attacker-controlled text).
const REASONS = ['Licensing & Commissions', 'Education & Outreach', 'General & Other'];

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

  const name = (form.get('name') || '').toString().trim();
  const email = (form.get('email') || '').toString().trim();
  const reason = (form.get('reason') || '').toString().trim();
  const message = (form.get('message') || '').toString().trim();
  const token = (form.get('cf-turnstile-response') || '').toString();

  if (!name || !email || !message) return json({ error: 'Missing required fields' }, 400);
  if (name.length > 80 || email.length > 120 || message.length > 8000)
    return json({ error: 'Field too long' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Bad email' }, 400);
  // Fall back to a safe default rather than rejecting if the select is somehow absent/tampered.
  const category = REASONS.includes(reason) ? reason : 'General & Other';

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

  // Light per-IP rate limit (own key prefix so it never collides with the comment limiter).
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rk = 'crate:' + ip;
  const count = parseInt((await env.COMMENTS_KV.get(rk)) || '0', 10);
  if (count >= RATE_MAX) return json({ error: 'Too many messages — please try again later.' }, 429);
  await env.COMMENTS_KV.put(rk, String(count + 1), { expirationTtl: 3600 });

  const sent = await emailOwner(env, { name, email, category, message });
  if (!sent) return json({ error: 'Could not send just now — please try again in a moment.' }, 502);
  return json({ ok: true });
}

async function emailOwner(env, { name, email, category, message }) {
  if (!env.RESEND_API_KEY) return false; // contact is email-only; without Resend there's nowhere for it to go
  const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:34rem;line-height:1.55">` +
    `<p style="margin:0 0 .3em"><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>` +
    `<p style="margin:0 0 1em;color:#555;font-size:14px">Regarding: <strong>${esc(category)}</strong></p>` +
    `<blockquote style="border-left:3px solid #ccc;margin:0;padding:2px 0 2px 14px;color:#222">${esc(message).replace(/\n/g, '<br>')}</blockquote>` +
    `<p style="color:#999;font-size:12px;margin-top:1.4em">Reply to this email to answer ${esc(name)} directly.</p></div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      reply_to: email,
      subject: `Contact — ${category} — from ${name}`,
      html,
    }),
  }).catch(() => null);
  return !!(res && res.ok);
}
