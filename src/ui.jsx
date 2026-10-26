import { pageHref } from './preferences.js';

const icons = {
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  diagonal: <><path d="M6 18 18 6M6 6h12v12" /></>,
  gift: <><path d="M4 10h16v5H4zM6 15v6h12v-6M12 10v11" /><path d="M12 10C3 10 5 1 9 4c2 1 3 6 3 6Zm0 0c9 0 7-9 3-6-2 1-3 6-3 6Z" /></>,
  heart: <path d="M20.5 5.5c-2.4-2.4-5.8-1.4-8.5 1.5-2.7-2.9-6.1-3.9-8.5-1.5C-1 10 5 16 12 21c7-5 13-11 8.5-15.5Z" />,
  spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /></>,
  chat: <><path d="M20 11a8 8 0 0 1-8 8H4l1.3-4A8 8 0 1 1 20 11Z" /><path d="M8 9h8M8 13h5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>,
  play: <path d="m6 3 15 9L6 21V3Z" />,
  moon: <path d="M20 15A8.5 8.5 0 0 1 9 4 8.5 8.5 0 1 0 20 15Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
};

export function Icon({ name, className = '' }) {
  return <svg className={`icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name] || icons.gift}</svg>;
}

export function Brand({ footer = false, language, href }) {
  return <a className={`brand${footer ? ' brand-footer' : ''}`} href={href || pageHref('/', language)} aria-label="Giftly">
    <svg width="34" height="40" viewBox="0 0 40 44" fill="currentColor" aria-hidden="true"><g transform="rotate(-14 20 22)"><path d="M33 7C29 4 25 3 21 3 9 3 3 11 3 23 3 35 9 41 20 41 26 41 31 39 35 35V20H20V28H26V32C24 33 23 33 21 33 15 33 12 30 12 23 12 15 15 11 21 11 24 11 27 12 29 14Z" /></g></svg>
    <span lang="en" dir="ltr">Giftly<span className="brand-dot">.</span></span>
  </a>;
}

