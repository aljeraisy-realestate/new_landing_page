-- Base tables mirror ../landing-page/db/schema.ts and its SQLite migrations.
CREATE TABLE IF NOT EXISTS courier_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  full_name TEXT NOT NULL, identity_type TEXT NOT NULL, identity_number TEXT NOT NULL,
  phone TEXT NOT NULL, city TEXT NOT NULL, email TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ar', status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS android_interest (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  contact TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'ar',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courier_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL,
  phone_type TEXT NOT NULL, ref TEXT, locale TEXT NOT NULL DEFAULT 'ar',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS courier_leads_phone_unique ON courier_leads(phone);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL, message TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'ar',
  status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL, credential_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_preferences (
  username TEXT PRIMARY KEY NOT NULL, theme TEXT NOT NULL DEFAULT 'light', language TEXT NOT NULL DEFAULT 'ar',
  CONSTRAINT admin_theme CHECK(theme IN ('light', 'dark')),
  CONSTRAINT admin_language CHECK(language IN ('ar', 'en'))
);
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  key TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS courier_submission_limits (
  key TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS courier_submission_expiry ON courier_submission_limits(reset_at);

-- This site's review/consent metadata stays separate from the reference tables.
CREATE TABLE IF NOT EXISTS courier_lead_reviews (
  lead_id INTEGER PRIMARY KEY REFERENCES courier_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'accepted')),
  consent_at TEXT,
  legacy_id TEXT UNIQUE
);

-- Rotating refresh credentials; reference admin_sessions keeps its original columns.
-- Only hashes are persisted. Used records are retained until the family expires.
CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  session_hash TEXT NOT NULL REFERENCES admin_sessions(token_hash) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS admin_refresh_session ON admin_refresh_tokens(session_hash);
