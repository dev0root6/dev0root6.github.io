-- Signal Ping — initial schema.
-- Applied with: wrangler d1 migrations apply signal_ping [--remote]
--
-- Design notes:
--  * A "pair" is the unit of trust. It holds exactly two users (slot 1 and slot 2)
--    and is created/joined with a shared pairing code (only its hash is stored).
--  * A "user" is one person in a pair. Their bearer token is stored hashed; the
--    plaintext token lives only on their device(s).
--  * Every alert that leaves a device is written to alert_log, which is the only
--    history this app keeps. There is no chat and no message bodies.

CREATE TABLE pairs (
  id           TEXT PRIMARY KEY,           -- uuid
  code_hash    TEXT NOT NULL UNIQUE,       -- sha256(pairing code), hex
  created_at   INTEGER NOT NULL            -- unix seconds
);

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,    -- uuid
  pair_id             TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  slot                INTEGER NOT NULL,    -- 1 or 2; a pair is full at slot 2
  token_hash          TEXT NOT NULL UNIQUE,-- sha256(bearer token), hex
  display_name        TEXT NOT NULL DEFAULT 'Me',
  -- Editable alert labels (see Settings in the PWA).
  live_label          TEXT NOT NULL DEFAULT 'Free to talk',
  partner_timer_label TEXT NOT NULL DEFAULT 'Ping me when this is up',
  self_timer_label    TEXT NOT NULL DEFAULT 'Check in',
  created_at          INTEGER NOT NULL,
  UNIQUE (pair_id, slot)
);

CREATE INDEX idx_users_pair ON users (pair_id);

CREATE TABLE push_subscriptions (
  id            TEXT PRIMARY KEY,          -- uuid
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,      -- push service URL
  p256dh        TEXT NOT NULL,             -- base64url client public key
  auth          TEXT NOT NULL,             -- base64url client auth secret
  user_agent    TEXT,                      -- for "which device is this?" in Settings
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL           -- refreshed on every /push/subscribe
);

CREATE INDEX idx_subs_user ON push_subscriptions (user_id);

CREATE TABLE partner_alerts (
  id            TEXT PRIMARY KEY,          -- uuid
  pair_id       TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  sender_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  fire_at       INTEGER NOT NULL,          -- unix seconds; the cron sweeps for fire_at <= now
  status        TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | sending | sent | cancelled | failed
  created_at    INTEGER NOT NULL,
  sent_at       INTEGER
);

-- The cron trigger's hot path: due, still-scheduled alerts.
CREATE INDEX idx_partner_alerts_due ON partner_alerts (status, fire_at);
CREATE INDEX idx_partner_alerts_sender ON partner_alerts (sender_id, status);

CREATE TABLE alert_log (
  id            TEXT PRIMARY KEY,          -- uuid
  pair_id       TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  sender_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,             -- live | partner_timer
  label         TEXT NOT NULL,
  delivered     INTEGER NOT NULL DEFAULT 0,-- count of push endpoints that accepted
  failed        INTEGER NOT NULL DEFAULT 0,-- count of endpoints that rejected
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_alert_log_pair ON alert_log (pair_id, created_at DESC);
