import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { openStore } from '../server/store.js';
import { createAdminAuth } from '../server/admin-auth.js';

test('JWT cookies use the configured private API scope through rotation and logout', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-private-auth-'));
  const store = openStore(directory);
  const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.ADMIN_USERNAME = 'test-user'; process.env.ADMIN_PASSWORD = 'abcd'; process.env.ADMIN_JWT_SECRET = randomBytes(32).toString('hex');
  try {
    const auth = createAdminAuth({ store, secureCookies: false, cookiePath: '/test-console/api' });
    const signedIn = await auth.login({ headers: {} });
    assert.ok(signedIn.cookies.every((cookie) => cookie.includes('Path=/test-console/api;')));
    const request = { headers: { cookie: signedIn.cookies.map((cookie) => cookie.split(';')[0]).join('; ') } };
    assert.ok(await auth.access(request));
    const refreshed = await auth.rotate(auth.refresh(request));
    assert.equal(refreshed.result, 'rotated');
    assert.ok(refreshed.cookies.every((cookie) => cookie.includes('Path=/test-console/api;')));
    auth.revoke(await auth.access(request));
    assert.equal(await auth.access(request), null);
    assert.ok(auth.clearCookies().every((cookie) => cookie.includes('Path=/test-console/api;') && cookie.includes('Max-Age=0')));
  } finally {
    store.close(); rmSync(directory, { recursive: true, force: true });
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
