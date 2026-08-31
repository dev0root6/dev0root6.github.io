// Generates a VAPID key pair for Web Push.
//
//   npm run vapid
//
// Prints the two values Signal Ping needs. Store them as Worker secrets:
//   wrangler secret put VAPID_PUBLIC_KEY
//   wrangler secret put VAPID_PRIVATE_KEY
// and copy the same pair into .dev.vars for local development.
//
// Keep the private key secret and stable: rotating it invalidates every push
// subscription both phones have registered, and they must re-subscribe.

import { webcrypto as crypto } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);

// Public key: the raw uncompressed P-256 point (65 bytes) the browser expects
// as applicationServerKey.
const publicKey = b64url(await crypto.subtle.exportKey('raw', keys.publicKey));

// Private key: the raw 32-byte scalar `d` from the JWK export.
const jwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
const privateKey = jwk.d;

console.log('\nVAPID key pair for Signal Ping\n');
console.log('VAPID_PUBLIC_KEY  =', publicKey);
console.log('VAPID_PRIVATE_KEY =', privateKey);
console.log('\nNext:');
console.log('  wrangler secret put VAPID_PUBLIC_KEY');
console.log('  wrangler secret put VAPID_PRIVATE_KEY');
console.log('  ...and copy both into .dev.vars for `wrangler dev`.\n');
