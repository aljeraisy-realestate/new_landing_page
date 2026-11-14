import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.js';
import { openStore } from '../server/store.js';

const applicant = { name: 'Test Applicant', phone: '0512345678', city: 'riyadh', phoneType: 'iphone', locale: 'ar', consent: true };

test('courier submissions accept both Giftly domains, update duplicates, and log safely', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'giftly-submission-'));
  const store = openStore(directory);
  const logs = [];
  const origins = new Set(['https://giftly.sa']);
  const api = createApi({ store, origins, secureCookies: true, logger: (entry) => logs.push(entry) });
  async function send(body, origin = 'https://giftly.sa') {
    const request = Readable.from([Buffer.from(JSON.stringify(body))]);
    request.method = 'POST';
    request.headers = { origin, 'content-type': 'application/json' };
    request.socket = { remoteAddress: '127.0.0.1' };
    const response = { writeHead(status) { this.status = status; }, end(value) { this.body = JSON.parse(value); } };
    await api(request, response, new URL('https://giftly.sa/api/courier-leads'));
    return response;
  }
  try {
    assert.equal((await send(applicant, 'https://www.giftly.sa')).status, 201);
    assert.equal((await send(applicant, 'https://evil.giftly.sa')).status, 403);
    assert.equal((await send(applicant, 'https://giftly.sa.evil.example')).status, 403);
    origins.clear(); origins.add('https://www.giftly.sa');
    assert.equal((await send(applicant, 'https://www.www.giftly.sa')).status, 403);
    const original = store.list({}).items[0];
    store.setStatus(original.id, 'accepted', 'test-admin');
    const duplicate = await send({ ...applicant, phone: '+966512345678', name: 'Changed Name', city: 'jeddah' });
    assert.equal(duplicate.status, 201);
    assert.deepEqual(duplicate.body, { ok: true });
    assert.equal(store.list({}).total, 1);
    const updated = store.list({}).items[0];
    assert.equal(updated.id, original.id);
    assert.equal(updated.created_at, original.created_at);
    assert.equal(updated.name, 'Changed Name');
    assert.equal(updated.city, 'jeddah');
    assert.equal(updated.status, 'accepted');
    // Distinct applicants behind one reverse proxy must not share a 20-request IP cap.
    for (let index = 0; index < 25; index++) {
      assert.equal((await send({ ...applicant, phone: `059${String(index).padStart(7, '0')}` })).status, 201);
    }
    assert.ok(logs.some((entry) => entry.status === 201));
    assert.ok(logs.some((entry) => entry.code === 'forbidden_origin'));
    assert.ok(logs.some((entry) => entry.code === 'updated'));
    // Give later inserts time to sort below a resubmission of the older ID.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await send(applicant);
    assert.equal(store.list({ sortBy: 'updated_at' }).items[0].id, original.id);
    const save = store.addCourier;
    store.addCourier = () => { throw Object.assign(new Error('Private phone 0512345678'), { code: 'SQLITE_BUSY' }); };
    const failure = await send({ ...applicant, phone: '0588888888' });
    assert.equal(failure.status, 500);
    assert.deepEqual(failure.body, { error: 'server_error' });
    assert.ok(logs.some((entry) => entry.status === 500 && entry.databaseCode === 'SQLITE_BUSY'));
    store.addCourier = save;
    assert.equal((await send({ ...applicant, phone: '0588888888' })).status, 201);
    assert.doesNotMatch(JSON.stringify(logs), /Test Applicant|0512345678|127\.0\.0\.1/);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
