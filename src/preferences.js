const COOKIE_AGE = 60 * 60 * 24 * 365;

function readCookie(name, allowedValues) {
  try {
    const value = document.cookie.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    const decoded = value ? decodeURIComponent(value.slice(name.length + 1)) : null;
    return allowedValues.includes(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function initialLanguage() {
  const pathLanguage = window.location.pathname.match(/^\/(ar|en)(?:\/|$)/)?.[1];
  if (pathLanguage) return pathLanguage;
  // Accept old shared links once; the app rewrites them to locale paths.
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'ar' || query === 'en') return query;
  return readCookie('giftly_language', ['ar', 'en']) || 'ar';
}

export function initialTheme() {
  return readCookie('giftly_theme', ['light', 'dark']) || 'light';
}

export function savePreference(name, value) {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_AGE}; SameSite=Lax${secure}`;
  } catch {
    // Preferences remain usable in memory when cookies are unavailable.
  }
}

export function applyPreferences(language, theme) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function pageHref(path, language, hash = '') {
  const locale = language === 'en' ? 'en' : 'ar';
  const suffix = path === '/' ? '' : path.replace(/\/+$/, '');
  return `/${locale}${suffix}${hash ? `#${hash}` : ''}`;
}

export function routePath(pathname) {
  const path = pathname.replace(/^\/(ar|en)(?=\/|$)/, '').replace(/\/+$/, '');
  return path || '/';
}
