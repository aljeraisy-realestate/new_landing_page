import test from 'node:test';
import assert from 'node:assert/strict';
import { adminBasePath, adminDestination } from '../shared/page-routes.js';
import { createControlRoute, managementAssets, managementHtml, privateSourcePath } from '../server/control-route.js';

test('runtime management prefix is required and cannot collide with public paths', () => {
  for (const value of ['', '/admin', '/api', '/ar', '/en', '/src', '/assets', '/nested/path', '//other', '/bad?query', '/bad#hash', '/bad%2fpath']) assert.throws(() => createControlRoute(value));
  assert.equal(createControlRoute('/test-console').base, '/test-console');
});

test('only the configured prefix selects pages and external API routes', () => {
  const route = createControlRoute('/test-console');
  for (const path of ['/test-console', '/test-console/', '/test-console/login', '/test-console/couriers']) assert.equal(route.isPage(path), true);
  for (const path of ['/admin', '/ar/admin', '/test-console-extra', '/test-console/missing', '/ar']) assert.equal(route.isPage(path), false);
  assert.equal(route.apiPath('/test-console/api/session'), '/api/admin/session');
  assert.equal(route.apiPath('/api/admin/session'), null);
  assert.equal(route.apiPath('/test-console-extra/api/session'), null);
});

test('browser destinations derive from the visited URL rather than a build variable', () => {
  assert.equal(adminBasePath('/test-console/login'), '/test-console');
  assert.equal(adminDestination(false, '/test-console'), '/test-console/login');
  assert.equal(adminDestination(true, '/test-console'), '/test-console/couriers');
});

test('direct source aliases and management-only assets remain private', () => {
  for (const path of ['/admin/index.html', '/src/AdminApp.jsx', '/src/admin-main.jsx', '/src/admin-client.js', '/src/admin.css', '/@fs/C:/project/src/AdminPage.jsx']) assert.equal(privateSourcePath(path), true, path);
  assert.equal(privateSourcePath('/src/App.jsx'), false);
  const files = managementAssets({
    'index.html': { file: 'assets/public.js', imports: ['shared'] },
    'admin/index.html': { file: 'assets/private.js', css: ['assets/private.css'], imports: ['shared'] },
    shared: { file: 'assets/shared.js', css: ['assets/shared.css'] },
  });
  assert.deepEqual([...files].sort(), ['assets/private.css', 'assets/private.js']);
});

test('management document and development imports stay under the runtime prefix', () => {
  const html = managementHtml('<script src="/src/admin-main.jsx"></script><link href="/assets/private.css"><script src="/assets/private.js"></script>', '/test-console');
  assert.ok(html.includes('src="/test-console/src/admin-main.jsx"'));
  assert.ok(html.includes('href="/test-console/assets/private.css"'));
  assert.ok(html.includes('src="/test-console/assets/private.js"'));
});
