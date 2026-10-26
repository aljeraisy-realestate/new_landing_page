import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { createApi } from './api.js';
import { blockedStaticPath } from './static-paths.js';
import { createControlRoute, managementAssets, managementHtml, privateSourcePath } from './control-route.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dev = process.argv.includes('--dev');
const port = 3000;
const control = createControlRoute(process.env.ADMIN_PATH?.trim());
const host = process.env.HOST || '127.0.0.1';
const originValue = process.env.APP_ORIGIN?.trim();
const origin = new URL(originValue || `http://localhost:${port}`);
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('APP_ORIGIN must be a plain HTTP(S) origin.');
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw new Error('Use HTTPS for a public APP_ORIGIN.');
const origins = new Set([origin.origin]);
if (dev) { origins.add(`http://localhost:${port}`); origins.add(`http://127.0.0.1:${port}`); }
const store = openStore(root, process.env.SQLITE_PATH);
const api = createApi({ store, origins, secureCookies: origin.protocol === 'https:', cookiePath: control.apiBase });
const dist = resolve(root, 'dist');
if (!dev && (!existsSync(resolve(dist, 'index.html')) || !existsSync(resolve(dist, 'admin/index.html')))) { store.close(); throw new Error('Build the landing and administration pages with npm run build before npm run start.'); }
let privateAssets = new Set();
if (!dev) {
  try { privateAssets = new Set([...managementAssets(JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8')))].map((file) => file.toLowerCase())); }
  catch (error) { store.close(); throw error; }
}
const vite = dev ? await (await import('vite')).createServer({ root, server: { middlewareMode: true, fs: { allow: [root], deny: [`${store.file.replaceAll('\\', '/')}*`] } }, appType: 'spa' }) : null;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const server = createServer({ maxHeaderSize: 16384, requestTimeout: 20000, headersTimeout: 15000 }, async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  if (!dev) response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(request.url, 'http://localhost');
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.includes('\\') || decoded.includes('//')) { response.writeHead(404); response.end(); return; }
    const internalApi = control.apiPath(decoded);
    const privatePage = control.isPage(decoded);
    const privateResource = control.resource(decoded);
    const privateRequest = control.contains(decoded);
    if (privateRequest || decoded.startsWith('/api/')) response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (privateRequest) response.setHeader('Referrer-Policy', 'no-referrer');
    if (blockedStaticPath(decoded, { development: dev }) || (!privateRequest && (privateSourcePath(decoded) || /^\/api\/admin(?:\/|$)/i.test(decoded)))) {
      response.writeHead(404); response.end(); return;
    }
    if (internalApi) {
      const routedUrl = new URL(url); routedUrl.pathname = internalApi;
      if (await api(request, response, routedUrl)) return;
    } else if (!privateRequest && await api(request, response, url)) return;
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    if (privateRequest && !privatePage && !privateResource) { response.writeHead(404); response.end(); return; }
    if (privatePage) {
      const template = await readFile(resolve(dev ? root : dist, 'admin/index.html'), 'utf8');
      let html = managementHtml(template, control.base);
      if (dev) html = await vite.transformIndexHtml(url.pathname, html);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' });
      response.end(request.method === 'HEAD' ? undefined : html);
      return;
    }
    if (dev) {
      if (privateResource && /^\/(?:src|shared)\//.test(privateResource)) {
        const result = await vite.transformRequest(privateResource + url.search);
        if (!result) { response.writeHead(404); response.end(); return; }
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'private, no-store' });
        response.end(request.method === 'HEAD' ? undefined : managementHtml(result.code, control.base));
        return;
      }
      if (privateResource) request.url = privateResource + url.search;
      vite.middlewares(request, response, () => { response.writeHead(404); response.end(); });
      return;
    }
    let file = resolve(dist, `.${privateResource || decoded}`);
    const child = relative(dist, file);
    if (child.startsWith('..') || isAbsolute(child)) { response.writeHead(404); response.end(); return; }
    if (!privateRequest && privateAssets.has(child.replaceAll('\\', '/').toLowerCase())) { response.writeHead(404); response.end(); return; }
    let info;
    try { info = await stat(file); } catch { /* Unmatched application routes use the SPA entry. */ }
    if (!info?.isFile()) {
      if (extname(decoded)) { response.writeHead(404); response.end(); return; }
      file = resolve(dist, 'index.html');
      info = await stat(file);
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': privateRequest ? 'private, no-store' : extname(file) === '.html' ? 'no-store' : 'public, max-age=3600' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    if (!response.headersSent) response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Request could not be completed.');
  }
});

server.listen(port, host, () => { console.log(`Giftly: ${dev ? `http://localhost:${port} (development)` : origin.origin}`); });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(async () => { await vite?.close(); store.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
});
