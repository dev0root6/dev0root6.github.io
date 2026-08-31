// Signal Ping — Cloudflare Worker API.
//
// Three features, one job: get a paired person's attention.
//   live          — tap now, partner's phone buzzes now.
//   partner_timer — schedule a ping to the partner; the cron trigger fires it.
//   self timer    — lives entirely on the sender's device (see public/app.js);
//                   the server is deliberately not involved.
//
// Auth model: a pair is created/joined with a shared pairing code (hashed at
// rest). Joining mints a per-user bearer token (also hashed at rest) that the
// device sends as `Authorization: Bearer <token>` on every call.

import { sendPushToSubscriptions } from './push.js';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const now = () => Math.floor(Date.now() / 1000);
const uuid = () => crypto.randomUUID();

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// URL-safe, unambiguous token for pairing codes and bearer tokens.
function randomToken(bytes = 32) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function corsHeaders(request, env) {
  // ALLOWED_ORIGINS is a comma-separated list in wrangler.toml. "*" allows any
  // origin, which is fine here because every mutating call needs a bearer token.
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const origin = request.headers.get('Origin');
  const value = allowed.includes('*') ? origin || '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Expected a JSON body');
  }
}

function requireString(body, field, { max = 200, optional = false } = {}) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new HttpError(400, `Missing field: ${field}`);
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) {
    if (optional) return null;
    throw new HttpError(400, `Missing field: ${field}`);
  }
  if (trimmed.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer`);
  return trimmed;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

// Resolves the bearer token to { user, partner }. Partner is null until the
// second person joins the pair.
async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, 'Missing bearer token');

  const tokenHash = await sha256Hex(match[1].trim());
  const user = await env.DB.prepare('SELECT * FROM users WHERE token_hash = ?').bind(tokenHash).first();
  if (!user) throw new HttpError(401, 'Unknown or revoked token');

  const partner = await env.DB.prepare('SELECT * FROM users WHERE pair_id = ? AND id != ?')
    .bind(user.pair_id, user.id)
    .first();

  return { user, partner };
}

function requirePartner(partner) {
  if (!partner) throw new HttpError(409, 'Nobody has joined this pair yet — share your pairing code');
  return partner;
}

async function subscriptionsFor(userId, env) {
  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .bind(userId)
    .all();
  return results || [];
}

/* ------------------------------------------------------------------ */
/* Alert dispatch                                                      */
/* ------------------------------------------------------------------ */

// Sends one alert to the recipient's devices and records it in alert_log.
// `kind` is 'live' or 'partner_timer' — the only two things this app ever sends.
async function dispatchAlert({ pairId, sender, recipient, kind, label }, env) {
  const subs = await subscriptionsFor(recipient.id, env);

  const payload = {
    kind,
    label,
    from: sender.display_name,
    sentAt: now(),
  };

  const { delivered, failed } = subs.length
    ? await sendPushToSubscriptions(subs, payload, env)
    : { delivered: 0, failed: 0 };

  await env.DB.prepare(
    `INSERT INTO alert_log (id, pair_id, sender_id, recipient_id, kind, label, delivered, failed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(uuid(), pairId, sender.id, recipient.id, kind, label, delivered, failed, now())
    .run();

  return { delivered, failed, devices: subs.length };
}

/* ------------------------------------------------------------------ */
/* Route handlers                                                      */
/* ------------------------------------------------------------------ */

const routes = [];
const route = (method, pattern, handler) =>
  routes.push({ method, pattern: new URLPattern({ pathname: pattern }), handler });

// --- Public -------------------------------------------------------------

// Health check.
route('GET', '/api/health', async (_req, env) => ({ ok: true, time: now() }));

// The PWA fetches this before subscribing to push, so the key lives in exactly
// one place (wrangler secrets/vars) instead of being duplicated in the frontend.
route('GET', '/api/push/vapid-public-key', async (_req, env) => ({ key: env.VAPID_PUBLIC_KEY }));

// Create a pair (first person to use a code) or join it (second person).
// The pairing code is the shared secret; it is never stored in plaintext.
route('POST', '/api/pair/join', async (request, env) => {
  const body = await readJson(request);
  const code = requireString(body, 'code', { max: 128 });
  if (code.length < 8) throw new HttpError(400, 'Pairing code must be at least 8 characters');
  const displayName = requireString(body, 'displayName', { max: 40, optional: true }) || 'Me';

  const codeHash = await sha256Hex(code);
  const timestamp = now();

  let pair = await env.DB.prepare('SELECT * FROM pairs WHERE code_hash = ?').bind(codeHash).first();
  let slot = 1;

  if (!pair) {
    // First use of this code — create the pair and take slot 1.
    pair = { id: uuid(), code_hash: codeHash, created_at: timestamp };
    await env.DB.prepare('INSERT INTO pairs (id, code_hash, created_at) VALUES (?, ?, ?)')
      .bind(pair.id, pair.code_hash, pair.created_at)
      .run();
  } else {
    const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE pair_id = ?')
      .bind(pair.id)
      .first();
    if (count >= 2) {
      throw new HttpError(
        403,
        'This pair already has two people. To add another device, use "Restore with token" in Settings.',
      );
    }
    slot = count + 1;
  }

  const token = randomToken();
  const user = {
    id: uuid(),
    pair_id: pair.id,
    slot,
    token_hash: await sha256Hex(token),
    display_name: displayName,
    created_at: timestamp,
  };

  await env.DB.prepare(
    `INSERT INTO users (id, pair_id, slot, token_hash, display_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(user.id, user.pair_id, user.slot, user.token_hash, user.display_name, user.created_at)
    .run();

  // The plaintext token is returned exactly once; the device stores it.
  return { token, userId: user.id, pairId: pair.id, slot, displayName };
});

// --- Authenticated ------------------------------------------------------

// Everything the home screen needs in one call.
route('GET', '/api/me', async (request, env) => {
  const { user, partner } = await authenticate(request, env);
  const subs = await subscriptionsFor(user.id, env);
  const { count: scheduled } = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM partner_alerts WHERE sender_id = ? AND status = 'scheduled'",
  )
    .bind(user.id)
    .first();

  return {
    user: {
      id: user.id,
      slot: user.slot,
      displayName: user.display_name,
      labels: {
        live: user.live_label,
        partnerTimer: user.partner_timer_label,
        selfTimer: user.self_timer_label,
      },
    },
    partner: partner ? { displayName: partner.display_name, paired: true } : { paired: false },
    devices: subs.map((s) => ({
      id: s.id,
      userAgent: s.user_agent,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
    })),
    scheduledPartnerAlerts: scheduled,
  };
});

// Editable labels and display name.
route('PATCH', '/api/settings', async (request, env) => {
  const { user } = await authenticate(request, env);
  const body = await readJson(request);

  const displayName = requireString(body, 'displayName', { max: 40, optional: true });
  const live = requireString(body, 'liveLabel', { max: 80, optional: true });
  const partnerTimer = requireString(body, 'partnerTimerLabel', { max: 80, optional: true });
  const selfTimer = requireString(body, 'selfTimerLabel', { max: 80, optional: true });

  await env.DB.prepare(
    `UPDATE users
        SET display_name        = COALESCE(?, display_name),
            live_label          = COALESCE(?, live_label),
            partner_timer_label = COALESCE(?, partner_timer_label),
            self_timer_label    = COALESCE(?, self_timer_label)
      WHERE id = ?`,
  )
    .bind(displayName, live, partnerTimer, selfTimer, user.id)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return {
    displayName: updated.display_name,
    labels: {
      live: updated.live_label,
      partnerTimer: updated.partner_timer_label,
      selfTimer: updated.self_timer_label,
    },
  };
});

// Register or refresh this device's push subscription. Idempotent on endpoint,
// so the PWA can call it on every launch to keep last_seen_at fresh and to
// re-point an endpoint the browser has rotated.
route('POST', '/api/push/subscribe', async (request, env) => {
  const { user } = await authenticate(request, env);
  const body = await readJson(request);

  const endpoint = requireString(body, 'endpoint', { max: 1000 });
  const p256dh = requireString(body.keys || {}, 'p256dh', { max: 200 });
  const auth = requireString(body.keys || {}, 'auth', { max: 100 });
  const userAgent = (request.headers.get('User-Agent') || '').slice(0, 200);
  const timestamp = now();

  await env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id      = excluded.user_id,
       p256dh       = excluded.p256dh,
       auth         = excluded.auth,
       user_agent   = excluded.user_agent,
       last_seen_at = excluded.last_seen_at`,
  )
    .bind(uuid(), user.id, endpoint, p256dh, auth, userAgent, timestamp, timestamp)
    .run();

  return { ok: true };
});

// Drop this device's subscription (Settings → "Stop notifications here").
route('POST', '/api/push/unsubscribe', async (request, env) => {
  const { user } = await authenticate(request, env);
  const body = await readJson(request);
  const endpoint = requireString(body, 'endpoint', { max: 1000 });

  const result = await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .bind(user.id, endpoint)
    .run();

  return { ok: true, removed: result.meta?.changes ?? 0 };
});

// Send a push to this device only, so you can prove delivery works before
// relying on it (Settings → "Send test notification").
route('POST', '/api/push/test', async (request, env) => {
  const { user } = await authenticate(request, env);
  const subs = await subscriptionsFor(user.id, env);
  if (!subs.length) throw new HttpError(409, 'No push subscription registered on this account');

  const { delivered, failed } = await sendPushToSubscriptions(
    subs,
    { kind: 'test', label: 'Signal Ping is working', from: user.display_name, sentAt: now() },
    env,
  );
  return { delivered, failed };
});

// FEATURE 1 — Live Alert: one tap, partner's device buzzes now.
route('POST', '/api/alerts/live', async (request, env) => {
  const { user, partner } = await authenticate(request, env);
  requirePartner(partner);

  const body = await readJson(request).catch(() => ({}));
  const label = requireString(body || {}, 'label', { max: 80, optional: true }) || user.live_label;

  // Light anti-spam: one live alert per pair every 3 seconds. Double taps and
  // flaky-network retries shouldn't buzz the partner twice.
  const recent = await env.DB.prepare(
    "SELECT created_at FROM alert_log WHERE sender_id = ? AND kind = 'live' ORDER BY created_at DESC LIMIT 1",
  )
    .bind(user.id)
    .first();
  if (recent && now() - recent.created_at < 3) {
    throw new HttpError(429, 'Slow down a moment — that alert just went out');
  }

  const result = await dispatchAlert(
    { pairId: user.pair_id, sender: user, recipient: partner, kind: 'live', label },
    env,
  );
  return { ok: true, label, ...result };
});

// FEATURE 3 — Partner Timer Alert: schedule a ping for the partner.
// The cron trigger below does the actual sending, so nothing needs to stay running.
route('POST', '/api/alerts/partner-timer', async (request, env) => {
  const { user, partner } = await authenticate(request, env);
  requirePartner(partner);

  const body = await readJson(request);
  const label = requireString(body, 'label', { max: 80, optional: true }) || user.partner_timer_label;

  const fireAt = resolveFireAt(body);
  const id = uuid();

  await env.DB.prepare(
    `INSERT INTO partner_alerts (id, pair_id, sender_id, recipient_id, label, fire_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
  )
    .bind(id, user.pair_id, user.id, partner.id, label, fireAt, now())
    .run();

  return { id, label, fireAt, status: 'scheduled' };
});

// Scheduled partner alerts this user has pending.
route('GET', '/api/alerts/partner-timer', async (request, env) => {
  const { user } = await authenticate(request, env);
  const { results } = await env.DB.prepare(
    `SELECT id, label, fire_at, status, created_at
       FROM partner_alerts
      WHERE sender_id = ? AND status = 'scheduled'
      ORDER BY fire_at ASC`,
  )
    .bind(user.id)
    .all();

  return {
    alerts: (results || []).map((a) => ({
      id: a.id,
      label: a.label,
      fireAt: a.fire_at,
      status: a.status,
      createdAt: a.created_at,
    })),
  };
});

// Edit a pending partner alert (new time and/or new label).
route('PATCH', '/api/alerts/partner-timer/:id', async (request, env, params) => {
  const { user } = await authenticate(request, env);
  const body = await readJson(request);

  const existing = await env.DB.prepare('SELECT * FROM partner_alerts WHERE id = ? AND sender_id = ?')
    .bind(params.id, user.id)
    .first();
  if (!existing) throw new HttpError(404, 'No such scheduled alert');
  if (existing.status !== 'scheduled') throw new HttpError(409, `Alert already ${existing.status}`);

  const label = requireString(body, 'label', { max: 80, optional: true }) || existing.label;
  const fireAt = body.seconds === undefined && body.fireAt === undefined ? existing.fire_at : resolveFireAt(body);

  await env.DB.prepare('UPDATE partner_alerts SET label = ?, fire_at = ? WHERE id = ?')
    .bind(label, fireAt, params.id)
    .run();

  return { id: params.id, label, fireAt, status: 'scheduled' };
});

// Cancel a pending partner alert.
route('POST', '/api/alerts/partner-timer/:id/cancel', async (request, env, params) => {
  const { user } = await authenticate(request, env);
  const result = await env.DB.prepare(
    "UPDATE partner_alerts SET status = 'cancelled' WHERE id = ? AND sender_id = ? AND status = 'scheduled'",
  )
    .bind(params.id, user.id)
    .run();

  if (!result.meta?.changes) throw new HttpError(404, 'No pending alert with that id');
  return { id: params.id, status: 'cancelled' };
});

// The only history this app keeps: what was sent, by whom, when.
route('GET', '/api/alerts/log', async (request, env) => {
  const { user, partner } = await authenticate(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 1), 100);

  const { results } = await env.DB.prepare(
    `SELECT id, sender_id, kind, label, delivered, failed, created_at
       FROM alert_log
      WHERE pair_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
  )
    .bind(user.pair_id, limit)
    .all();

  return {
    entries: (results || []).map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      direction: e.sender_id === user.id ? 'sent' : 'received',
      who: e.sender_id === user.id ? user.display_name : partner?.display_name || 'Partner',
      delivered: e.delivered,
      failed: e.failed,
      createdAt: e.created_at,
    })),
  };
});

