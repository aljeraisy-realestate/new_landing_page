import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const tableExists = (db, name) => !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

export function migrate(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 3) throw new Error('This database needs a newer Giftly server.');
  db.exec('BEGIN IMMEDIATE');
  try {
    let legacySessions = false;
    if (tableExists(db, 'admin_sessions')) {
      const columns = db.prepare('PRAGMA table_info(admin_sessions)').all();
      const expected = ['token_hash', 'credential_hash', 'expires_at'];
      if (columns.length !== expected.length || columns.some((column, index) => column.name !== expected[index])) {
        if (tableExists(db, 'giftly_legacy_sessions_v1')) throw new Error('An unexpected legacy session table needs review.');
        db.exec('ALTER TABLE admin_sessions RENAME TO giftly_legacy_sessions_v1');
        legacySessions = true;
      }
    }
    db.exec(schema);
    if (version < 2) {
      if (tableExists(db, 'couriers')) {
        db.exec(`
          INSERT INTO courier_leads (name, phone, city, phone_type, ref, locale, created_at, updated_at)
          SELECT name, phone, CASE WHEN city = 'other' THEN city_other ELSE city END,
            phone_type, NULL, locale, COALESCE(datetime(created_at), CURRENT_TIMESTAMP),
            COALESCE(datetime(updated_at), CURRENT_TIMESTAMP)
          FROM couriers WHERE 1 ORDER BY created_at, id
          ON CONFLICT(phone) DO NOTHING;
          INSERT INTO courier_lead_reviews (lead_id, status, consent_at, legacy_id)
          SELECT leads.id, old.status, old.consent_at, old.id
          FROM couriers AS old JOIN courier_leads AS leads ON leads.phone = old.phone
          WHERE 1
          ON CONFLICT(lead_id) DO NOTHING;
        `);
      }
      if (tableExists(db, 'request_limits')) {
        db.exec(`
          INSERT INTO admin_login_attempts (key, attempts, reset_at)
          SELECT key, attempts, expires_at FROM request_limits WHERE key LIKE 'login:%'
          ON CONFLICT(key) DO UPDATE SET attempts = MAX(attempts, excluded.attempts), reset_at = MAX(reset_at, excluded.reset_at);
          INSERT INTO courier_submission_limits (key, attempts, reset_at)
          SELECT key, attempts, expires_at FROM request_limits WHERE key NOT LIKE 'login:%'
          ON CONFLICT(key) DO UPDATE SET attempts = MAX(attempts, excluded.attempts), reset_at = MAX(reset_at, excluded.reset_at);
        `);
      }
    }
    if (legacySessions) {
      db.exec('DROP TABLE giftly_legacy_sessions_v1');
      // An index renamed with the old table can temporarily occupy this name.
      db.exec('CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at)');
    }
    // Pre-JWT sessions cannot be reused as JWT refresh families.
    if (version < 3) db.exec('DELETE FROM admin_refresh_tokens; DELETE FROM admin_sessions');
    db.exec('PRAGMA user_version = 3; COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
