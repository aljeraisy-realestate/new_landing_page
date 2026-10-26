import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.js';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createApi } from '../server/api.js';

function list(store, filters = {}) { return store.list({ search: '', status: '', page: 1, ...filters }); }

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'giftly-list-'));
  const store = openStore(root);
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  for (let id = 1; id <= 47; id++) store.addCourier({ name: id % 2 ? 'Zed Courier' : 'Alpha Courier', phone: `05${String(id).padStart(8, '0')}`, city: ['الخرج', 'riyadh', 'jeddah', 'الرياض'][id % 4], phoneType: id % 3 ? 'android' : 'iphone', locale: 'ar' });
  return store;
}

test('courier pagination starts at 20, has stable ordering, and clamps an invalidated last page', (t) => {
  const store = fixture(t);
  const first = list(store, {});
  assert.equal(first.pageSize, 20); assert.equal(first.totalPages, 3);
  assert.equal(first.items.length, 20); assert.equal(first.hasPrevious, false); assert.equal(first.hasNext, true);
  assert.equal(first.items[0].id, 47);
  const second = list(store, { page: 2 });
  assert.equal(second.items.length, 20); assert.equal(second.hasPrevious, true); assert.equal(second.hasNext, true);
  assert.equal(new Set([...first.items, ...second.items].map(row => row.id)).size, 40);
  const last = list(store, { page: 999 });
  assert.equal(last.page, 3); assert.equal(last.items.length, 7); assert.equal(last.hasNext, false);
  assert.equal(list(store, { page: 999, pageSize: 50 }).page, 1);
  assert.equal(list(store, { pageSize: 100 }).items.length, 47);
});

test('city aliases, custom cities, international mobile numbers, device and status filters combine', (t) => {
  const store = fixture(t);
  store.setStatus(3, 'accepted');
  const result = list(store, { city: 'riyadh', phone: '+966 50 000 0003', phoneType: 'iphone', status: 'accepted' });
  assert.equal(result.total, 1); assert.equal(result.items[0].id, 3);
  assert.equal(list(store, { city: 'riyadh' }).total, 24);
  assert.equal(list(store, { city: 'الخرج' }).total, 11);
  assert.equal(list(store, { phone: '٠٥٠٠٠٠٠٠٠٣' }).items[0].id, 3);
  assert.deepEqual(new Set(result.cityOptions), new Set(['riyadh', 'jeddah', 'الخرج']));
  assert.equal(result.counts.total, 47);
  const empty = list(store, { city: 'missing', page: 3 });
  assert.equal(empty.total, 0); assert.equal(empty.page, 1); assert.equal(empty.totalPages, 1);
  assert.equal(empty.hasPrevious, false); assert.equal(empty.hasNext, false);
});

test('ascending and descending sorts and exports keep the same applied filters', (t) => {
  const store = fixture(t);
  const ascending = list(store, { sortBy: 'id', sortDirection: 'asc' });
  const descending = list(store, { sortBy: 'id', sortDirection: 'desc' });
  assert.equal(ascending.items[0].id, 1); assert.equal(descending.items[0].id, 47);
  const named = list(store, { sortBy: 'name', sortDirection: 'asc' });
  assert.equal(named.items[0].name, 'Alpha Courier'); assert.equal(named.items[0].id, 2);
  const filters = { city: 'riyadh', phoneType: 'android', sortBy: 'id', sortDirection: 'asc', pageSize: 100 };
  assert.deepEqual(store.exportCouriers(filters).map(row => row.id), list(store, filters).items.map(row => row.id));
  for (const invalid of [{ pageSize: 5000 }, { page: 0 }, { sortBy: 'id; DROP TABLE courier_leads' }, { sortDirection: 'descending' }, { phoneType: 'other' }, { phone: 'not-a-number' }]) assert.throws(() => list(store, invalid), /invalid_filters/);
  assert.equal(list(store, {}).total, 47);
});

test('authenticated list and export APIs validate filters and return usable pagination metadata', async (t) => {
  const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.ADMIN_USERNAME = 'list-admin'; process.env.ADMIN_PASSWORD = 'test-password'; process.env.ADMIN_JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => { for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  const store = fixture(t);
  const origins = new Set();
  const api = createApi({ store, origins, secureCookies: false });
  const server = createServer((request, response) => api(request, response, new URL(request.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  origins.add(origin);
  const login = await fetch(origin + '/api/admin/session', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'list-admin', password: 'test-password' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const get = query => fetch(origin + '/api/admin/couriers' + query, { headers: { Cookie: cookie } });
  assert.equal((await fetch(origin + '/api/admin/couriers')).status, 401);
  const first = await (await get('')).json();
  assert.equal(first.pageSize, 20); assert.equal(first.items.length, 20); assert.equal(first.totalPages, 3);
  const second = await (await get('?sortBy=id&sortDirection=asc&page=2')).json();
  assert.equal(second.items[0].id, 21); assert.equal(second.hasNext, true); assert.equal(second.hasPrevious, true);
  const last = await (await get('?page=999')).json();
  assert.equal(last.page, 3); assert.equal(last.items.length, 7); assert.equal(last.hasNext, false);
  const phoneQuery = new URLSearchParams({ city: 'riyadh', phone: '+966 50 000 0003', phoneType: 'iphone', sortBy: 'id', sortDirection: 'asc' });
  const filtered = await (await get('?' + phoneQuery)).json();
  assert.equal(filtered.total, 1); assert.equal(filtered.items[0].id, 3);
  const exported = await (await get('/export?' + phoneQuery)).json();
  assert.equal(exported.count, 1); assert.ok(exported.csv.includes("'0500000003"));
  for (const query of ['?pageSize=5000', '?page=-1', '?sortBy=id%3BDROP', '?sortDirection=up', '?phoneType=invalid', '?phone=abc']) assert.equal((await get(query)).status, 400);
});
