import { createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
import { hash } from './store.js';

const derive = promisify(scrypt);
const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 3 * 24 * 60 * 60;
const issuer = 'giftly:admin';
const audience = 'giftly:admin-api';
const accessCookie = 'giftly_admin_access';
const refreshCookie = 'giftly_admin_refresh';
const random = () => randomBytes(32).toString('hex');

function readCookie(request, name) {
  const values = (request.headers.cookie || '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}

export function createAdminAuth({ store, secureCookies, now = Date.now, cookiePath = '/api/admin' }) {
  const username = process.env.ADMIN_USERNAME || '';
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_JWT_SECRET || '';
  const configured = username.length >= 3 && username.length <= 100 && password.length >= 4 && password.length <= 512 && /^[a-f0-9]{64}$/i.test(secret);
  const key = configured ? Buffer.from(secret, 'hex') : null;
  // The keyed binding invalidates sessions when credentials change without storing
  // a password verifier usable for offline guessing from the database alone.
  const binding = configured ? createHmac('sha256', key).update(JSON.stringify(['giftly:credentials:v1', username, password])).digest('hex') : '';
  const salt = randomBytes(16);
  const expectedPassword = configured ? scryptSync(password, salt, 64) : null;
  const cookie = (name, value, age) => `${name}=${value}; Path=${cookiePath}; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(age))}${secureCookies ? '; Secure' : ''}`;
  const clearCookies = () => [cookie(accessCookie, '', 0), cookie(refreshCookie, '', 0), cookie('giftly_admin_session', '', 0)];
  const withSession = (sid) => {
    const session = configured && store.session(sid, binding, now());
    return session ? { ...session, sid } : null;
  };
  function refresh(request) {
    if (!configured) return null;
    const token = readCookie(request, refreshCookie);
    if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) return null;
    const sid = token.split('.')[0];
    const record = store.refreshRecord(token, sid, binding, now());
    const session = record && withSession(sid);
    return session ? { ...session, token, used_at: record.used_at } : null;
  }
  async function access(request) {
    if (!configured) return null;
    const token = readCookie(request, accessCookie);
    if (!token || token.length > 2048) return null;
    let payload;
    try {
      ({ payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'], issuer, audience, subject: username, typ: 'JWT',
        requiredClaims: ['exp', 'iat', 'jti', 'sid', 'token_use'], maxTokenAge: ACCESS_SECONDS,
        currentDate: new Date(now()),
      }));
    } catch { return null; }
    if (payload.token_use !== 'access' || typeof payload.sid !== 'string' || typeof payload.jti !== 'string'
      || !/^[a-f0-9]{64}$/.test(payload.sid) || !/^[a-f0-9]{64}$/.test(payload.jti)
      || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= payload.iat || payload.exp - payload.iat > ACCESS_SECONDS) return null;
    const session = withSession(payload.sid);
    return session ? { ...session, accessExpiresAt: payload.exp * 1000 } : null;
  }
  const describe = (session) => ({ configured, authenticated: true, csrfToken: session.csrf_token, accessExpiresAt: session.accessExpiresAt, refreshExpiresAt: session.expires_at });
  async function credentials(value) {
    if (!configured || typeof value.username !== 'string' || value.username.length > 100 || typeof value.password !== 'string' || value.password.length > 512) return false;
    const actual = await derive(value.password, salt, 64);
    const userMatches = timingSafeEqual(Buffer.from(hash(value.username)), Buffer.from(hash(username)));
    return timingSafeEqual(actual, expectedPassword) && userMatches;
  }
  async function issue(sid, expiresAt, token) {
    const issued = Math.floor(now() / 1000);
    const expiry = Math.min(issued + ACCESS_SECONDS, Math.floor(expiresAt / 1000));
    const jwt = await new SignJWT({ sid, token_use: 'access' }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(issuer).setAudience(audience).setSubject(username).setJti(random()).setIssuedAt(issued).setExpirationTime(expiry).sign(key);
    return {
      cookies: [cookie(accessCookie, jwt, expiry - issued), cookie(refreshCookie, token, (expiresAt - now()) / 1000), cookie('giftly_admin_session', '', 0)],
      value: describe({ ...withSession(sid), accessExpiresAt: expiry * 1000 }),
    };
  }
  return {
    configured, access, refresh, credentials, describe, clearCookies,
    async login(request) {
      const previous = refresh(request) || await access(request);
      if (previous) store.removeSession(previous.sid);
      const sid = random(); const token = `${sid}.${random()}`;
      const expiresAt = now() + REFRESH_SECONDS * 1000;
      store.createSession(sid, binding, expiresAt, token);
      return issue(sid, expiresAt, token);
    },
    async rotate(session) {
      const token = `${session.sid}.${random()}`;
      const result = store.rotateRefresh(session.token, token, session.sid, binding, now());
      return result === 'rotated' ? { result, ...await issue(session.sid, session.expires_at, token) } : { result };
    },
    revoke(session) { store.removeSession(session.sid); },
  };
}
