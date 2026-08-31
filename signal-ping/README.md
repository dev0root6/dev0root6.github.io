# Signal Ping

A private, invite-only alert app for exactly two people. Both of you mute
notifications everywhere else; this app's only job is to reliably get the other
person's attention.

It is **not** a messenger. There is no chat and no message history — only a log
of which alerts were sent and when.

**Three features**

| Feature | What it does | Who is notified |
| --- | --- | --- |
| **Live Alert** | One tap sends an instant push. | Your partner, right now |
| **Self Timer** | A countdown you set for yourself. | You only, on this device |
| **Partner Timer** | A countdown you set for them; cancellable/editable until it fires. | Your partner, when it expires |

**Stack**

- **Android app** — a Trusted Web Activity shell (`android/`), installable as an APK.
- **PWA** — plain HTML/CSS/JS, no build step (`public/`). Installable on iOS too.
- **Backend** — Cloudflare Worker + D1 (`worker/`, `migrations/`).
- **Delivery** — Web Push with VAPID, dispatched by the Worker; scheduled pings
  are swept by a cron trigger that runs every minute.

---

## Repository layout

```
signal-ping/
├── android/                 Android APK project (Trusted Web Activity)
│   ├── app/build.gradle     applicationId, signing, the host it opens
│   └── app/src/main/…       manifest, LauncherActivity, DelegationService, icons
├── migrations/0001_init.sql D1 schema
├── worker/src/
│   ├── index.js             API routes + the cron sweep
│   └── push.js              VAPID + RFC 8291 encryption, WebCrypto only
├── public/                  the PWA (also what the APK opens)
│   ├── index.html app.js styles.css
│   ├── sw.js                offline shell + push handler
│   └── manifest.webmanifest icons/
├── scripts/                 VAPID keys, icons, assetlinks, crypto self-test
└── wrangler.toml
```

---

## 1. Backend setup

Requires Node 18+ and a Cloudflare account.

```bash
cd signal-ping
npm install
```

**Create the database**

```bash
npx wrangler d1 create signal_ping
```

Copy the printed `database_id` into `wrangler.toml`, then apply the schema:

```bash
npm run db:migrate:local     # local dev copy
npm run db:migrate           # your real (remote) D1
```

**Generate VAPID keys** — these identify your server to the push services. Keep
them stable; rotating them invalidates every existing subscription.

```bash
npm run vapid
```

Store them as Worker secrets, and copy the same pair into `.dev.vars` (git-ignored,
see `.dev.vars.example`) for local development:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

Set `VAPID_SUBJECT` in `wrangler.toml` to your `mailto:` address.

**Run and deploy**

```bash
npm run dev        # http://localhost:8787 — serves both the API and the PWA
npm run deploy     # -> https://signal-ping.<your-subdomain>.workers.dev
npm test           # offline self-check of the push crypto (no account needed)
```

The Worker serves the PWA from `public/`, so one deploy gives you both the API
and the installable web app on the same origin.

---

## 2. Getting the APK

The Android app is a **Trusted Web Activity**: a thin native shell that opens
your deployed PWA full screen using Chrome's engine, with notification
delegation switched on. Web Push therefore keeps working exactly as it does in
the browser — alerts arrive with the app closed, under the "Signal Ping" app
identity, so you can mute Chrome everywhere else and still be reachable.

There is no app code to maintain: the manifest, a launcher activity that asks
for `POST_NOTIFICATIONS`, and a delegation service is the whole app.

### Option A — build it in GitHub Actions (no Android Studio)

`.github/workflows/signal-ping-android.yml` builds the APK and uploads it as a
run artifact.

1. In the repo settings, add a **variable** `SIGNAL_PING_HOST` =
   `signal-ping.<your-subdomain>.workers.dev`.
2. Push, or run the workflow manually (**Actions → Signal Ping Android → Run workflow**).
3. Download **Artifacts → signal-ping-apk** and sideload the `.apk` on both phones.

Without signing secrets it produces a debug-signed APK, which sideloads fine.
For a stable signature (needed to update the app in place, and to verify the
domain), add the secrets listed at the top of the workflow file.

### Option B — build locally

Requires JDK 17+ and the Android SDK (Android Studio, or command-line tools).

```bash
cd signal-ping/android

# Debug build — quickest path to something installable.
./gradlew assembleDebug -PsignalPingHost=signal-ping.you.workers.dev
# -> app/build/outputs/apk/debug/app-debug.apk

# Release build — create a keystore once, then reuse it forever.
keytool -genkeypair -v -keystore signal-ping.keystore \
        -alias signalping -keyalg RSA -keysize 2048 -validity 10000

export SIGNAL_PING_KEYSTORE=$PWD/signal-ping.keystore
export SIGNAL_PING_KEYSTORE_PASSWORD=…       # what you just chose
export SIGNAL_PING_KEY_ALIAS=signalping
export SIGNAL_PING_KEY_PASSWORD=…
./gradlew assembleRelease -PsignalPingHost=signal-ping.you.workers.dev
# -> app/build/outputs/apk/release/app-release.apk
```

Keep the keystore safe and out of git (`android/.gitignore` already excludes
`*.keystore`). Losing it means future builds can no longer update an installed app.

### Installing it

Copy the `.apk` to each phone and open it. Android will ask you to allow
installing from that source the first time. On first launch, **allow
notifications** — the app is useless without it.

### Verify the domain (removes the URL bar)

Until Android can prove the APK and the site belong together, Chrome shows the
site with a URL bar. To fix that, publish your signing fingerprint:

