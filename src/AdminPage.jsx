import { useEffect, useRef, useState } from 'react';
import { cities, reviewStatuses } from '../shared/courier.js';
import { adminJson, adminSignIn, adminSignOut, getAdminSession } from './admin-client.js';
import AdminTransfer from './AdminTransfer.jsx';
import { canonicalCity, courierPageSizes } from '../shared/courier-filters.js';

const labels = {
  ar: {
    title: 'طلبات الانضمام للمندوبين', intro: 'راجع الطلبات المسجّلة وتابع حالة التواصل من مكان واحد.',
    login: 'تسجيل دخول الإدارة', username: 'اسم المستخدم', password: 'كلمة المرور', signIn: 'دخول', signingIn: 'جارٍ الدخول…',
    loading: 'جارٍ التحميل…', logout: 'تسجيل الخروج', refresh: 'تحديث',
    setup: 'أضف ADMIN_USERNAME وADMIN_PASSWORD وADMIN_JWT_SECRET في ملف .env الخاص بالخادم، ثم أعد تشغيله. يلزم اسم مستخدم من 3 أحرف وكلمة مرور من 4 أحرف على الأقل ومفتاح عشوائي من 64 خانة بالنظام الست عشري.',
    invalid: 'بيانات الدخول غير صحيحة.', limited: 'محاولات كثيرة. انتظر قليلاً قبل المحاولة مجدداً.', error: 'تعذّر إكمال العملية. حاول مرة أخرى.',
    searchButton: 'بحث', filter: 'حالة الطلب', all: 'كل الحالات',
    total: 'جميع الطلبات', new: 'جديد', contacted: 'تم التواصل', accepted: 'مقبول',
    name: 'الاسم', phone: 'رقم الجوال', city: 'المدينة', device: 'الجهاز', ref: 'الإحالة', created: 'تاريخ التسجيل', status: 'الحالة',
    empty: 'لا توجد طلبات مطابقة.', emptyHint: 'ستظهر هنا طلبات المندوبين بعد إرسال نموذج الانضمام.',
    previous: 'السابق', next: 'التالي', page: 'الصفحة', of: 'من', results: 'نتيجة',
    saved: 'تم حفظ الحالة.', statusFor: 'حالة طلب', retry: 'حاول مرة أخرى',
    id: 'المعرّف', allCities: 'كل المدن', allDevices: 'كل الأجهزة', pageSize: 'عدد السجلات في الصفحة', clear: 'مسح الفلاتر', filtersError: 'تحقق من رقم الجوال والفلاتر ثم حاول مجدداً.',
  },
  en: {
    title: 'Courier applications', intro: 'Review registered applicants and keep track of follow-up in one place.',
    login: 'Admin sign-in', username: 'Username', password: 'Password', signIn: 'Sign in', signingIn: 'Signing in…',
    loading: 'Loading…', logout: 'Sign out', refresh: 'Refresh',
    setup: 'Set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_JWT_SECRET in the server’s private .env file, then restart it. Use at least 3 characters for the username, 4 for the password, and 64 random hexadecimal characters for the signing secret.',
    invalid: 'The sign-in details are incorrect.', limited: 'Too many attempts. Wait before trying again.', error: 'The request could not be completed. Please try again.',
    searchButton: 'Search', filter: 'Application status', all: 'All statuses',
    total: 'All applications', new: 'New', contacted: 'Contacted', accepted: 'Accepted',
    name: 'Name', phone: 'Mobile number', city: 'City', device: 'Device', ref: 'Referral', created: 'Registered', status: 'Status',
    empty: 'No matching applications.', emptyHint: 'Submitted courier applications will appear here.',
    previous: 'Previous', next: 'Next', page: 'Page', of: 'of', results: 'results',
    saved: 'Status saved.', statusFor: 'Application status for', retry: 'Try again',
    id: 'ID', allCities: 'All cities', allDevices: 'All devices', pageSize: 'Records per page', clear: 'Clear filters', filtersError: 'Check the mobile number and filters, then try again.',
  },
};

