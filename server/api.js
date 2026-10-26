import { timingSafeEqual } from 'node:crypto';
import { reviewStatuses, validateCourier } from '../shared/courier.js';
import { hash } from './store.js';
import { createAdminAuth } from './admin-auth.js';
import { CSV_MAX_BYTES, createCourierCsv, parseCourierCsv } from '../shared/courier-csv.js';

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}

function json(response, value, status = 200, extra = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extra });
  response.end(JSON.stringify(value));
}

function readJson(request, maximum = 8192) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'json_required');
  return new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    let oversized = Number(request.headers['content-length'] || 0) > maximum;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maximum) {
        chunks = [];
        oversized = true;
      } else if (!oversized) chunks.push(chunk);
    });
    request.once('error', () => reject(new HttpError(400, 'invalid_payload')));
    request.once('end', () => {
      if (oversized) { reject(new HttpError(413, 'payload_too_large')); return; }
      try {
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch { reject(new HttpError(400, 'invalid_payload')); }
    });
  });
}

export function createApi({ store, origins, secureCookies, now = Date.now, cookiePath }) {
  const auth = createAdminAuth({ store, secureCookies, now, cookiePath });
  function originRequired(request) {
    if (!origins.has(request.headers.origin) || request.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'forbidden_origin');
  }
  function csrfRequired(request, session) {
    originRequired(request);
    const token = request.headers['x-csrf-token'];
    if (typeof token !== 'string' || token.length > 100 || !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(session.csrf_token)))) throw new HttpError(403, 'invalid_csrf');
  }
  function limited(key, maximum, duration) {
    const retry = store.limit(key, maximum, duration);
    if (retry) { const error = new HttpError(429, 'too_many_attempts'); error.retry = retry; throw error; }
  }

  return async function api(request, response, url) {
    if (!url.pathname.startsWith('/api/')) return false;
    try {
      store.clean(now());
      const address = hash(request.socket.remoteAddress || 'unknown');
      const method = request.method;
      if (['/api/courier-leads', '/api/couriers'].includes(url.pathname) && method === 'POST') {
        originRequired(request);
        limited('courier:global', 100, 15 * 60 * 1000);
        limited(`courier:ip:${address}`, 20, 15 * 60 * 1000);
        const courier = validateCourier(await readJson(request));
        if (!courier) throw new HttpError(400, 'invalid_fields');
        limited(`courier:phone:${hash(courier.phone)}`, 5, 15 * 60 * 1000);
        store.addCourier(courier);
        json(response, { ok: true }, 201);
        return true;
      }
      if (url.pathname === '/api/admin/session' && method === 'POST') {
        originRequired(request);
        if (!auth.configured) throw new HttpError(503, 'admin_not_configured');
        limited('login:global', 60, 15 * 60 * 1000);
        limited(`login:ip:${address}`, 8, 15 * 60 * 1000);
        if (!await auth.credentials(await readJson(request))) throw new HttpError(401, 'invalid_credentials');
        const result = await auth.login(request);
        json(response, result.value, 200, { 'Set-Cookie': result.cookies });
        return true;
      }
      if (url.pathname === '/api/admin/session' && method === 'GET') {
        const session = await auth.access(request);
        const refresh = !session && auth.refresh(request);
        json(response, session ? auth.describe(session) : {
          configured: auth.configured, authenticated: false,
          ...(refresh && (refresh.used_at == null || now() - refresh.used_at <= 5000)
            ? { refreshable: true, csrfToken: refresh.csrf_token, refreshExpiresAt: refresh.expires_at } : {}),
        });
        return true;
      }
      if (url.pathname === '/api/admin/refresh' && method === 'POST') {
        originRequired(request);
        limited(`login:refresh:${address}`, 120, 15 * 60 * 1000);
        const session = auth.refresh(request);
        if (!session) throw new HttpError(401, 'authentication_required');
        csrfRequired(request, session);
        const result = await auth.rotate(session);
        if (result.result === 'raced') throw new HttpError(409, 'refresh_raced');
        if (result.result !== 'rotated') {
          json(response, { error: 'authentication_required' }, 401, { 'Set-Cookie': auth.clearCookies() });
        } else json(response, result.value, 200, { 'Set-Cookie': result.cookies });
        return true;
      }
      if (url.pathname.startsWith('/api/admin/')) {
        const session = await auth.access(request) || (url.pathname === '/api/admin/session' && method === 'DELETE' ? auth.refresh(request) : null);
        if (!session) throw new HttpError(401, 'authentication_required');
        if (url.pathname === '/api/admin/session' && method === 'DELETE') {
          csrfRequired(request, session);
          auth.revoke(session);
          json(response, { ok: true }, 200, { 'Set-Cookie': auth.clearCookies() });
          return true;
        }
        if (url.pathname === '/api/admin/couriers/import' && method === 'POST') {
          csrfRequired(request, session);
          limited(`login:import:${address}`, 10, 15 * 60 * 1000);
          const value = await readJson(request, CSV_MAX_BYTES * 3);
          if (value.confirmed !== true || typeof value.csv !== 'string' || Object.keys(value).some((key) => !['csv', 'confirmed'].includes(key))) throw new HttpError(400, 'invalid_import');
          let parsed;
          try { parsed = parseCourierCsv(value.csv); }
          catch (error) { throw new HttpError(error.message === 'csv_too_large' ? 413 : 400, error.message); }
          if (parsed.errors.length || !parsed.records.length) {
            json(response, { error: 'invalid_import', errors: parsed.errors }, 422);
            return true;
          }
          const result = store.importCouriers(parsed.records);
          json(response, { added: result.added, skipped: result.skipped + parsed.duplicates });
          return true;
        }
        if (['/api/admin/couriers', '/api/admin/couriers/export'].includes(url.pathname) && method === 'GET') {
          const search = (url.searchParams.get('search') || '').trim();
          const status = url.searchParams.get('status') || '';
          const page = Number(url.searchParams.get('page') || '1');
          if (search.length > 100 || (status && !reviewStatuses.includes(status)) || !Number.isInteger(page) || page < 1 || page > 100000) throw new HttpError(400, 'invalid_filters');
          if (url.pathname.endsWith('/export')) {
            limited(`login:export:${address}`, 20, 15 * 60 * 1000);
            const rows = store.exportCouriers({ search, status });
            if (rows.length > 10000) throw new HttpError(422, 'export_too_many_rows');
            json(response, { csv: createCourierCsv(rows), count: rows.length });
            return true;
          }
          json(response, store.list({ search, status, page }));
          return true;
        }
        const match = url.pathname.match(/^\/api\/admin\/couriers\/([1-9]\d{0,15})$/);
        if (match && method === 'PATCH') {
          csrfRequired(request, session);
          const value = await readJson(request);
          if (Object.keys(value).some((key) => key !== 'status') || !reviewStatuses.includes(value.status)) throw new HttpError(400, 'invalid_status');
          const id = Number(match[1]);
          if (!Number.isSafeInteger(id)) throw new HttpError(400, 'invalid_id');
          if (!store.setStatus(id, value.status)) throw new HttpError(404, 'not_found');
          json(response, { ok: true });
          return true;
        }
      }
      throw new HttpError(404, 'not_found');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      json(response, { error: error instanceof HttpError ? error.message : 'server_error' }, status, { ...(error.retry ? { 'Retry-After': String(error.retry) } : {}), ...(status === 413 ? { Connection: 'close' } : {}) });
    }
    return true;
  };
}
