import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAdminAuth } from '../server/admin-auth.js';

test('admin configuration accepts four-character passwords and rejects shorter ones', async () => {
  const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.ADMIN_USERNAME = 'test-admin';
  process.env.ADMIN_JWT_SECRET = randomBytes(32).toString('hex');
  try {
    process.env.ADMIN_PASSWORD = 'abcd';
    const auth = createAdminAuth({ store: {}, secureCookies: false });
    assert.equal(auth.configured, true);
    assert.equal(await auth.credentials({ username: 'test-admin', password: 'abcd' }), true);
    assert.equal(await auth.credentials({ username: 'test-admin', password: 'abc' }), false);
    for (const password of ['', 'a', 'ab', 'abc']) {
      process.env.ADMIN_PASSWORD = password;
      assert.equal(createAdminAuth({ store: {}, secureCookies: false }).configured, false);
    }
  } finally {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
