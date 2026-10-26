import { useEffect, useRef, useState } from 'react';
import { CSV_MAX_BYTES, parseCourierCsv, courierCsvTemplate } from '../shared/courier-csv.js';
import { adminJson, getAdminSession } from './admin-client.js';
import { adminBasePath } from '../shared/page-routes.js';

const labels = {
  ar: {
    title: 'استيراد وتصدير الطلبات', hint: 'صدّر جميع الطلبات أو كل النتائج المطابقة لفلاتر الحالة والمدينة والجوال والجهاز، دون حد لعدد السجلات وبغض النظر عن الصفحة الحالية.',
    exportAll: 'تصدير الكل', exportFiltered: 'تصدير النتائج المفلترة', import: 'استيراد CSV', template: 'تحميل قالب الاستيراد', choose: 'اختر ملف CSV', cancel: 'إغلاق',
    fileHint: 'ملف UTF-8 حتى 2 ميغابايت و1,000 صف. استخدم القالب لأسماء الأعمدة. لن تُستبدل أرقام الجوال المسجّلة مسبقاً.',
    confirm: 'أؤكد أن لدي صلاحية استخدام هذه البيانات والتواصل مع أصحابها بشأن الانضمام.',
    save: 'تأكيد الاستيراد', working: 'جارٍ التنفيذ…', reading: 'جارٍ قراءة الملف…', rows: 'صفوف الملف', valid: 'طلبات صالحة', duplicates: 'مكرر داخل الملف',
    errors: 'صحّح الأخطاء في الملف ثم اختره مجدداً. لم يُحفظ أي صف.', row: 'الصف', preview: 'معاينة أول خمسة طلبات', name: 'الاسم', phone: 'الجوال', city: 'المدينة',
    empty: 'القالب فارغ. أضف بيانات الطلبات ثم اختر الملف مجدداً.', saved: (added, skipped) => `تمت إضافة ${added} طلب وتجاوز ${skipped} طلب مكرر.`,
    exportRequested: 'تم طلب تنزيل الملف. تابع التنزيل من قائمة التنزيلات في المتصفح.', failed: 'تعذّر إكمال العملية. حاول مرة أخرى.', limited: 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.',
    csv_too_large: 'حجم الملف أكبر من 2 ميغابايت.', csv_too_many_rows: 'الملف يتجاوز 1,000 صف. قسّمه إلى ملفات أصغر.',
    csv_headers: 'أسماء الأعمدة غير صحيحة أو ناقصة. استخدم القالب؛ الأعمدة المطلوبة: name, phone, city, phone_type.',
    csv_syntax: 'صيغة CSV غير صحيحة. احفظ الملف بترميز UTF-8 مع فصل الأعمدة بفاصلة.', csv_columns: 'عدد الأعمدة لا يطابق العناوين.',
    csv_cell_too_long: 'أحد الحقول طويل جداً.', csv_fields: 'تحقق من الاسم والجوال والمدينة ونوع الجهاز واللغة والحالة ورمز الإحالة.',
    csv_date: 'التاريخ غير صحيح. استخدم YYYY-MM-DD HH:mm:ss بتوقيت UTC أو صيغة ISO تنتهي بـ Z.',
  },
  en: {
    title: 'Import and export applications', hint: 'Export all applications or every match for the status, city, mobile and device filters, with no record-count limit and regardless of the current page.',
    exportAll: 'Export all', exportFiltered: 'Export filtered results', import: 'Import CSV', template: 'Download import template', choose: 'Choose a CSV file', cancel: 'Close',
    fileHint: 'UTF-8 CSV, up to 2 MB and 1,000 rows. Use the template headers. Existing mobile numbers will not be overwritten.',
    confirm: 'I confirm that I am authorized to use these details and contact these applicants about joining.',
    save: 'Confirm import', working: 'Working…', reading: 'Reading file…', rows: 'File rows', valid: 'Valid applications', duplicates: 'Duplicates in file',
    errors: 'Correct the file and select it again. No rows have been saved.', row: 'Row', preview: 'Preview of the first five applications', name: 'Name', phone: 'Mobile', city: 'City',
    empty: 'The template is empty. Add application details and select the file again.', saved: (added, skipped) => `Added ${added} applications; skipped ${skipped} duplicates.`,
    exportRequested: 'Download requested. Follow its progress in your browser’s downloads list.', failed: 'The operation could not be completed. Please try again.', limited: 'Too many attempts. Wait before trying again.',
    csv_too_large: 'The file exceeds 2 MB.', csv_too_many_rows: 'The file exceeds 1,000 rows. Split it into smaller files.',
    csv_headers: 'Missing, duplicated, or unknown headers. Use the template; required columns: name, phone, city, phone_type.',
    csv_syntax: 'Invalid CSV. Save as UTF-8 with comma-separated columns.', csv_columns: 'The number of columns does not match the headers.',
    csv_cell_too_long: 'A field is too long.', csv_fields: 'Check the name, mobile, city, device, language, status, and referral.',
    csv_date: 'Invalid date. Use YYYY-MM-DD HH:mm:ss in UTC or an ISO timestamp ending in Z.',
  },
};

