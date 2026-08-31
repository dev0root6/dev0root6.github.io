// Web Push for Cloudflare Workers — no npm dependencies, WebCrypto only.
//
// Implements:
//   * VAPID (RFC 8292) — an ES256 JWT proving we own the application server key.
//   * Message encryption (RFC 8291) — aes128gcm content encoding, so the push
//     service relays a payload it cannot read.
//
// Everything here is stateless; callers pass in the subscription row from D1.

/* ------------------------------------------------------------------ */
/* base64url + byte helpers                                            */
/* ------------------------------------------------------------------ */

export function b64urlToBytes(s) {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes) {
  let bin = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

const utf8 = (s) => new TextEncoder().encode(s);

/* ------------------------------------------------------------------ */
/* HKDF (RFC 5869), the single-block form Web Push needs               */
/* ------------------------------------------------------------------ */

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

// All Web Push HKDF outputs are <= 32 bytes, so one T(1) block is enough.
async function hkdf(salt, ikm, info, length) {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

/* ------------------------------------------------------------------ */
/* VAPID                                                               */
/* ------------------------------------------------------------------ */

// The VAPID key pair is stored as base64url: the raw 32-byte private scalar and
// the uncompressed 65-byte public point (generate them with scripts/generate-vapid.mjs).
async function importVapidPrivateKey(privateKeyB64, publicKeyB64) {
  const d = b64urlToBytes(privateKeyB64);
  const pub = b64urlToBytes(publicKeyB64); // 0x04 || X(32) || Y(32)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point (base64url)');
  }
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: bytesToB64url(d),
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

// Signed JWT for one push service origin. Cheap enough to mint per request, but
// callers batching to the same origin can reuse it (see sendPushBatch).
export async function vapidAuthHeader(audience, env) {
  const key = await importVapidPrivateKey(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
  const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToB64url(
    utf8(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // spec caps this at 24h
        sub: env.VAPID_SUBJECT, // mailto: or https: contact for the push service
      }),
    ),
  );
  const signingInput = utf8(`${header}.${payload}`);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput),
  );
  // WebCrypto already returns the raw r||s form that JWS wants.
  return `vapid t=${header}.${payload}.${bytesToB64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/* ------------------------------------------------------------------ */
/* Payload encryption (RFC 8291, aes128gcm)                            */
/* ------------------------------------------------------------------ */

export async function encryptPayload(plaintext, p256dhB64, authB64) {
  const uaPublicRaw = b64urlToBytes(p256dhB64); // client public key, 65 bytes
  const authSecret = b64urlToBytes(authB64); // 16 bytes

  // Ephemeral ("application server") key pair, fresh for every message.
  const asKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, asKeys.privateKey, 256),
  );

  // ikm = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_pub || as_pub)
  const keyInfo = concat(utf8('WebPush: info'), new Uint8Array([0]), uaPublicRaw, asPublicRaw);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, concat(utf8('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(utf8('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  // Single record: plaintext || 0x02 (last-record delimiter), then AES-GCM.
  const record = concat(utf8(plaintext), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record),
  );

  // aes128gcm header: salt(16) || record_size(4, big endian) || idlen(1) || keyid
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublicRaw.length]), asPublicRaw, ciphertext);
}

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

/**
 * Push one notification to one subscription.
 *
 * @returns {Promise<{ok: boolean, status: number, gone: boolean}>}
 *          `gone` marks a subscription the push service has permanently
 *          rejected (404/410) — the caller should delete that row from D1.
 */
export async function sendPush(subscription, payloadObject, env, options = {}) {
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;
  const body = await encryptPayload(JSON.stringify(payloadObject), subscription.p256dh, subscription.auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: options.authorization || (await vapidAuthHeader(audience, env)),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      // How long the push service may hold the message if the device is offline.
      TTL: String(options.ttl ?? 60 * 60 * 24),
      // Alerts are the whole point of this app, so never let them be coalesced away.
      Urgency: options.urgency || 'high',
    },
    body,
  });

  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}

/**
 * Push the same payload to every subscription of a user, in parallel.
 * Subscriptions the push service reports as gone are deleted from D1.
 *
 * @returns {Promise<{delivered: number, failed: number}>}
 */
export async function sendPushToSubscriptions(subscriptions, payloadObject, env) {
  let delivered = 0;
  let failed = 0;

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        return { sub, res: await sendPush(sub, payloadObject, env) };
      } catch (err) {
        console.error('push error', sub.endpoint, err);
        return { sub, res: { ok: false, status: 0, gone: false } };
      }
    }),
  );

  const dead = [];
  for (const { sub, res } of results) {
    if (res.ok) delivered++;
    else {
      failed++;
      if (res.gone) dead.push(sub.id);
    }
  }

  if (dead.length) {
    const placeholders = dead.map(() => '?').join(',');
    await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`)
      .bind(...dead)
      .run();
  }

  return { delivered, failed };
}