// Accepts either `seconds` (a countdown, what the UI sends) or an absolute
// `fireAt` unix timestamp. Capped at 7 days so a typo can't park a ping forever.
function resolveFireAt(body) {
  const MAX_AHEAD = 7 * 24 * 60 * 60;
  if (body.seconds !== undefined) {
    const seconds = Number(body.seconds);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_AHEAD) {
      throw new HttpError(400, 'seconds must be between 1 and 604800 (7 days)');
    }
    return now() + Math.round(seconds);
  }
  if (body.fireAt !== undefined) {
    const fireAt = Number(body.fireAt);
    if (!Number.isFinite(fireAt) || fireAt <= now() || fireAt > now() + MAX_AHEAD) {
      throw new HttpError(400, 'fireAt must be a unix timestamp within the next 7 days');
    }
    return Math.round(fireAt);
  }
  throw new HttpError(400, 'Provide either seconds or fireAt');
}

/* ------------------------------------------------------------------ */
/* Digital Asset Links (Android APK <-> this origin)                   */
/* ------------------------------------------------------------------ */

// Chrome fetches /.well-known/assetlinks.json to decide whether the Signal Ping
// APK may open this site as a Trusted Web Activity (full screen, no URL bar).
// It is served from the Worker rather than public/ because Workers Assets skips
// dot-directories, so a committed .well-known file would never be served.
//
// Fill in the two vars in wrangler.toml after building the APK:
//   ANDROID_PACKAGE_NAME     e.g. io.github.dev0root6.signalping
//   ANDROID_CERT_FINGERPRINTS  SHA-256 fingerprints of the signing certs,
//                              comma-separated (see npm run assetlinks).
function assetLinksResponse(env) {
  const fingerprints = (env.ANDROID_CERT_FINGERPRINTS || '')
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);

  const statements =
    fingerprints.length && env.ANDROID_PACKAGE_NAME
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: env.ANDROID_PACKAGE_NAME,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : []; // Not configured yet — an empty list is valid and simply verifies nothing.

  return new Response(JSON.stringify(statements, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      // Chrome caches this; keep it short so a re-signed APK verifies quickly.
      'Cache-Control': 'public, max-age=300',
    },
  });
}

