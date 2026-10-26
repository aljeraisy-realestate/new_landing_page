import { cities, reviewStatuses, validateCourier } from './courier.js';

export const CSV_MAX_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_ROWS = 1000;
export const csvColumns = ['id', 'name', 'phone', 'city', 'phone_type', 'ref', 'locale', 'status', 'consent_at', 'created_at', 'updated_at'];
const unsafeCell = (value) => /^[\s]*[=+\-@\t\r\n]/.test(value);
const escapeCell = (value, column) => {
  let text = String(value ?? '');
  if ((column === 'phone' && text) || unsafeCell(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export function createCourierCsv(records) {
  return [...courierCsvChunks(records)].join('');
}

export function* courierCsvChunks(records) {
  yield '\ufeff' + csvColumns.join(',') + '\r\n';
  for (const row of records) yield csvColumns.map((column) => escapeCell(row[column], column)).join(',') + '\r\n';
}

export function courierCsvTemplate() {
  return '\ufeffname,phone,city,phone_type,ref,locale,status,consent_at,created_at,updated_at\r\n';
}

function rowsFrom(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false; let closed = false;
  const pushCell = () => { row.push(cell); cell = ''; closed = false; if (row.length > csvColumns.length) throw new Error('csv_columns'); };
  const pushRow = () => { pushCell(); if (row.some((value) => value !== '')) rows.push(row); row = []; if (rows.length > CSV_MAX_ROWS + 1) throw new Error('csv_too_many_rows'); };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',') pushCell();
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[index + 1] === '\n') index += 1; pushRow(); }
    else if (char === '"') { if (cell || closed) throw new Error('csv_syntax'); quoted = true; }
    else { if (closed) throw new Error('csv_syntax'); cell += char; }
    if (cell.length > 4096) throw new Error('csv_cell_too_long');
  }
  if (quoted) throw new Error('csv_syntax');
  if (cell || row.length || closed) pushRow();
  return rows;
}

function timestamp(value) {
  if (!value) return null;
  const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d{3})?$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(normalized)) throw new Error('csv_date');
  const date = new Date(normalized);
  const precise = normalized.includes('.') ? normalized : normalized.replace('Z', '.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString() !== precise) throw new Error('csv_date');
  const canonical = date.toISOString().slice(0, -1).replace('T', ' ');
  return canonical.endsWith('.000') ? canonical.slice(0, -4) : canonical;
}

export function parseCourierCsv(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > CSV_MAX_BYTES) throw new Error('csv_too_large');
  if (text.includes('\0')) throw new Error('csv_syntax');
  const rows = rowsFrom(text.replace(/^\ufeff/, ''));
  const headers = rows.shift()?.map((value) => value.trim().toLowerCase());
  if (!headers || new Set(headers).size !== headers.length || headers.some((value) => !csvColumns.includes(value)) || ['name', 'phone', 'city', 'phone_type'].some((value) => !headers.includes(value))) throw new Error('csv_headers');
  const records = []; const errors = []; const seen = new Set(); let duplicates = 0;
  rows.forEach((cells, index) => {
    try {
      if (cells.length !== headers.length) throw new Error('csv_columns');
      const source = Object.fromEntries(headers.map((header, column) => {
        let value = cells[column].trim();
        if (value.startsWith("'") && (header === 'phone' || unsafeCell(value.slice(1)))) value = value.slice(1);
        return [header, value];
      }));
      const knownCity = cities.find((city) => city.some((value) => value.toLowerCase() === source.city.toLowerCase()));
      const courier = validateCourier({ name: source.name, phone: source.phone, city: knownCity?.[0] || 'other', ...(knownCity ? {} : { cityOther: source.city }), phoneType: source.phone_type.toLowerCase() === 'ios' ? 'iphone' : source.phone_type.toLowerCase(), ref: source.ref || '', locale: source.locale?.toLowerCase() || 'ar', consent: true });
      const status = source.status?.toLowerCase() || 'new';
      if (!courier || !reviewStatuses.includes(status)) throw new Error('csv_fields');
      const createdAt = timestamp(source.created_at); const updatedAt = timestamp(source.updated_at);
      const consentAt = timestamp(source.consent_at);
      if (seen.has(courier.phone)) { duplicates += 1; return; }
      seen.add(courier.phone);
      records.push({ ...courier, status, createdAt, updatedAt, consentAt });
    } catch (error) { if (errors.length < 50) errors.push({ row: index + 2, code: error.message }); }
  });
  return { records, errors, duplicates, total: rows.length };
}
