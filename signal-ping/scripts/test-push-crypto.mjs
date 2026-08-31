// Self-check for the Web Push crypto in worker/src/push.js.
//
//   npm test
//
// Two assertions, both done the way a real push client would:
//   1. A payload encrypted for a subscription decrypts back to the same JSON
//      (RFC 8291 / aes128gcm), using an independently written decryptor.
//   2. The VAPID Authorization header carries a JWT that verifies against the
//      public key it advertises (RFC 8292).
// No network, no Cloudflare account needed.

import { webcrypto as crypto } from 'node:crypto';
import { encryptPayload, vapidAuthHeader, b64urlToBytes, bytesToB64url } from '../worker/src/push.js';

globalThis.crypto ??= crypto;

const utf8 = (s) => new TextEncoder().encode(s);
const concat = (...cs) => {
  const out = new Uint8Array(cs.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of cs) (out.set(c, off), (off += c.length));
  return out;
};

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}
async function hkdf(salt, ikm, info, len) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, len);
}

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
  console.log('  ok —', message);
}

/* 1. Encrypt for a simulated browser subscription, then decrypt as that browser. */
console.log('aes128gcm payload encryption');

const uaKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeys.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));

const message = JSON.stringify({ kind: 'live', label: 'Free to talk', from: 'A', sentAt: 1 });
const body = await encryptPayload(message, bytesToB64url(uaPublicRaw), bytesToB64url(authSecret));

// Parse the aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid.
const salt = body.slice(0, 16);
const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
const idlen = body[20];
const asPublicRaw = body.slice(21, 21 + idlen);
const ciphertext = body.slice(21 + idlen);
assert(rs === 4096, 'record size header is 4096');
assert(idlen === 65 && asPublicRaw[0] === 0x04, 'key id is an uncompressed P-256 point');

const asPublicKey = await crypto.subtle.importKey('raw', asPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
const shared = new Uint8Array(
  await crypto.subtle.deriveBits({ name: 'ECDH', public: asPublicKey }, uaKeys.privateKey, 256),
);
const ikm = await hkdf(
  authSecret,
  shared,
  concat(utf8('WebPush: info'), new Uint8Array([0]), uaPublicRaw, asPublicRaw),
  32,
);
const cek = await hkdf(salt, ikm, concat(utf8('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
const nonce = await hkdf(salt, ikm, concat(utf8('Content-Encoding: nonce'), new Uint8Array([0])), 12);
const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
const plain = new Uint8Array(
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, ciphertext),
);

assert(plain[plain.length - 1] === 2, 'record ends with the 0x02 last-record delimiter');
assert(new TextDecoder().decode(plain.slice(0, -1)) === message, 'decrypted payload matches the original');

/* 2. VAPID header: mint one, then verify the JWT with the advertised key. */
console.log('VAPID Authorization header');

const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = {
  VAPID_PUBLIC_KEY: bytesToB64url(new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey))),
  VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d,
  VAPID_SUBJECT: 'mailto:you@example.com',
};

const header = await vapidAuthHeader('https://fcm.googleapis.com', env);
const [, jwt, advertisedKey] = header.match(/^vapid t=([^,]+), k=(.+)$/);
const [h, p, sig] = jwt.split('.');

assert(advertisedKey === env.VAPID_PUBLIC_KEY, 'header advertises the configured public key');
assert(JSON.parse(Buffer.from(h, 'base64url')).alg === 'ES256', 'JWT header declares ES256');

const claims = JSON.parse(Buffer.from(p, 'base64url'));
assert(claims.aud === 'https://fcm.googleapis.com', 'aud is the push service origin');
assert(claims.sub === env.VAPID_SUBJECT, 'sub is the configured contact');
assert(claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 86400, 'exp is within 24h');

const verified = await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' },
  vapid.publicKey,
  b64urlToBytes(sig),
  utf8(`${h}.${p}`),
);
assert(verified, 'JWT signature verifies against the public key');

console.log('\nAll push crypto checks passed.');
