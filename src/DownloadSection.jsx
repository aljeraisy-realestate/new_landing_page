import { useState } from 'react';

const storeOptions = [
  { id: 'apple', badge: '/brands/app-store.svg', value: import.meta.env.VITE_APP_STORE_URL, host: 'apps.apple.com', title: 'iOS', store: 'App Store' },
  { id: 'play', badge: '/brands/google-play.png', value: import.meta.env.VITE_PLAY_STORE_URL, host: 'play.google.com', title: 'Android', store: 'Google Play' },
];

function validStoreUrl(value, host) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export default function DownloadSection({ copy, language, Icon }) {
  const ar = language === 'ar';
  const [pendingStore, setPendingStore] = useState('');
  return <section className="download" id="get-giftly" aria-labelledby="download-title"><div className="shell download-inner">
    <Icon name="gift" className="download-gift" /><p className="eyebrow">{copy.downloadLabel}</p><h2 id="download-title">{copy.downloadTitle}</h2><p>{copy.downloadBody}</p>
    <div className="store-grid">{storeOptions.map((store) => {
      const url = validStoreUrl(store.value, store.host);
      const label = store.id === 'apple' ? copy.appStore : copy.playStore;
      const badge = <img src={store.badge} className={`official-store-badge badge-${store.id}`} alt={label} width={store.id === 'apple' ? '180' : '207'} height={store.id === 'apple' ? '60' : '80'} />;
      return <article className="store-card official-store-card" key={store.id}><div><h3 dir="ltr">{store.title}</h3><p id={`store-status-${store.id}`}>{url ? (ar ? `متاح على ${store.store}` : `Available on ${store.store}`) : store.store}</p></div>{url ? <a className="store-badge-link" href={url} target="_blank" rel="noopener noreferrer">{badge}</a> : <button className="store-badge-link" type="button" onClick={() => setPendingStore(store.store)} aria-describedby={`store-status-${store.id}`}>{badge}</button>}</article>;
    })}</div><p className="store-link-message" role="status" aria-live="polite">{pendingStore ? (ar ? `سيُضاف رابط تحميل قيڤتلي على ${pendingStore} قريباً.` : `The Giftly download link for ${pendingStore} will be added soon.`) : ''}</p>
    <span className="download-spark one" aria-hidden="true">✳</span><span className="download-spark two" aria-hidden="true">✦</span>
  </div></section>;
}
