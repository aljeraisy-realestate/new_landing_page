import test from 'node:test';
import assert from 'node:assert/strict';
import { blockedStaticPath } from '../server/static-paths.js';

test('development can serve optimized React modules required to render the app', () => {
  for (const path of [
    '/node_modules/.vite/deps/react.js',
    '/node_modules/.vite/deps/react-dom_client.js',
    '/node_modules/.vite/deps/react_jsx-dev-runtime.js',
    '/node_modules/.vite/deps/chunk-ABC123.js',
    '/node_modules/.vite/deps/chunk-ABC123.js.map',
  ]) assert.equal(blockedStaticPath(path, { development: true }), false, path);
});

test('private files, traversal, and other dot directories stay blocked', () => {
  for (const path of [
    '/.env', '/.env.local', '/.git/config', '/src/.env', '/data/couriers.sqlite',
    '/server/index.js', '/node_modules/.vite/.env', '/node_modules/.vite/deps/.env.js',
    '/node_modules/.vite/deps/../.env', '/node_modules/.vite/deps/nested/private.js',
    '/node_modules/.vite-temp/config.js', '/node_modules/.vite/deps/metadata.json',
    '/node_modules\\.vite\\deps\\react.js', '/src/../.env', '/src/\0invalid.js',
  ]) assert.equal(blockedStaticPath(path, { development: true }), true, path);
});

test('the development exception is unavailable in production', () => {
  assert.equal(blockedStaticPath('/node_modules/.vite/deps/react.js'), true);
  assert.equal(blockedStaticPath('/assets/main.js'), false);
  assert.equal(blockedStaticPath('/ar'), false);
});
