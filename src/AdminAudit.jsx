import { useEffect, useState } from 'react';
import { adminJson } from './admin-client.js';
import { courierPageSizes } from '../shared/courier-filters.js';

const labels = {
  ar: { courier: 'معرّف الطلب', action: 'الإجراء', actor: 'حساب الإدارة', time: 'الوقت (الرياض)', change: 'الحالة السابقة ← الجديدة', status_changed: 'تغيير الحالة', deleted: 'حذف الطلب', empty: 'لا توجد إجراءات مسجّلة بعد.' },
  en: { courier: 'Application ID', action: 'Action', actor: 'Admin account', time: 'Time (Riyadh)', change: 'Status change', status_changed: 'Status changed', deleted: 'Application deleted', empty: 'No actions recorded yet.' },
};

export default function AdminAudit({ language, copy, revision, dateLabel, onSession }) {
  const c = labels[language];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(courierPageSizes[0]);
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setFailed(false);
    adminJson(`/courier-audit?page=${page}&pageSize=${pageSize}`, { signal: controller.signal }, onSession)
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [page, pageSize, revision, retry, onSession]);

  const current = result?.page === page && result.pageSize === pageSize;

  return <>
    <label className="form-field admin-audit-page-size">
      <span>{copy.pageSize}</span>
      <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
        {courierPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
    {failed ? <div><p role="alert">{copy.error}</p><button type="button" className="text-link" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></div>
      : !result ? <p role="status">{copy.loading}</p>
      : result.items.length === 0 ? <p>{c.empty}</p>
      : <>
        <div className="admin-table-wrap"><table className="admin-table">
          <caption className="sr-only">{copy.audit}</caption>
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
            <button type="button" className="text-link" disabled={!current || result.page <= 1} onClick={() => setPage(result.page - 1)}>{copy.previous}</button>
            <button type="button" className="text-link" disabled={!current || result.page >= result.totalPages} onClick={() => setPage(result.page + 1)}>{copy.next}</button>
          </div>
        </div>
      </>}
  </>;
}
