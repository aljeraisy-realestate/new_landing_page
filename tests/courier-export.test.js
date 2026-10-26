import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { openStore } from '../server/store.js';
import { createApi } from '../server/api.js';

function fixture(t, count = 10025) {
  const root = mkdtempSync(join(tmpdir(), 'giftly-export-'));
  const store = openStore(root);
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const db = new DatabaseSync(store.file);
  try {
    db.exec('BEGIN');
    const insert = db.prepare('INSERT INTO courier_leads (name,phone,city,phone_type) VALUES (?,?,?,?)');
    for (let id = 1; id <= count; id++) insert.run('Export Applicant', `05${String(id).padStart(8, '0')}`, id % 2 ? 'riyadh' : 'jeddah', id % 3 ? 'android' : 'iphone');
    db.exec('COMMIT');
  } finally { db.close(); }
  return store;
}

test('exports have no 10,000-record cap and filters do not paginate results', (t) => {
  const store = fixture(t);
  const all = store.exportCouriers({});
  assert.equal(all.length, 10025);
  assert.equal(all[0].id, 10025); assert.equal(all.at(-1).id, 1);
  const filtered = store.exportCouriers({ city: 'riyadh', page: 2, pageSize: 20 });
  assert.equal(filtered.length, 5013);
});

test('streamed exports hold a consistent snapshot without blocking new registrations', (t) => {
  const store = fixture(t, 5);
  const rows = store.exportCourierRows({ sortBy: 'id', sortDirection: 'asc' });
  assert.equal(rows.next().value.id, 1);
  store.addCourier({ name: 'New Applicant', phone: '0599999999', city: 'riyadh', phoneType: 'android', locale: 'ar' });
  assert.deepEqual([...rows].map(row => row.id), [2, 3, 4, 5]);
  assert.equal(store.list({}).total, 6);
  const canceled = store.exportCourierRows({});
  canceled.next(); canceled.return();
  assert.equal(store.list({}).total, 6);
});

test('all and filtered CSV downloads export every row and remain authenticated', async (t) => {
  const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.ADMIN_USERNAME = 'export-admin'; process.env.ADMIN_PASSWORD = 'test-password'; process.env.ADMIN_JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => { for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  const store = fixture(t);
  store.setStatus(1, 'accepted');
  const origins = new Set();
  const api = createApi({ store, origins, secureCookies: false });
  const server = createServer((request, response) => api(request, response, new URL(request.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  origins.add(origin);
  const url = origin + '/api/admin/couriers/export';
  assert.equal((await fetch(url + '?format=csv&scope=all')).status, 401);
  const login = await fetch(origin + '/api/admin/session', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'export-admin', password: 'test-password' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const get = query => fetch(url + query, { headers: { Cookie: cookie } });
  const all = await get('?format=csv&scope=all&city=missing&status=invalid&pageSize=5000');
  assert.equal(all.status, 200); assert.match(all.headers.get('content-type'), /text\/csv/);
  assert.match(all.headers.get('content-disposition'), /attachment.*all/);
  assert.equal((await all.text()).trimEnd().split('\r\n').length, 10026);
  const filtered = await get('?format=csv&scope=filtered&city=riyadh&status=accepted&phone=0500000001&pageSize=20&page=99');
  assert.equal(filtered.status, 200);
  assert.equal((await filtered.text()).trimEnd().split('\r\n').length, 2);
  const legacy = await get('?scope=all');
  assert.equal(legacy.status, 200); assert.equal((await legacy.json()).count, 10025);
  assert.equal((await get('?scope=unknown')).status, 400);
  assert.equal((await get('?format=html')).status, 400);
});
