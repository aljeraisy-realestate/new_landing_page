import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.js';
import { createApi } from '../server/api.js';

test('admin CSV transfer enforces authorization, atomic validation, duplicates and filtered exports', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-transfer-'));
  const store = openStore(directory);
  const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.ADMIN_USERNAME = 'transfer-admin'; process.env.ADMIN_PASSWORD = 'test-password'; process.env.ADMIN_JWT_SECRET = randomBytes(32).toString('hex');
  const origins = new Set();
  const api = createApi({ store, origins, secureCookies: false });
  const server = createServer((request, response) => api(request, response, new URL(request.url, 'http://localhost')));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  origins.add(origin);
  let cookie = ''; let csrf = '';
  const send = (path, { method = 'GET', body, authenticated = true, token = csrf, source = origin } = {}) => fetch(`${origin}/api/admin/${path}`, {
    method, headers: { Origin: source, ...(authenticated && cookie ? { Cookie: cookie } : {}), ...(token ? { 'X-CSRF-Token': token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const csv = 'name,phone,city,phone_type,ref,locale,status,consent_at,created_at\r\nسارة أحمد,+966512345678,الرياض,iphone,launch,ar,accepted,,2026-01-02 03:04:05\r\n';
  const payload = { csv, confirmed: true };
  try {
    await t.test('anonymous transfer is denied', async () => {
      assert.equal((await send('couriers/export', { authenticated: false })).status, 401);
      assert.equal((await send('couriers/import', { method: 'POST', body: payload, authenticated: false })).status, 401);
    });
    const login = await send('session', { method: 'POST', body: { username: 'transfer-admin', password: 'test-password' } });
    assert.equal(login.status, 200);
    cookie = login.headers.getSetCookie().map((header) => header.split(';')[0]).filter((value) => !value.endsWith('=')).join('; ');
    csrf = (await login.json()).csrfToken;
    await t.test('imports require CSRF, origin, and confirmation', async () => {
      assert.equal((await send('couriers/import', { method: 'POST', body: payload, token: '' })).status, 403);
      assert.equal((await send('couriers/import', { method: 'POST', body: payload, source: 'https://untrusted.example' })).status, 403);
      assert.equal((await send('couriers/import', { method: 'POST', body: { csv } })).status, 400);
    });
    await t.test('valid rows persist with historical metadata and duplicate phones never overwrite', async () => {
      const first = await send('couriers/import', { method: 'POST', body: payload });
      assert.equal(first.status, 200);
      assert.deepEqual(await first.json(), { added: 1, skipped: 0 });
      const row = store.list({ search: '', status: '', page: 1 }).items[0];
      assert.equal(row.phone, '0512345678'); assert.equal(row.city, 'riyadh');
      assert.equal(row.ref, 'launch'); assert.equal(row.status, 'accepted');
      assert.equal(row.created_at, '2026-01-02 03:04:05'); assert.equal(row.consent_at, null);
      const duplicate = await send('couriers/import', { method: 'POST', body: { ...payload, csv: csv.replace('سارة أحمد', 'Different Name') } });
      assert.deepEqual(await duplicate.json(), { added: 0, skipped: 1 });
      assert.equal(store.list({ search: '', status: '', page: 1 }).items[0].name, 'سارة أحمد');
    });
    await t.test('a file with an invalid row writes nothing', async () => {
      const invalid = 'name,phone,city,phone_type\nValid Name,0512345679,jeddah,android\nInvalid Phone,123,riyadh,iphone';
      const response = await send('couriers/import', { method: 'POST', body: { csv: invalid, confirmed: true } });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).errors[0].row, 3);
      assert.equal(store.list({ search: '', status: '', page: 1 }).total, 1);
    });
    await t.test('exports include every matching page and honor filters', async () => {
      for (let index = 0; index < 30; index += 1) store.addCourier({ name: 'Other Applicant', phone: `059${String(index).padStart(7, '0')}`, city: 'jeddah', phoneType: 'android', locale: 'en' });
      const response = await send('couriers/export'); assert.equal(response.status, 200);
      const result = await response.json(); assert.equal(result.count, 31); assert.ok(result.csv.startsWith('\ufeff'));
      assert.ok(result.csv.includes("'0512345678"));
      const filtered = await (await send('couriers/export?status=accepted&search=الرياض')).json();
      assert.equal(filtered.count, 1); assert.ok(filtered.csv.includes('سارة أحمد'));
      assert.equal((await send('couriers/export?status=invalid')).status, 400);
    });
    await t.test('oversized import bodies are rejected', async () => {
      assert.equal((await send('couriers/import', { method: 'POST', body: { csv: 'a'.repeat(2100000), confirmed: true } })).status, 413);
    });
    await t.test('a database failure rolls back every row in the batch', () => {
      const row = { name: 'Rollback Person', phone: '0512345680', city: 'riyadh', phoneType: 'iphone', ref: null, locale: 'ar', status: 'new', createdAt: null, updatedAt: null, consentAt: null };
      assert.throws(() => store.importCouriers([row, { ...row, phone: '0512345681', status: 'invalid' }]));
      assert.equal(store.list({ search: '', status: '', page: 1 }).total, 31);
      assert.equal(store.list({ search: '0512345680', status: '', page: 1 }).total, 0);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve)); store.close(); rmSync(directory, { recursive: true, force: true });
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
