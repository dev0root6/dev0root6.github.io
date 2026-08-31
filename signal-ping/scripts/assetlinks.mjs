// Prints the SHA-256 signing fingerprint of an APK keystore, ready to paste
// into wrangler.toml as ANDROID_CERT_FINGERPRINTS.
//
//   npm run assetlinks -- android/signal-ping.keystore signalping
//
// Chrome compares this fingerprint against the one in the installed APK before
// it will show the site full screen with no URL bar.

import { execFileSync } from 'node:child_process';

const [keystore, alias = 'signalping'] = process.argv.slice(2);
if (!keystore) {
  console.error('Usage: npm run assetlinks -- <keystore-path> [key-alias]');
  process.exit(1);
}

const password = process.env.SIGNAL_PING_KEYSTORE_PASSWORD;
if (!password) {
  console.error('Set SIGNAL_PING_KEYSTORE_PASSWORD before running this.');
  process.exit(1);
}

let output;
try {
  output = execFileSync(
    'keytool',
    ['-list', '-v', '-keystore', keystore, '-alias', alias, '-storepass', password],
    { encoding: 'utf8' },
  );
} catch (err) {
  console.error('keytool failed — check the keystore path, alias and password.\n');
  console.error(err.stdout || err.message);
  process.exit(1);
}

const match = output.match(/SHA256:\s*([A-F0-9:]+)/i);
if (!match) {
  console.error('No SHA-256 fingerprint found in the keytool output.');
  process.exit(1);
}

const fingerprint = match[1].toUpperCase();
console.log('\nSHA-256 fingerprint:\n');
console.log(' ', fingerprint);
console.log('\nPut it in wrangler.toml, then redeploy:\n');
console.log(`  ANDROID_CERT_FINGERPRINTS = "${fingerprint}"`);
console.log('\nVerify after deploying:');
console.log('  curl https://<your-worker-host>/.well-known/assetlinks.json\n');