export default function AdminPage({ language, Icon, onAuthenticated }) {
  const c = labels[language];
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneType, setPhoneType] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [cityOptions, setCityOptions] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const savingRef = useRef(false);
  const ready = useRef(null);
  const messageFor = (failure) => failure.status === 429 ? 'limited' : failure.message === 'invalid_credentials' ? 'invalid' : failure.message === 'invalid_filters' ? 'filtersError' : 'error';
  const filters = { status, city, phone, phoneType, sortBy: 'created_at', sortDirection: 'desc' };
  const queryKey = new URLSearchParams({ ...filters, page: String(page), pageSize: String(pageSize) }).toString();
  const matchesQuery = data?.queryKey === queryKey;

  useEffect(() => {
    if (session) onAuthenticated?.(session.authenticated);
  }, [session?.authenticated, onAuthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    getAdminSession().then((value) => {
      if (!controller.signal.aborted) { setSession(value); setSessionError(false); }
    }).catch(() => { if (!controller.signal.aborted) setSessionError(true); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!session?.authenticated) return;
    let disposed = false;
    let timer;
    const schedule = (value, retry = false) => {
      clearTimeout(timer);
      const remaining = Math.max(1000, value.accessExpiresAt - Date.now() - 15000);
      timer = setTimeout(renew, retry ? 30000 : remaining);
    };
    async function renew() {
      if (disposed) return;
      try {
        const value = await getAdminSession();
        if (disposed) return;
        setSession(value);
        if (!value.authenticated) { setData(null); return; }
        schedule(value);
      } catch (failure) {
        if (disposed) return;
        if (failure.status === 401) { setSession({ configured: true, authenticated: false }); setData(null); }
        else schedule(session, true);
      }
    }
    const wake = () => { if (document.visibilityState === 'visible') renew(); };
    schedule(session);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    return () => { disposed = true; clearTimeout(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); window.removeEventListener('online', wake); };
  }, [session?.authenticated, session?.accessExpiresAt]);

  useEffect(() => {
    if (!session?.authenticated) return;
    const controller = new AbortController();
    setLoading(true);
    adminJson(`/couriers?${queryKey}`, { signal: controller.signal }, setSession).then((value) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(value.items) || !value.counts || !Number.isInteger(value.total) || value.total < 0 || !Number.isInteger(value.page) || value.page < 1 || !courierPageSizes.includes(value.pageSize) || !Array.isArray(value.cityOptions) || !Number.isInteger(value.totalPages) || value.totalPages < 1) throw new Error('invalid_response');
      setCityOptions(value.cityOptions);
      if (page !== value.page) { setPage(value.page); return; }
      setData({ ...value, queryKey });
      setError('');
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      setData(null);
      setError(messageFor(failure));
      if (failure.status === 401) setSession({ configured: true, authenticated: false });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session?.authenticated, queryKey, revision]);

  useEffect(() => { if (session?.authenticated) ready.current?.focus(); }, [session?.authenticated]);

  async function signIn(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const value = await adminSignIn({ username, password });
      setPassword(''); setSession({ configured: true, ...value });
    } catch (failure) { setPassword(''); setError(messageFor(failure)); }
    finally { setBusy(false); pending.current = false; }
  }

  async function signOut() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await adminSignOut();
      setSession({ configured: true, authenticated: false }); setData(null); setNotice('');
    } catch (failure) {
      if (failure.status === 401) { setSession({ configured: true, authenticated: false }); setData(null); }
      else setError(messageFor(failure));
    } finally { setBusy(false); pending.current = false; }
  }

  async function updateStatus(id, value) {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(id); setNotice(''); setError('');
    try {
      await adminJson(`/couriers/${id}`, { method: 'PATCH', body: { status: value }, csrfToken: session.csrfToken }, setSession);
      setNotice('saved'); setRevision((current) => current + 1);
    } catch (failure) {
      setError(messageFor(failure));
      if (failure.status === 401) { setSession({ configured: true, authenticated: false }); setData(null); }
    } finally { setSaving(''); savingRef.current = false; }
  }

  function dateLabel(value) {
    const date = new Date(typeof value === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d{3})?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh', calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  if (!session) return <section className="shell admin-section"><h1>{c.login}</h1>{sessionError ? <><p className="form-error" role="alert">{c.error}</p><button className="button" onClick={() => { setSessionError(false); setRevision((value) => value + 1); }}>{c.retry}</button></> : <p role="status">{c.loading}</p>}</section>;

  if (!session.authenticated) return <section className="shell admin-section"><div className="admin-login application-card"><span className="benefit-icon"><Icon name="lock" /></span><h1>{c.login}</h1>{!session.configured ? <p className="admin-setup">{c.setup}</p> : <form onSubmit={signIn}><label className="form-field"><span>{c.username}</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength="100" disabled={busy} dir="ltr" /></label><label className="form-field"><span>{c.password}</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength="4" maxLength="512" disabled={busy} dir="ltr" /></label>{error && <p className="form-error" role="alert">{c[error]}</p>}<button className="button form-submit" disabled={busy}>{busy ? c.signingIn : c.signIn}</button></form>}</div></section>;

  const lastPage = matchesQuery ? data.totalPages : 1;
  const firstRecord = matchesQuery && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastRecord = matchesQuery && data.total ? firstRecord + data.items.length - 1 : 0;
  const paginationBusy = !matchesQuery || loading || busy || !!saving;
  const cityLabel = (value) => cities.find(([id]) => id === canonicalCity(value))?.[language === 'ar' ? 1 : 2] || value;
  return <section className="shell admin-section">
    <div className="admin-heading"><div><h1 ref={ready} tabIndex="-1">{c.title}</h1><p>{c.intro}</p></div><div className="admin-actions"><button className="text-link" onClick={() => setRevision((value) => value + 1)} disabled={loading || busy}>{c.refresh}</button><button className="button button-small" onClick={signOut} disabled={busy || !!saving}>{c.logout}</button></div></div>
    <div className="admin-counts">{['total', ...reviewStatuses].map((key) => <article key={key}><span>{c[key]}</span><strong>{data?.counts[key] ?? '—'}</strong></article>)}</div>
    <AdminTransfer language={language} filters={filters} csrfToken={session.csrfToken} onSession={setSession} onImported={() => { setPage(1); setRevision((value) => value + 1); }} disabled={busy || !!saving} filteredDisabled={loading || !matchesQuery} />
    <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setPhone(draftPhone.trim()); setRevision((value) => value + 1); }}>
      <label className="form-field"><span>{c.phone}</span><input aria-label={c.phone} type="search" inputMode="tel" dir="ltr" value={draftPhone} maxLength="24" onChange={(event) => setDraftPhone(event.target.value)} /></label>
      <label className="form-field"><span>{c.city}</span><select aria-label={c.city} value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }}><option value="">{c.allCities}</option>{cityOptions.map((value) => <option key={value} value={value}>{cityLabel(value)}</option>)}</select></label>
      <label className="form-field"><span>{c.device}</span><select aria-label={c.device} value={phoneType} onChange={(event) => { setPhoneType(event.target.value); setPage(1); }}><option value="">{c.allDevices}</option><option value="iphone">iPhone / iOS</option><option value="android">Android</option></select></label>
      <label className="form-field"><span>{c.filter}</span><select aria-label={c.filter} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">{c.all}</option>{reviewStatuses.map((value) => <option key={value} value={value}>{c[value]}</option>)}</select></label>
      <label className="form-field"><span>{c.pageSize}</span><select aria-label={c.pageSize} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{courierPageSizes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <div className="admin-filter-actions"><button className="button" type="submit" disabled={busy || !!saving}>{c.searchButton}</button><button className="text-link" type="button" onClick={() => { setDraftPhone(''); setPhone(''); setCity(''); setPhoneType(''); setStatus(''); setPage(1); }}>{c.clear}</button></div>
    </form>
    {error && <p className="form-error" role="alert">{c[error]}</p>}<p className="admin-notice" role="status">{notice ? c[notice] : loading ? c.loading : ''}</p>
    <div className="admin-table-wrap" aria-busy={loading}><table className="admin-table"><caption className="sr-only">{c.title}</caption><thead><tr>{['id', 'name', 'phone', 'city', 'device', 'ref', 'created', 'status'].map((key) => <th key={key} scope="col">{c[key]}</th>)}</tr></thead><tbody>{matchesQuery && data.items.map((row) => <tr key={row.id}><td className="courier-id"><bdi>{row.id}</bdi></td><td>{row.name}</td><td><bdi>{row.phone}</bdi></td><td>{cityLabel(row.city)}</td><td>{row.phone_type === 'iphone' ? 'iPhone' : 'Android'}</td><td>{row.ref || '—'}</td><td>{dateLabel(row.created_at)}</td><td><select aria-label={`${c.statusFor} ${row.name}`} value={row.status} disabled={loading || !!saving || busy} onChange={(event) => updateStatus(row.id, event.target.value)}>{reviewStatuses.map((value) => <option key={value} value={value}>{c[value]}</option>)}</select>{saving === row.id && <span className="sr-only" role="status">{c.loading}</span>}</td></tr>)}</tbody></table>{!loading && matchesQuery && data.items.length === 0 && <div className="admin-empty"><h2>{c.empty}</h2><p>{c.emptyHint}</p></div>}</div>
    <div className="admin-pagination">
      <span aria-live="polite">{firstRecord}–{lastRecord} {c.of} {matchesQuery ? data.total : '—'} {c.results} · {c.page} {page} {c.of} {lastPage}</span>
      <div className="admin-pagination-buttons"><button className="text-link pagination-previous" disabled={paginationBusy || !data?.hasPrevious} onClick={() => setPage((value) => Math.max(1, value - 1))}><Icon name="arrow" />{c.previous}</button><button className="text-link pagination-next" disabled={paginationBusy || !data?.hasNext} onClick={() => setPage((value) => Math.min(lastPage, value + 1))}>{c.next}<Icon name="arrow" /></button></div>
    </div>
  </section>;
}
