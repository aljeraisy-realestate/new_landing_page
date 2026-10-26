import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { adminJson, getAdminSession } from '../src/admin-client.js';

const originalWindow = globalThis.window;
beforeEach(() => { globalThis.window = { location: { pathname: '/test-console/login' } }; });
afterEach(() => { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });

// Fetch is the external boundary. Exercise the real renewal/retry coordinator.
test('expired access is renewed once for simultaneous session checks', async () => {
  const original = globalThis.fetch;
  const calls = [];
  const renewed = { configured: true, authenticated: true, csrfToken: 'fresh-csrf', accessExpiresAt: Date.now() + 900000 };
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    if (path === '/test-console/api/session') return Response.json({ configured: true, authenticated: false, refreshable: true, csrfToken: 'family-csrf' });
    assert.equal(path, '/test-console/api/refresh');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-CSRF-Token'], 'family-csrf');
    assert.equal(options.credentials, 'same-origin');
    return Response.json(renewed);
  };
  try {
    const results = await Promise.all([getAdminSession(), getAdminSession(), getAdminSession()]);
    assert.ok(results.every((value) => value.authenticated && value.csrfToken === 'fresh-csrf'));
    assert.equal(calls.filter(({ path }) => path === '/test-console/api/refresh').length, 1);
  } finally { globalThis.fetch = original; }
});

test('an authenticated write is retried once after expiry with the renewed CSRF token', async () => {
  const original = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (path, options) => {
    if (path === '/test-console/api/session') return Response.json({ configured: true, authenticated: false, refreshable: true, csrfToken: 'family-csrf' });
    if (path === '/test-console/api/refresh') return Response.json({ configured: true, authenticated: true, csrfToken: 'new-csrf', accessExpiresAt: Date.now() + 900000 });
    assert.equal(path, '/test-console/api/couriers/1');
    assert.equal(options.method, 'PATCH');
    assert.deepEqual(JSON.parse(options.body), { status: 'contacted' });
    writes += 1;
    if (writes === 1) return Response.json({ error: 'authentication_required' }, { status: 401 });
    assert.equal(options.headers['X-CSRF-Token'], 'new-csrf');
    // A second rejection must propagate instead of creating a retry loop.
    return Response.json({ error: 'authentication_required' }, { status: 401 });
  };
  try {
    await assert.rejects(adminJson('/couriers/1', { method: 'PATCH', body: { status: 'contacted' }, csrfToken: 'old-csrf' }), { status: 401 });
    assert.equal(writes, 2);
  } finally { globalThis.fetch = original; }
});

test('server failures do not replay a write that may already have run', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ error: 'server_error' }, { status: 500 }); };
  try {
    await assert.rejects(adminJson('/couriers/1', { method: 'PATCH', body: { status: 'accepted' } }), { status: 500 });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('a concurrent-tab refresh waits for the rotated shared cookies', async () => {
  const original = globalThis.fetch;
  let inspections = 0;
  let rotations = 0;
  globalThis.fetch = async (path) => {
    if (path === '/test-console/api/refresh') { rotations += 1; return Response.json({ error: 'refresh_raced' }, { status: 409 }); }
    assert.equal(path, '/test-console/api/session');
    inspections += 1;
    return Response.json(inspections < 3
      ? { configured: true, authenticated: false, refreshable: true, csrfToken: 'family-csrf' }
      : { configured: true, authenticated: true, csrfToken: 'family-csrf', accessExpiresAt: Date.now() + 900000 });
  };
  try {
    const session = await getAdminSession();
    assert.equal(session.authenticated, true);
    assert.equal(rotations, 1);
    assert.equal(inspections, 3);
  } finally { globalThis.fetch = original; }
});
