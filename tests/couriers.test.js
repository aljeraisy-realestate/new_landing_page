import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { normalizePhone, validateCourier } from '../shared/courier.js';
import { openStore } from '../server/store.js';
import { createApi } from '../server/api.js';

const applicant = { name: 'سارة أحمد', phone: '+966512345678', city: 'riyadh', cityOther: '', phoneType: 'iphone', locale: 'ar', consent: true };
const filters = { search: '', status: '', page: 1 };

test('normalizes Saudi phone formats and rejects invalid consent and injected fields', () => {
  assert.equal(normalizePhone('٠٥١٢٣٤٥٦٧٨'), '0512345678');
  assert.equal(normalizePhone('00966 51 234 5678'), '0512345678');
  assert.equal(normalizePhone('۱۲۳'), '');
  assert.equal(validateCourier(applicant)?.phone, '0512345678');
  assert.equal(validateCourier({ ...applicant, consent: false }), null);
  assert.equal(validateCourier({ ...applicant, status: 'accepted' }), null);
  assert.equal(validateCourier({ ...applicant, phone: '123' }), null);
  assert.equal(validateCourier({ ...applicant, city: 'unknown' }), null);
  assert.equal(validateCourier({ ...applicant, name: '<script>alert(1)</script>' }), null);
  assert.equal(validateCourier({ ...applicant, ref: 'launch_2026' })?.ref, 'launch_2026');
  assert.equal(validateCourier({ ...applicant, ref: '<script>' }), null);
  assert.equal(validateCourier({ ...applicant, city: 'other', cityOther: 'الخرج' })?.city, 'الخرج');
});

