const reserved = new Set(['admin', 'api', 'ar', 'en', 'assets', 'src', 'node_modules', 'server', 'data', 'dist', 'public', 'fonts', 'screens', 'artwork', 'brands', 'about', 'privacy', 'terms', 'couriers', 'rules', 'who-we-are', 'become-courier']);

export function createControlRoute(value) {
  if (typeof value !== 'string' || !/^\/[a-z0-9][a-z0-9_-]{2,63}$/.test(value) || reserved.has(value.slice(1))) throw new Error('Set private ADMIN_PATH to one non-reserved path segment, e.g. /control-center.');
  const base = value; const apiBase = `${base}/api`;
  return {
    base, apiBase,
    isPage: (path) => [base, `${base}/`, `${base}/login`, `${base}/couriers`].includes(path),
    contains: (path) => path === base || path.startsWith(`${base}/`),
    apiPath: (path) => path.startsWith(`${apiBase}/`) ? `/api/admin/${path.slice(apiBase.length + 1)}` : null,
    resource: (path) => path.startsWith(`${base}/assets/`) || path.startsWith(`${base}/src/`) || path.startsWith(`${base}/shared/`) ? path.slice(base.length) : null,
  };
}

export function privateSourcePath(pathname) {
  return /^\/(?:ar\/|en\/)?admin(?:\/|$)/i.test(pathname)
    || /(?:^|[\\/])(?:Admin[^\\/]*\.jsx|admin-main\.jsx|admin-client\.js|admin\.css|page-routes\.js)$/i.test(pathname);
}

export function managementHtml(html, base) {
  return html.replace(/(["'])\/(assets|src|shared)\//g, `$1${base}/$2/`);
}

export function managementAssets(manifest) {
  const collect = (entry, files = new Set(), seen = new Set()) => {
    if (seen.has(entry)) return files;
    seen.add(entry);
    const item = manifest[entry];
    if (!item) throw new Error('The build manifest is incomplete; rebuild both page entries.');
    for (const file of [item.file, ...(item.css || []), ...(item.assets || [])]) if (file) files.add(file);
    for (const dependency of [...(item.imports || []), ...(item.dynamicImports || [])]) collect(dependency, files, seen);
    return files;
  };
  const shared = collect('index.html');
  return new Set([...collect('admin/index.html')].filter((file) => !shared.has(file)));
}
