// JWT and refresh credentials remain in HttpOnly cookies, never localStorage.
import { adminBasePath } from '../shared/page-routes.js';
let refreshPending;
let authQueue = Promise.resolve();

export async function requestJson(path, { method = 'GET', body, csrfToken, signal } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 20000);
  try {
    const response = await fetch(`${adminBasePath(window.location.pathname)}/api${path}`, {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json();
    if (!response.ok) { const error = new Error(value.error || 'request_failed'); error.status = response.status; throw error; }
    return value;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

function withAuthLock(action) {
  // Web Locks serialize cookie rotation across tabs; the queue also covers browsers
  // without Web Locks and serializes sign-in / sign-out with background refresh.
  const run = () => globalThis.navigator?.locks ? navigator.locks.request('giftly-admin-auth', action) : action();
  const pending = authQueue.then(run, run);
  authQueue = pending.catch(() => {});
  return pending;
}

export function getAdminSession() {
  if (refreshPending) return refreshPending;
  refreshPending = withAuthLock(async () => {
    const current = await requestJson('/session');
    if (current.authenticated && current.accessExpiresAt > Date.now() + 30000) return current;
    if (!current.authenticated && !current.refreshable) return current;
    try {
      return await requestJson('/refresh', { method: 'POST', csrfToken: current.csrfToken });
    } catch (error) {
      if (error.status !== 409) throw error;
      // Another client may already be returning the rotated shared cookies.
      const deadline = Date.now() + 5000;
      for (let attempt = 0; attempt < 10 && Date.now() < deadline; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const updated = await requestJson('/session');
        if (updated.authenticated) return updated;
        if (!updated.refreshable) return updated;
      }
      throw error;
    }
  }).finally(() => { refreshPending = undefined; });
  return refreshPending;
}

export function adminSignIn(body) {
  return withAuthLock(() => requestJson('/session', { method: 'POST', body }));
}

export function adminSignOut() {
  return withAuthLock(async () => {
    const current = await requestJson('/session');
    if (!current.authenticated && !current.refreshable) return;
    await requestJson('/session', { method: 'DELETE', csrfToken: current.csrfToken });
  });
}

export async function adminJson(path, options = {}, onSession) {
  try { return await requestJson(path, options); }
  catch (error) {
    if (error.status !== 401 || options.signal?.aborted) throw error;
    const session = await getAdminSession();
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onSession?.(session);
    if (!session.authenticated) throw error;
    // Only retry after the server rejected authentication, before it ran the action.
    return requestJson(path, { ...options, csrfToken: session.csrfToken });
  }
}