test('SQLite survives reopening, preserves duplicate applicants, and binds search filters', () => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-store-'));
  let store = openStore(directory);
  try {
    store.addCourier(validateCourier(applicant));
    store.addCourier(validateCourier({ ...applicant, name: 'Different Person' }));
    let result = store.list(filters);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].name, applicant.name);
    assert.equal(typeof result.items[0].id, 'number');
    assert.equal(result.items[0].ref, null);
    assert.match(result.items[0].created_at, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    assert.equal(store.list({ ...filters, search: 'الرياض' }).total, 1);
    assert.equal(store.list({ ...filters, search: "' OR 1=1 --" }).total, 0);
    assert.equal(store.list({ ...filters, search: '%' }).total, 0);
    assert.equal(store.setStatus(result.items[0].id, 'contacted'), true);
    store.close();
    store = openStore(directory);
    result = store.list({ ...filters, status: 'contacted' });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].phone, '0512345678');
    assert.equal(result.items[0].status, 'contacted');
    assert.ok(result.items[0].consent_at);
    for (let index = 0; index < 25; index += 1) store.addCourier(validateCourier({ ...applicant, phone: `05${String(index).padStart(8, '0')}` }));
    const firstPage = store.list(filters);
    const secondPage = store.list({ ...filters, page: 2 });
    assert.equal(firstPage.total, 26);
    assert.equal(firstPage.items.length, 25);
    assert.equal(secondPage.items.length, 1);
    assert.ok(!firstPage.items.some((row) => row.id === secondPage.items[0].id));
    assert.equal(store.limit('test-limit', 2, 60000), 0);
    const expiredToken = randomBytes(32).toString('hex');
    store.createSession(expiredToken, 'test-binding', Date.now() - 1);
    assert.equal(store.session(expiredToken, 'test-binding'), undefined);
    assert.equal(store.limit('test-limit', 2, 60000), 0);
    assert.ok(store.limit('test-limit', 2, 60000) > 0);
    store.clean(Date.now() + 60001);
    assert.equal(store.limit('test-limit', 2, 60000), 0);
    assert.throws(() => openStore(directory, 'public/exposed.sqlite'), /outside publicly served/);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('base table columns match the landing-page schema and preserve existing lead IDs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-schema-'));
  const filename = join(directory, 'reference.sqlite');
  let db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE courier_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL,
    phone TEXT NOT NULL, city TEXT NOT NULL, phone_type TEXT NOT NULL, ref TEXT,
    locale TEXT NOT NULL DEFAULT 'ar', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE UNIQUE INDEX courier_leads_phone_unique ON courier_leads(phone);`);
  db.prepare('INSERT INTO courier_leads (id, name, phone, city, phone_type, ref) VALUES (?, ?, ?, ?, ?, ?)').run(42, 'Existing Applicant', '0512345678', 'riyadh', 'iphone', 'existing-ref');
  db.close();
  const store = openStore(directory, filename);
  try {
    const row = store.list(filters).items[0];
    assert.equal(row.id, 42);
    assert.equal(row.ref, 'existing-ref');
    store.addCourier(validateCourier({ ...applicant, phone: '0512345679', ref: 'new-ref' }));
    assert.equal(store.list({ ...filters, search: '0512345679' }).items[0].id, 43);
    assert.ok(store.setStatus(42, 'contacted'));
    db = new DatabaseSync(filename);
    try {
      assert.deepEqual(db.prepare('PRAGMA table_info(courier_leads)').all().map((column) => column.name), ['id', 'name', 'phone', 'city', 'phone_type', 'ref', 'locale', 'created_at', 'updated_at']);
      assert.deepEqual(db.prepare('PRAGMA table_info(admin_sessions)').all().map((column) => column.name), ['token_hash', 'credential_hash', 'expires_at']);
      for (const name of ['courier_applications', 'android_interest', 'contact_messages', 'admin_preferences', 'admin_login_attempts', 'courier_submission_limits']) assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
      assert.equal(db.prepare('SELECT status FROM courier_lead_reviews WHERE lead_id = ?').get(42).status, 'contacted');
    } finally { db.close(); }
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('v1 data migration preserves applicants, custom cities, consent, review status, and limits', () => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-migration-'));
  const filename = join(directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(filename);
  legacy.exec(`
    CREATE TABLE couriers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL, city_other TEXT NOT NULL, phone_type TEXT NOT NULL, locale TEXT NOT NULL,
      status TEXT NOT NULL, consent_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL, session_binding TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);
    CREATE TABLE request_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    PRAGMA user_version = 1;
  `);
  const timestamp = '2026-10-25T18:00:00.000Z';
  legacy.prepare('INSERT INTO couriers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('legacy-uuid', 'Legacy Applicant', '0512345678', 'other', 'الخرج', 'android', 'ar', 'accepted', timestamp, timestamp, timestamp);
  legacy.prepare('INSERT INTO request_limits VALUES (?, ?, ?)').run('login:test', 2, Date.now() + 60000);
  legacy.prepare('INSERT INTO request_limits VALUES (?, ?, ?)').run('courier:test', 2, Date.now() + 60000);
  legacy.prepare('INSERT INTO admin_sessions VALUES (?, ?, ?, ?)').run('expired-after-migration', 'csrf', 'binding', Date.now() + 60000);
  legacy.close();
  let store = openStore(directory, filename);
  try {
    let result = store.list(filters);
    assert.equal(result.total, 1);
    assert.equal(typeof result.items[0].id, 'number');
    assert.equal(result.items[0].city, 'الخرج');
    assert.equal(result.items[0].status, 'accepted');
    assert.equal(result.items[0].consent_at, timestamp);
    assert.equal(result.items[0].created_at, '2026-10-25 18:00:00');
    assert.ok(store.limit('login:test', 2, 60000) > 0);
    assert.ok(store.limit('courier:test', 2, 60000) > 0);
    const inspected = new DatabaseSync(filename);
    try {
      assert.equal(inspected.prepare('SELECT legacy_id FROM courier_lead_reviews').get().legacy_id, 'legacy-uuid');
      assert.equal(inspected.prepare('SELECT COUNT(*) AS count FROM couriers').get().count, 1);
      assert.equal(inspected.prepare('SELECT COUNT(*) AS count FROM admin_sessions').get().count, 0);
      assert.equal(inspected.prepare("SELECT tbl_name FROM sqlite_master WHERE type = 'index' AND name = 'admin_sessions_expiry'").get().tbl_name, 'admin_sessions');
    } finally { inspected.close(); }
    store.close(); store = openStore(directory, filename);
    result = store.list(filters);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].status, 'accepted');
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('migration replaces an earlier session table with extra mandatory columns', () => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-session-schema-'));
  const filename = join(directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(filename);
  legacy.exec(`CREATE TABLE admin_sessions (
    token_hash TEXT PRIMARY KEY, credential_hash TEXT NOT NULL,
    csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
  ); PRAGMA user_version = 1;`);
  legacy.close();
  const store = openStore(directory, filename);
  try {
    const token = randomBytes(32).toString('hex');
    const csrf = store.createSession(token, 'opaque-binding', Date.now() + 60000);
    assert.equal(store.session(token, 'opaque-binding').csrf_token, csrf);
    assert.equal(store.session(token, 'wrong-binding'), undefined);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('admin APIs require authentication, correct origin, CSRF, and a live session', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-api-'));
  const store = openStore(directory);
  const previous = { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_JWT_SECRET };
  const password = randomBytes(24).toString('hex');
  process.env.ADMIN_USERNAME = 'test-admin'; process.env.ADMIN_PASSWORD = password;
  process.env.ADMIN_JWT_SECRET = randomBytes(32).toString('hex');
  const origins = new Set();
  let api = createApi({ store, origins, secureCookies: false });
  const server = createServer(async (request, response) => {
    if (!(await api(request, response, new URL(request.url, 'http://localhost')))) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  origins.add(origin);
  const send = (path, { method = 'GET', body, cookie, csrf, originHeader = origin } = {}) => fetch(`${origin}${path}`, {
    method,
    headers: { Origin: originHeader, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    await t.test('public listing is rejected and invalid registrations are not saved', async () => {
      assert.equal((await send('/api/admin/couriers')).status, 401);
      assert.equal((await send('/api/couriers', { method: 'POST', body: { ...applicant, consent: false } })).status, 400);
      assert.equal(store.list(filters).total, 0);
      assert.equal((await send('/api/couriers', { method: 'POST', body: applicant, originHeader: 'https://untrusted.example' })).status, 403);
      assert.equal((await send('/api/couriers', { method: 'POST', body: { ...applicant, name: 'a'.repeat(9000) } })).status, 413);
    });
    await t.test('successful registration persists and duplicate phones do not overwrite', async () => {
      const first = await send('/api/courier-leads', { method: 'POST', body: { ...applicant, ref: 'launch_2026' } });
      const duplicate = await send('/api/couriers', { method: 'POST', body: { ...applicant, name: 'Different Person' } });
      assert.equal(first.status, 201); assert.equal(duplicate.status, 201);
      assert.deepEqual(await first.json(), await duplicate.json());
      assert.equal(store.list(filters).items[0].name, applicant.name);
      assert.equal(store.list(filters).items[0].ref, 'launch_2026');
    });
    const bad = await send('/api/admin/session', { method: 'POST', body: { username: 'test-admin', password: 'incorrect' } });
    assert.equal(bad.status, 401);
    const login = await send('/api/admin/session', { method: 'POST', body: { username: 'test-admin', password } });
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /SameSite=Strict/);
    const cookie = login.headers.getSetCookie().map((header) => header.split(';')[0]).filter((value) => !value.endsWith('=')).join('; ');
    const { csrfToken } = await login.json();
    const result = await (await send('/api/admin/couriers', { cookie })).json();
    assert.equal(result.items.length, 1);
    const id = result.items[0].id;
    await t.test('admin status writes require both CSRF and origin', async () => {
      const body = { status: 'contacted' };
      assert.equal((await send(`/api/admin/couriers/${id}`, { method: 'PATCH', body, cookie })).status, 403);
      assert.equal((await send(`/api/admin/couriers/${id}`, { method: 'PATCH', body, cookie, csrf: csrfToken, originHeader: 'https://untrusted.example' })).status, 403);
      assert.equal((await send(`/api/admin/couriers/${id}`, { method: 'PATCH', body, cookie, csrf: csrfToken })).status, 200);
      assert.equal(store.list(filters).items[0].status, 'contacted');
    });
    await t.test('logout and expiration prevent further reads', async () => {
      assert.equal((await send('/api/admin/session', { method: 'DELETE', cookie, csrf: csrfToken })).status, 200);
      assert.equal((await send('/api/admin/couriers', { cookie })).status, 401);
      const fresh = await send('/api/admin/session', { method: 'POST', body: { username: 'test-admin', password } });
      assert.equal(fresh.status, 200);
      const freshCookie = fresh.headers.getSetCookie().map((header) => header.split(';')[0]).filter((value) => !value.endsWith('=')).join('; ');
      store.clean(Date.now() + 3 * 24 * 60 * 60 * 1000 + 1);
      assert.equal((await send('/api/admin/couriers', { cookie: freshCookie })).status, 401);
    });
    await t.test('credential changes invalidate previously issued sessions', async () => {
      const currentLogin = await send('/api/admin/session', { method: 'POST', body: { username: 'test-admin', password } });
      assert.equal(currentLogin.status, 200);
      const currentCookie = currentLogin.headers.getSetCookie().map((header) => header.split(';')[0]).filter((value) => !value.endsWith('=')).join('; ');
      process.env.ADMIN_PASSWORD = randomBytes(24).toString('hex');
      api = createApi({ store, origins, secureCookies: false });
      assert.equal((await send('/api/admin/couriers', { cookie: currentCookie })).status, 401);
    });
    await t.test('phone and sign-in request limits reject repeated attempts', async () => {
      // The earlier future cleanup reset the request-limit windows too.
      for (let index = 0; index < 5; index += 1) assert.equal((await send('/api/couriers', { method: 'POST', body: applicant })).status, 201);
      assert.equal((await send('/api/couriers', { method: 'POST', body: applicant })).status, 429);
      let response;
      for (let index = 0; index < 9; index += 1) response = await send('/api/admin/session', { method: 'POST', body: { username: 'test-admin', password: 'incorrect' } });
      assert.equal(response.status, 429);
      assert.ok(Number(response.headers.get('retry-after')) > 0);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close(); rmSync(directory, { recursive: true, force: true });
    if (previous.username === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = previous.username;
    if (previous.password === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous.password;
    if (previous.secret === undefined) delete process.env.ADMIN_JWT_SECRET; else process.env.ADMIN_JWT_SECRET = previous.secret;
  }
});
