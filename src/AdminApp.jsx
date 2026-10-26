import { useEffect, useState } from 'react';
import AdminPage from './AdminPage.jsx';
import { Brand, Icon } from './ui.jsx';
import { applyPreferences, initialLanguage, initialTheme, pageHref, savePreference } from './preferences.js';
import { adminBasePath, adminDestination } from '../shared/page-routes.js';

const labels = {
  ar: { title: 'إدارة قيڤتلي', login: 'تسجيل الدخول', applications: 'طلبات المندوبين', site: 'عرض الموقع', skip: 'انتقل إلى الإدارة', preferences: 'اللغة والمظهر', light: 'الوضع الفاتح', dark: 'الوضع الداكن' },
  en: { title: 'Giftly administration', login: 'Sign in', applications: 'Courier applications', site: 'View website', skip: 'Skip to administration', preferences: 'Language and appearance', light: 'Light theme', dark: 'Dark theme' },
};

export default function AdminApp() {
  const [language, setLanguage] = useState(initialLanguage);
  const [theme, setTheme] = useState(initialTheme);
  const [authenticated, setAuthenticated] = useState(null);
  const [path, setPath] = useState(() => window.location.pathname);
  const base = adminBasePath(path);
  const c = labels[language];
  const ar = language === 'ar';

  useEffect(() => {
    applyPreferences(language, theme);
    savePreference('giftly_language', language);
    savePreference('giftly_theme', theme);
    document.title = `${authenticated ? c.applications : c.login} | ${c.title}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', c.title);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#15111b' : '#68318e');
  }, [language, theme, authenticated, c]);

  useEffect(() => {
    if (authenticated === null) return;
    const url = new URL(window.location.href);
    url.pathname = adminDestination(authenticated, base);
    url.searchParams.delete('lang');
    url.hash = '';
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
    if (path !== url.pathname) setPath(url.pathname);
  }, [authenticated, path, base]);

  useEffect(() => {
    const restore = () => { setPath(window.location.pathname); setLanguage(initialLanguage()); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  return <div className="admin-app">
    <a className="skip-link" href="#admin-main">{c.skip}</a>
    <header className="admin-header"><div className="shell admin-topbar">
      <div className="admin-brand"><Brand language={language} href={base} /><span>{c.title}</span></div>
      <div className="admin-toolbar">
        <a className="admin-site-link text-link" href={pageHref('/', language)}>{c.site}<Icon name="diagonal" /></a>
        <div className="site-preferences" role="group" aria-label={c.preferences}>
          <button className="language-button" onClick={() => setLanguage(ar ? 'en' : 'ar')} lang={ar ? 'en' : 'ar'} dir={ar ? 'ltr' : 'rtl'} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'English' : 'العربية'}</button>
          <button className="theme-button round-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? c.light : c.dark} title={theme === 'dark' ? c.light : c.dark}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        </div>
      </div>
    </div></header>
    <main id="admin-main" tabIndex="-1" className={authenticated ? 'admin-workspace' : 'admin-signin-page'}>
      <AdminPage language={language} Icon={Icon} onAuthenticated={setAuthenticated} />
    </main>
  </div>;
}