/* ------------------------------------------------------------------ */
/* Worker entry points                                                 */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    // Proves to Android that the Signal Ping APK owns this origin.
    if (url.pathname === '/.well-known/assetlinks.json') return assetLinksResponse(env);

    // Anything that isn't /api/* is the PWA shell, served by Workers Assets.
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    }

    for (const r of routes) {
      if (r.method !== request.method) continue;
      const match = r.pattern.exec({ pathname: url.pathname });
      if (!match) continue;
      try {
        const data = await r.handler(request, env, match.pathname.groups, ctx);
        return json(data, 200, request, env);
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status, request, env);
        console.error('unhandled error', err);
        return json({ error: 'Internal error' }, 500, request, env);
      }
    }

    return json({ error: 'Not found' }, 404, request, env);
  },

  // Cron trigger (every minute, see wrangler.toml). Sweeps D1 for partner
  // alerts whose countdown has elapsed and pushes them. This is why the app
  // needs no persistent timer anywhere.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchDueAlerts(env));
  },
};

export async function dispatchDueAlerts(env) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM partner_alerts
      WHERE status = 'scheduled' AND fire_at <= ?
      ORDER BY fire_at ASC
      LIMIT 100`,
  )
    .bind(now())
    .all();

  const due = results || [];
  if (!due.length) return { processed: 0 };

  for (const alert of due) {
    // Claim the row first: if two cron invocations overlap, only one wins the
    // UPDATE and the alert is sent exactly once.
    const claim = await env.DB.prepare(
      "UPDATE partner_alerts SET status = 'sending' WHERE id = ? AND status = 'scheduled'",
    )
      .bind(alert.id)
      .run();
    if (!claim.meta?.changes) continue;

    try {
      const sender = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(alert.sender_id).first();
      const recipient = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(alert.recipient_id)
        .first();

      if (!sender || !recipient) {
        await env.DB.prepare("UPDATE partner_alerts SET status = 'failed' WHERE id = ?").bind(alert.id).run();
        continue;
      }

      const { delivered } = await dispatchAlert(
        {
          pairId: alert.pair_id,
          sender,
          recipient,
          kind: 'partner_timer',
          label: alert.label,
        },
        env,
      );

      await env.DB.prepare("UPDATE partner_alerts SET status = ?, sent_at = ? WHERE id = ?")
        .bind(delivered > 0 ? 'sent' : 'failed', now(), alert.id)
        .run();
    } catch (err) {
      console.error('failed to dispatch partner alert', alert.id, err);
      await env.DB.prepare("UPDATE partner_alerts SET status = 'failed', sent_at = ? WHERE id = ?")
        .bind(now(), alert.id)
        .run();
    }
  }

  return { processed: due.length };
}