```bash
cd signal-ping
export SIGNAL_PING_KEYSTORE_PASSWORD=…
npm run assetlinks -- android/signal-ping.keystore signalping
```

Put the printed fingerprint in `wrangler.toml`:

```toml
ANDROID_PACKAGE_NAME = "io.github.dev0root6.signalping"
ANDROID_CERT_FINGERPRINTS = "AB:CD:…"
```

Redeploy, then check:

```bash
curl https://signal-ping.<your-subdomain>.workers.dev/.well-known/assetlinks.json
```

Reinstall the app; the URL bar should be gone. (The Worker serves this file from
a route rather than `public/`, because Workers Assets skips dot-directories.)
A debug build has a different package name (`…signalping.debug`) and a different
signing key, so verification applies to release builds.

### iPhone

iOS has no APK. Open the Worker URL in **Safari**, then **Share → Add to Home
Screen**. Web Push works on iOS 16.4+ **only** from that home-screen icon, never
from a Safari tab. Open it from the home screen and enable notifications in
Settings.

---

## 3. Pairing the two of you

1. Both people open the app (APK or home-screen icon).
2. One person taps **Suggest** for a code, or types their own (8+ characters),
   and taps **Pair this device**. That creates the pair.
3. They send the code to the other person privately — the code is the shared
   secret, and it is only ever stored hashed.
4. The second person enters the same code. The pair is now **full**: a third
   person entering the code is rejected.
5. Both go to **Settings → Enable notifications on this device**, then
   **Send test notification** to confirm delivery before relying on it.

**Adding a second device (or reinstalling):** Settings shows an *access token*.
Copy it, and on the other device use **Already paired? Add another device**.
Treat that token like a password.

---

## 4. How the three features behave

**Live Alert** — `POST /api/alerts/live` pushes to every device your partner has
registered. Repeat taps within 3 seconds are rejected so a double tap doesn't
buzz them twice.

**Self Timer** — never touches the server. The deadline is stored on the device
and fires through the service worker. Keep the app open or backgrounded for it to
fire on time; if Android kills the app entirely, you get the reminder (clearly
marked as late) the next time you open it. This is the deliberate trade-off of
"my device only" — nothing is sent anywhere.

**Partner Timer** — stored in D1 with a `fire_at` timestamp. The cron trigger
runs every minute, claims due rows with a conditional `UPDATE` (so overlapping
runs can't double-send), pushes, and records the result. You can edit or cancel
it right up until it fires, and you do not need to keep the app open.

Because the cron granularity is one minute, a ping can land up to ~60 seconds
after its exact deadline.

---

## 5. API reference

All authenticated calls take `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/push/vapid-public-key` | Public key for `pushManager.subscribe` |
| `POST` | `/api/pair/join` | Create or join a pair with a shared code |
| `GET` | `/api/me` | Profile, partner status, registered devices |
| `PATCH` | `/api/settings` | Edit display name and the three alert labels |
| `POST` | `/api/push/subscribe` | Register/refresh this device (idempotent per endpoint) |
| `POST` | `/api/push/unsubscribe` | Drop this device |
| `POST` | `/api/push/test` | Push a test alert to yourself |
| `POST` | `/api/alerts/live` | **Live Alert** |
| `POST` | `/api/alerts/partner-timer` | Schedule a **Partner Timer** (`seconds` or `fireAt`) |
| `GET` | `/api/alerts/partner-timer` | List your pending scheduled alerts |
| `PATCH` | `/api/alerts/partner-timer/:id` | Reschedule or relabel |
| `POST` | `/api/alerts/partner-timer/:id/cancel` | Cancel |
| `GET` | `/api/alerts/log?limit=30` | Alert log for the pair |
| `GET` | `/.well-known/assetlinks.json` | Android app verification |

### Data model

`pairs` · `users` · `push_subscriptions` · `partner_alerts` · `alert_log` —
see `migrations/0001_init.sql`, which is commented table by table.

### Security notes

- Pairing codes and bearer tokens are stored **hashed** (SHA-256); the plaintext
  token exists only on your devices.
- A pair holds exactly two people; a third join attempt is refused.
- Push payloads are encrypted end-to-end per RFC 8291 — the push service relays
  bytes it cannot read.
- The Worker never stores message content, because there isn't any: an alert is
  a label and a timestamp.
- Choose a pairing code nobody would guess; anyone who has it before your
  partner joins can take the second slot. If that happens, pick a new code and
  pair again.

---

## 6. Keeping the repo private

This is meant to be a private repo. If you have not created one yet:

```bash
gh repo create signal-ping --private --source=. --remote=origin --push
```

Or on github.com: **New repository → Private**, then

```bash
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Never commit `.dev.vars`, `*.keystore`, or the VAPID private key — `.gitignore`
covers all three. If a private key does get committed, generate a new pair and
rotate the Worker secrets; both phones then need to re-enable notifications.

---

## Troubleshooting

**No notification arrives.** Check Settings → the device list shows the phone,
then use **Send test notification**. If the test works but partner alerts don't,
the partner has no device registered.

**Nothing arrives on iPhone.** It must be launched from the home-screen icon,
not a Safari tab, on iOS 16.4+.

**The app shows a URL bar.** Digital Asset Links aren't verified — see
*Verify the domain* above.

**Alerts stopped after a reinstall.** Push endpoints rotate. Opening the app
re-registers them automatically; if not, toggle notifications off and on in Settings.

**A partner timer fired late.** Expected: the cron sweep runs once a minute.
