import { useEffect, useState } from 'react';
import { adminJson } from './admin-client.js';

const labels = {
  ar: { title: 'سجل الإجراءات', courier: 'معرّف الطلب', action: 'الإجراء', actor: 'حساب الإدارة', time: 'الوقت (الرياض)', change: 'الحالة السابقة ← الجديدة', status_changed: 'تغيير الحالة', deleted: 'حذف الطلب', empty: 'لا توجد إجراءات مسجّلة بعد.' },
  en: { title: 'Audit log', courier: 'Application ID', action: 'Action', actor: 'Admin account', time: 'Time (Riyadh)', change: 'Status change', status_changed: 'Status changed', deleted: 'Application deleted', empty: 'No actions recorded yet.' },
};

export default function AdminAudit({ language, copy, revision, dateLabel, onSession }) {
  const c = labels[language];
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setResult(null);
    setFailed(false);
    adminJson(`/courier-audit?page=${page}`, { signal: controller.signal }, onSession)
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [open, page, revision, retry, onSession]);

  return <details className="admin-audit" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{c.title}</summary>
    {open && (failed ? <div><p role="alert">{copy.error}</p><button type="button" className="text-link" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></div>
      : !result ? <p role="status">{copy.loading}</p>
      : result.items.length === 0 ? <p>{c.empty}</p>
      : <>
        <div className="admin-table-wrap"><table className="admin-table">
          <caption className="sr-only">{c.title}</caption>
          <thead><tr>{['courier', 'action', 'actor', 'change', 'time'].map((key) => <th key={key} scope="col">{c[key]}</th>)}</tr></thead>
          <tbody>{result.items.map((entry) => <tr key={entry.id}>
            <td><bdi>{entry.courier_id}</bdi></td>
            <td>{c[entry.action]}</td>
            <td><bdi>{entry.actor}</bdi></td>
            <td>{copy[entry.previous_status]}{entry.new_status && <> {language === 'ar' ? '←' : '→'} {copy[entry.new_status]}</>}</td>
            <td>{dateLabel(entry.occurred_at)}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="admin-pagination">
          <span>{copy.page} {result.page} {copy.of} {result.totalPages}</span>
          <div className="admin-pagination-buttons">
            <button type="button" className="text-link" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>{copy.previous}</button>
            <button type="button" className="text-link" disabled={result.page >= result.totalPages} onClick={() => setPage(result.page + 1)}>{copy.next}</button>
          </div>
        </div>
      </>)}
  </details>;
}
