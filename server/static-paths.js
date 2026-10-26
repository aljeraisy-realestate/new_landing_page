export function blockedStaticPath(pathname, { development = false } = {}) {
  // Vite's browser imports live in this dot directory. Allow only flat JS/source
  // map assets here, and let Vite enforce its own filesystem rules afterward.
  const optimizedModule = development && /^\/node_modules\/\.vite\/deps\/[A-Za-z0-9_-]+\.js(?:\.map)?$/.test(pathname);
  return pathname.includes('\0')
    || (!optimizedModule && pathname.split(/[\\/]/).some((part) => part.startsWith('.')))
    || (development && /^\/(?:data|server)(?:\/|$)/.test(pathname));
}
