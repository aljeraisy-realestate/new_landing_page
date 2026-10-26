import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { cities } from '../shared/courier.js';
import { migrate } from './migrations.js';
import { sqliteFile } from './sqlite-directory.js';
import { canonicalCity, cityAliases, normalizeCourierFilters } from '../shared/courier-filters.js';

export const hash = (value) => createHash('sha256').update(value).digest('hex');
const csrfFor = (token, binding) => createHmac('sha256', binding).update(token).digest('hex');

export function openStore(root, filename, dataDirectory, requireExisting = false) {
  const file = sqliteFile(root, filename, dataDirectory, requireExisting);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file, { enableForeignKeyConstraints: true, enableDoubleQuotedStringLiterals: false });
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
  `);
  try { migrate(db); } catch (error) { db.close(); throw error; }
  const insert = db.prepare(`INSERT INTO courier_leads (name, phone, city, phone_type, ref, locale)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(phone) DO NOTHING RETURNING id`);
  const counters = Object.fromEntries(['admin_login_attempts', 'courier_submission_limits'].map((table) => [table, db.prepare(`
    INSERT INTO ${table} (key, attempts, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
    attempts = CASE WHEN reset_at <= ? THEN 1 ELSE MIN(attempts + 1, 10001) END,
    reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    RETURNING attempts, reset_at`)]));
  const courierQuery = (filters) => {
    const { search, status, city, phone, phoneType, sortBy, sortDirection } = normalizeCourierFilters(filters);
    const aliases = cityAliases(city);
    const cityIds = `,${cities.filter((city) => city.some((label) => label.toLowerCase().includes(search.toLowerCase()))).map(([id]) => id).join(',')},`;
    const from = 'FROM courier_leads AS leads LEFT JOIN courier_lead_reviews AS reviews ON reviews.lead_id = leads.id';
    const where = `WHERE (? = '' OR COALESCE(reviews.status, 'new') = ?) AND (? = '' OR instr(lower(leads.name), lower(?)) > 0 OR instr(leads.phone, ?) > 0 OR instr(lower(leads.city), lower(?)) > 0 OR instr(?, ',' || leads.city || ',') > 0)
      AND (? = '' OR lower(leads.city) IN (${aliases.map(() => '?').join(',')}))
      AND (? = '' OR instr(leads.phone, ?) > 0) AND (? = '' OR leads.phone_type = ?)`;
    const columns = { id: 'leads.id', name: 'leads.name COLLATE NOCASE', phone: 'leads.phone', city: 'leads.city COLLATE NOCASE', phone_type: 'leads.phone_type', created_at: 'julianday(leads.created_at)', status: "COALESCE(reviews.status, 'new')" };
    const direction = sortDirection === 'asc' ? 'ASC' : 'DESC';
    return { from, where, params: [status, status, search, search, search, search, cityIds, city, ...aliases, phone, phone, phoneType, phoneType], order: `${columns[sortBy]} ${direction}, leads.id ${direction}` };
  };

  return {
    file,
    close: () => db.close(),
    clean(now = Date.now()) {
      db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now);
      db.prepare('DELETE FROM admin_login_attempts WHERE reset_at <= ?').run(now);
      db.prepare('DELETE FROM courier_submission_limits WHERE reset_at <= ?').run(now);
    },
    limit(key, maximum, milliseconds) {
      const now = Date.now();
      const counter = counters[key.startsWith('login:') ? 'admin_login_attempts' : 'courier_submission_limits'];
      const result = counter.get(key, now + milliseconds, now, now);
      return result.attempts > maximum ? Math.max(1, Math.ceil((result.reset_at - now) / 1000)) : 0;
    },
    addCourier(courier) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const lead = insert.get(courier.name, courier.phone, courier.city, courier.phoneType, courier.ref ?? null, courier.locale);
        if (lead) db.prepare('INSERT INTO courier_lead_reviews (lead_id, status, consent_at) VALUES (?, ?, ?)').run(lead.id, 'new', new Date().toISOString());
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    importCouriers(records) {
      const imported = db.prepare(`INSERT INTO courier_leads (name, phone, city, phone_type, ref, locale, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, ?, CURRENT_TIMESTAMP))
        ON CONFLICT(phone) DO NOTHING RETURNING id`);
      let added = 0;
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const row of records) {
          const lead = imported.get(row.name, row.phone, row.city, row.phoneType, row.ref, row.locale, row.createdAt, row.updatedAt, row.createdAt);
          if (lead) {
            db.prepare('INSERT INTO courier_lead_reviews (lead_id, status, consent_at) VALUES (?, ?, ?)').run(lead.id, row.status, row.consentAt);
            added += 1;
          }
        }
        db.exec('COMMIT');
        return { added, skipped: records.length - added };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    exportCouriers(filters) {
      const { from, where, params, order } = courierQuery(filters);
      return db.prepare(`SELECT leads.*, COALESCE(reviews.status, 'new') AS status, reviews.consent_at ${from} ${where} ORDER BY ${order} LIMIT 10001`).all(...params);
    },
    createSession(token, binding, expiresAt, refreshToken) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO admin_sessions (token_hash, credential_hash, expires_at) VALUES (?, ?, ?)').run(hash(token), binding, expiresAt);
        if (refreshToken) db.prepare('INSERT INTO admin_refresh_tokens (token_hash, session_hash, expires_at) VALUES (?, ?, ?)').run(hash(refreshToken), hash(token), expiresAt);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return csrfFor(token, binding);
    },
    session(token, binding, now = Date.now()) {
      const session = db.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ? AND credential_hash = ? AND expires_at > ?').get(hash(token), binding, now);
      return session ? { ...session, csrf_token: csrfFor(token, binding) } : undefined;
    },
    refreshRecord(token, sid, binding, now = Date.now()) {
      return db.prepare(`SELECT refresh.used_at, sessions.expires_at FROM admin_refresh_tokens AS refresh
        JOIN admin_sessions AS sessions ON sessions.token_hash = refresh.session_hash
        WHERE refresh.token_hash = ? AND refresh.session_hash = ? AND sessions.credential_hash = ?
        AND refresh.expires_at > ? AND sessions.expires_at > ?`).get(hash(token), hash(sid), binding, now, now);
    },
    rotateRefresh(token, nextToken, sid, binding, now = Date.now()) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const record = this.refreshRecord(token, sid, binding, now);
        let result = 'invalid';
        if (record?.used_at != null) {
          // A second tab can send the previous cookie before the first response arrives.
          // It receives no credentials. Reuse after this short window revokes the family.
          result = now - record.used_at <= 5000 ? 'raced' : 'replayed';
          if (result === 'replayed') this.removeSession(sid);
        } else if (record) {
          db.prepare('UPDATE admin_refresh_tokens SET used_at = ? WHERE token_hash = ?').run(now, hash(token));
          db.prepare('INSERT INTO admin_refresh_tokens (token_hash, session_hash, expires_at) VALUES (?, ?, ?)').run(hash(nextToken), hash(sid), record.expires_at);
          result = 'rotated';
        }
        db.exec('COMMIT');
        return result;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    removeSession(token) { db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hash(token)); },
    list(filters) {
      const normalized = normalizeCourierFilters(filters);
      const { pageSize } = normalized;
      const { from, where, params, order } = courierQuery(normalized);
      const total = db.prepare(`SELECT COUNT(*) AS count ${from} ${where}`).get(...params).count;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(normalized.page, totalPages);
      const items = db.prepare(`SELECT leads.*, COALESCE(reviews.status, 'new') AS status, reviews.consent_at ${from} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
      const counts = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(COALESCE(reviews.status, 'new') = 'new'), 0) AS new, COALESCE(SUM(reviews.status = 'contacted'), 0) AS contacted, COALESCE(SUM(reviews.status = 'accepted'), 0) AS accepted ${from}`).get();
      const cityOptions = [...new Set(db.prepare('SELECT DISTINCT city FROM courier_leads ORDER BY city COLLATE NOCASE').all().map(({ city }) => canonicalCity(city)))];
      return { items, total, page, pageSize, totalPages, hasPrevious: page > 1, hasNext: page < totalPages, cityOptions, counts };
    },
    setStatus(id, status) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db.prepare(`INSERT INTO courier_lead_reviews (lead_id, status)
          SELECT id, ? FROM courier_leads WHERE id = ?
          ON CONFLICT(lead_id) DO UPDATE SET status = excluded.status`).run(status, id);
        if (result.changes > 0) db.prepare('UPDATE courier_leads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
        db.exec('COMMIT');
        return result.changes > 0;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
