import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCourierCsv, createCourierCsv, courierCsvTemplate } from '../shared/courier-csv.js';

test('CSV import normalizes Arabic phones/cities and skips repeated phones', () => {
  const result = parseCourierCsv('\ufeffname,phone,city,phone_type,status\r\nسارة أحمد,٠٥١٢٣٤٥٦٧٨,الرياض,ios,accepted\r\nOther Name,+966512345678,riyadh,iphone,new');
  assert.equal(result.errors.length, 0); assert.equal(result.duplicates, 1); assert.equal(result.total, 2);
  assert.equal(result.records[0].phone, '0512345678'); assert.equal(result.records[0].city, 'riyadh');
  assert.equal(result.records[0].phoneType, 'iphone'); assert.equal(result.records[0].status, 'accepted');
  assert.equal(result.records[0].consentAt, null);
});

test('CSV export/import round trip preserves metadata, quotes and leading zeros', () => {
  const csv = createCourierCsv([{ id: 10, name: "O'Neil Smith", phone: '0512345678', city: 'الخرج', phone_type: 'android', ref: 'launch_1', locale: 'ar', status: 'contacted', created_at: '2026-02-03 04:05:06', updated_at: '2026-03-04 05:06:07', consent_at: '2026-02-03T04:05:06.000Z' }]);
  const result = parseCourierCsv(csv);
  assert.equal(result.errors.length, 0); assert.equal(result.records[0].name, "O'Neil Smith");
  assert.equal(result.records[0].phone, '0512345678'); assert.equal(result.records[0].city, 'الخرج');
  assert.equal(result.records[0].createdAt, '2026-02-03 04:05:06'); assert.equal(result.records[0].ref, 'launch_1');
  assert.equal(result.records[0].status, 'contacted'); assert.equal(result.records[0].consentAt, '2026-02-03 04:05:06');
});

test('spreadsheet formulas are escaped without damaging a valid import round trip', () => {
  const csv = createCourierCsv([{ name: '-Example Name', phone: '0512345678', city: 'riyadh', phone_type: 'iphone', status: 'new', locale: 'en', ref: '=DANGEROUS()' }]);
  assert.ok(csv.includes("'-Example Name")); assert.ok(csv.includes("'=DANGEROUS()"));
  const safe = parseCourierCsv(createCourierCsv([{ name: '-Example Name', phone: '0512345678', city: 'riyadh', phone_type: 'iphone', locale: 'en' }]));
  assert.equal(safe.errors.length, 0); assert.equal(safe.records[0].name, '-Example Name');
});

test('historical timestamp milliseconds survive export and import', () => {
  const result = parseCourierCsv(createCourierCsv([{ name: 'Test Person', phone: '0512345678', city: 'riyadh', phone_type: 'iphone', created_at: '2026-02-03 04:05:06.123', consent_at: '2026-02-03T04:05:06.789Z' }]));
  assert.equal(result.errors.length, 0);
  assert.equal(result.records[0].createdAt, '2026-02-03 04:05:06.123');
  assert.equal(result.records[0].consentAt, '2026-02-03 04:05:06.789');
});

test('invalid rows report errors instead of silently dropping bad data', () => {
  const result = parseCourierCsv('name,phone,city,phone_type,status,created_at\nValid Name,0512345678,riyadh,iphone,new,2026-02-30 00:00:00\nOther Name,123,jeddah,android,invalid,');
  assert.equal(result.errors.length, 2); assert.equal(result.errors[0].row, 2); assert.equal(result.records.length, 0);
});

test('CSV handles quoted commas, quotes and newlines and rejects malformed syntax', () => {
  const result = parseCourierCsv('name,phone,city,phone_type\r\n"Sara\nAhmed",0512345678,riyadh,iphone');
  assert.equal(result.records[0].name, 'Sara Ahmed');
  const quoted = parseCourierCsv('name,phone,city,phone_type\n"Sara, ""Ahmed""",0512345678,riyadh,iphone');
  assert.equal(quoted.errors[0].row, 2);
  for (const csv of ['name,phone\n"unclosed', 'name,phone\n"name"junk,0512345678', 'name,name,phone,city,phone_type', 'name,phone,city,phone_type,unexpected']) assert.throws(() => parseCourierCsv(csv));
});

test('empty template is readable and size/row limits are enforced', () => {
  assert.equal(parseCourierCsv(courierCsvTemplate()).records.length, 0);
  assert.throws(() => parseCourierCsv('a'.repeat(2 * 1024 * 1024 + 1)), { message: 'csv_too_large' });
  const row = 'Valid Name,0512345678,riyadh,iphone\n';
  assert.throws(() => parseCourierCsv('name,phone,city,phone_type\n' + row.repeat(1001)), { message: 'csv_too_many_rows' });
});
