import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { SignJWT, decodeJwt } from 'jose';
import { openStore } from '../server/store.js';
import { createApi } from '../server/api.js';

// These exercise expiry, rotation and revocation through the real HTTP/SQLite boundary.
test('JWT admin sessions enforce access expiry and rotating three-day refresh credentials', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-jwt-'));
  let store = openStore(directory);
  const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const password = randomBytes(24).toString('hex');
  const secret = randomBytes(32).toString('hex');
  process.env.ADMIN_USERNAME = 'jwt-admin'; process.env.ADMIN_PASSWORD = password; process.env.ADMIN_JWT_SECRET = secret;
  let clock = Date.now();
  const now = () => clock;
  const origins = new Set();
  let api = createApi({ store, origins, secureCookies: false, now });
  const server = createServer((request, response) => api(request, response, new URL(request.url, 'http://localhost')));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  origins.add(origin);
  const send = (path, { method = 'GET', cookie = '', csrf, body, originHeader = origin } = {}) => fetch(`${origin}/api/admin/${path}`, {
    method, headers: { Origin: originHeader, Cookie: cookie, ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookiesFor = (response) => response.headers.getSetCookie().map((header) => header.split(';')[0]).filter((cookie) => !cookie.endsWith('=')).join('; ');
  const signIn = async () => {
    const response = await send('session', { method: 'POST', body: { username: 'jwt-admin', password } });
    assert.equal(response.status, 200);
    return { cookie: cookiesFor(response), value: await response.json(), response };
  };
  const refresh = (session, overrides = {}) => send('refresh', { method: 'POST', cookie: session.cookie, csrf: session.value.csrfToken, ...overrides });
  try {
    await t.test('missing signing secret leaves the admin locked', async () => {
      delete process.env.ADMIN_JWT_SECRET;
      api = createApi({ store, origins, secureCookies: false, now });
      assert.equal((await (await send('session')).json()).configured, false);
      assert.equal((await send('session', { method: 'POST', body: { username: 'jwt-admin', password } })).status, 503);
      process.env.ADMIN_JWT_SECRET = secret;
      api = createApi({ store, origins, secureCookies: false, now });
    });
    const session = await signIn();
    const access = session.cookie.match(/giftly_admin_access=([^;]+)/)[1];
    const claims = decodeJwt(access);
    await t.test('access expires at fifteen minutes while refresh remains usable', async () => {
      assert.equal(claims.exp - claims.iat, 900);
      assert.equal(session.value.refreshExpiresAt - clock, 259200000);
      const headers = session.response.headers.getSetCookie();
      assert.ok(headers.filter((header) => /giftly_admin_(access|refresh)=/.test(header)).every((header) => /HttpOnly/.test(header) && /SameSite=Strict/.test(header)));
      assert.equal((await send('couriers', { cookie: session.cookie })).status, 200);
      clock += 900000;
      assert.equal((await send('couriers', { cookie: session.cookie })).status, 401);
      const state = await (await send('session', { cookie: session.cookie })).json();
      assert.equal(state.authenticated, false); assert.equal(state.refreshable, true);
      assert.equal((await refresh(session, { csrf: undefined })).status, 403);
      assert.equal((await refresh(session, { originHeader: 'https://untrusted.example' })).status, 403);
    });
    let renewed;
    await t.test('rotation replaces the refresh token and preserves the absolute deadline', async () => {
      const response = await refresh(session);
      assert.equal(response.status, 200);
      renewed = { cookie: cookiesFor(response), value: await response.json() };
      assert.notEqual(renewed.cookie, session.cookie);
      assert.equal(renewed.value.refreshExpiresAt, session.value.refreshExpiresAt);
      assert.equal((await send('couriers', { cookie: renewed.cookie })).status, 200);
      const db = new DatabaseSync(store.file);
      try {
        const records = db.prepare('SELECT token_hash FROM admin_refresh_tokens').all();
        assert.equal(records.length, 2);
        assert.ok(records.every((row) => /^[a-f0-9]{64}$/.test(row.token_hash)));
        assert.ok(!JSON.stringify(records).includes(session.cookie.match(/giftly_admin_refresh=([^;]+)/)[1]));
      } finally { db.close(); }
    });
    await t.test('concurrent refresh gets a conflict; later replay revokes the entire family', async () => {
      const racingState = await (await send('session', { cookie: session.cookie })).json();
      assert.equal(racingState.authenticated, false);
      assert.equal(racingState.refreshable, true);
      assert.equal((await refresh(session)).status, 409);
      assert.equal((await send('couriers', { cookie: renewed.cookie })).status, 200);
      clock += 5001;
      assert.equal((await refresh(session)).status, 401);
      assert.equal((await send('couriers', { cookie: renewed.cookie })).status, 401);
      assert.equal((await refresh(renewed)).status, 401);
    });
    await t.test('valid sessions survive database reopening but reject changed credentials and signing keys', async () => {
      const current = await signIn();
      store.close(); store = openStore(directory);
      api = createApi({ store, origins, secureCookies: false, now });
      assert.equal((await send('couriers', { cookie: current.cookie })).status, 200);
      process.env.ADMIN_PASSWORD = randomBytes(24).toString('hex');
      api = createApi({ store, origins, secureCookies: false, now });
      assert.equal((await send('couriers', { cookie: current.cookie })).status, 401);
      assert.equal((await refresh(current)).status, 401);
      process.env.ADMIN_PASSWORD = password;
      process.env.ADMIN_JWT_SECRET = randomBytes(32).toString('hex');
      api = createApi({ store, origins, secureCookies: false, now });
      assert.equal((await send('couriers', { cookie: current.cookie })).status, 401);
      assert.equal((await refresh(current)).status, 401);
      process.env.ADMIN_JWT_SECRET = secret;
      api = createApi({ store, origins, secureCookies: false, now });
    });
    await t.test('invalid signatures, algorithms, audiences, issuers and token uses are rejected', async () => {
      const current = await signIn();
      const payload = decodeJwt(current.cookie.match(/giftly_admin_access=([^;]+)/)[1]);
      for (const mutation of [{ iss: 'other' }, { aud: 'other' }, { token_use: 'refresh' }, { exp: payload.iat + 901 }, { sid: 'invalid' }]) {
        const token = await new SignJWT({ ...payload, ...mutation }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(Buffer.from(secret, 'hex'));
        assert.equal((await send('couriers', { cookie: `giftly_admin_access=${token}` })).status, 401);
      }
      const wrongKey = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(randomBytes(32));
      assert.equal((await send('couriers', { cookie: `giftly_admin_access=${wrongKey}` })).status, 401);
      // Same signing secret isolates the algorithm restriction from key mismatch.
      const unsigned = `${Buffer.from(JSON.stringify({ alg: 'HS384', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
      const wrongAlgorithm = `${unsigned}.${createHmac('sha384', Buffer.from(secret, 'hex')).update(unsigned).digest('base64url')}`;
      assert.equal((await send('couriers', { cookie: `giftly_admin_access=${wrongAlgorithm}` })).status, 401);
    });
    await t.test('logout revokes both tokens even when the access token has expired', async () => {
      const current = await signIn(); clock += 900000;
      const response = await send('session', { method: 'DELETE', cookie: current.cookie, csrf: current.value.csrfToken });
      assert.equal(response.status, 200);
      assert.ok(response.headers.getSetCookie().every((header) => /Max-Age=0/.test(header)));
      assert.equal((await refresh(current)).status, 401);
    });
    await t.test('refresh never extends sign-in beyond three days', async () => {
      const current = await signIn(); clock = current.value.refreshExpiresAt - 1000;
      const response = await refresh(current); assert.equal(response.status, 200);
      const last = { cookie: cookiesFor(response), value: await response.json() };
      clock += 1000;
      assert.equal((await refresh(last)).status, 401);
      assert.equal((await send('couriers', { cookie: last.cookie })).status, 401);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve)); store.close(); rmSync(directory, { recursive: true, force: true });
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