function downloadCsv(csv, filename) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function AdminTransfer({ language, filters, csrfToken, onSession, onImported, disabled, filteredDisabled }) {
  const c = labels[language];
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const operation = useRef(false);
  const alive = useRef(true);
  const request = useRef(null);
  const preview = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  useEffect(() => { if (file) preview.current?.focus(); }, [file]);
  const message = (failure) => failure.status === 429 ? 'limited' : labels.en[failure.message] ? failure.message : 'failed';
  function failure(error) {
    if (!alive.current) return;
    setError(message(error));
    if (error.status === 401) onSession({ configured: true, authenticated: false });
  }

  async function choose(event) {
    const selected = event.target.files?.[0]; event.target.value = '';
    if (!selected || operation.current) return;
    operation.current = true; setBusy('reading'); setFile(null); setConfirmed(false); setResult(null); setError('');
    try {
      if (selected.size > CSV_MAX_BYTES) throw new Error('csv_too_large');
      let csv;
      try { csv = new TextDecoder('utf-8', { fatal: true }).decode(await selected.arrayBuffer()); }
      catch { throw new Error('csv_syntax'); }
      const parsed = parseCourierCsv(csv);
      if (alive.current) setFile({ name: selected.name, csv, ...parsed });
    } catch (error) { failure(error); }
    finally { operation.current = false; if (alive.current) setBusy(''); }
  }

  async function exportFile(scope) {
    if (operation.current) return;
    operation.current = true; setBusy(scope); setError(''); setResult(null);
    try {
      const session = await getAdminSession();
      if (!alive.current) return;
      if (!session.authenticated) { onSession(session); return; }
      const query = new URLSearchParams({ ...(scope === 'filtered' ? filters : {}), scope, format: 'csv' });
      const link = document.createElement('a');
      link.href = `${adminBasePath(window.location.pathname)}/api/couriers/export?${query}`;
      link.download = `giftly-couriers-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link); link.click(); link.remove();
      setResult({ type: 'export' });
    } catch (error) { failure(error); }
    finally { operation.current = false; if (alive.current) setBusy(''); }
  }

  async function importFile() {
    if (operation.current || !confirmed || !file?.records.length || file.errors.length) return;
    operation.current = true; setBusy('import'); setError(''); setResult(null);
    const controller = new AbortController(); request.current = controller;
    try {
      const value = await adminJson('/couriers/import', { method: 'POST', body: { csv: file.csv, confirmed }, csrfToken, signal: controller.signal }, onSession);
      if (!alive.current) return;
      setResult({ type: 'import', ...value }); setFile(null); setConfirmed(false); setOpen(false); onImported();
    } catch (error) { failure(error); }
    finally { operation.current = false; if (alive.current) setBusy(''); }
  }

  return <section className="admin-transfer" aria-labelledby="transfer-title">
    <div className="admin-transfer-heading"><div><h2 id="transfer-title">{c.title}</h2><p>{c.hint}</p></div><div className="admin-transfer-actions">
      <button className="button button-small" onClick={() => exportFile('all')} disabled={disabled || !!busy}>{busy === 'all' ? c.working : c.exportAll}</button>
      <button className="text-link" onClick={() => exportFile('filtered')} disabled={disabled || filteredDisabled || !!busy}>{busy === 'filtered' ? c.working : c.exportFiltered}</button>
      <button className="text-link" aria-expanded={open} aria-controls="courier-import" onClick={() => { setOpen(!open); setError(''); }} disabled={disabled || !!busy}>{open ? c.cancel : c.import}</button>
    </div></div>
    {open && <div id="courier-import" className="admin-import">
      <p>{c.fileHint}</p><button className="text-link" onClick={() => downloadCsv(courierCsvTemplate(), 'giftly-couriers-template.csv')} disabled={!!busy}>{c.template}</button>
      <label className="form-field"><span>{c.choose}</span><input type="file" accept=".csv,text/csv" onChange={choose} disabled={!!busy} /></label>
      {busy === 'reading' && <p role="status">{c.reading}</p>}
      {file && <div ref={preview} tabIndex="-1" className="admin-import-preview">
        <h3>{file.name}</h3><p>{c.rows}: {file.total} · {c.valid}: {file.records.length} · {c.duplicates}: {file.duplicates}</p>
        {!!file.errors.length && <div className="form-error" role="alert"><p>{c.errors}</p><ul>{file.errors.map((item) => <li key={item.row}>{c.row} {item.row}: {c[item.code] || c.failed}</li>)}</ul></div>}
        {!file.total && <p>{c.empty}</p>}
        {!!file.records.length && <div className="admin-table-wrap"><table className="admin-table"><caption>{c.preview}</caption><thead><tr><th scope="col">{c.name}</th><th scope="col">{c.phone}</th><th scope="col">{c.city}</th></tr></thead><tbody>{file.records.slice(0, 5).map((row) => <tr key={row.phone}><td>{row.name}</td><td><bdi>{row.phone}</bdi></td><td>{row.city}</td></tr>)}</tbody></table></div>}
        {!file.errors.length && !!file.records.length && <><label className="checkbox-field"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!!busy} /><span>{c.confirm}</span></label><button className="button" onClick={importFile} disabled={!confirmed || !!busy || disabled}>{busy === 'import' ? c.working : c.save}</button></>}
      </div>}
    </div>}
    {error && <p className="form-error" role="alert">{c[error] || c.failed}</p>}
    <p className="admin-transfer-result" role="status">{result ? result.type === 'export' ? c.exportRequested : c.saved(result.added, result.skipped) : ''}</p>
  </section>;
}
