// Derive the active prefix from the visited URL; no chosen path is compiled.
export function adminBasePath(pathname) {
  const segment = pathname.split('/')[1];
  if (!segment || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(segment)) throw new Error('invalid_management_path');
  return `/${segment}`;
}

export function adminDestination(authenticated, base) {
  return `${base}/${authenticated ? 'couriers' : 'login'}`;
}
