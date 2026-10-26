import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../server/store.js';
import { sqliteFile } from '../server/sqlite-directory.js';

const schema = readFileSync(new URL('./fixtures/original-landing.sql', import.meta.url), 'utf8');
const filters = { search: '', status: '', page: 1 };

test('existing-volume deployments fail rather than create a replacement database in an empty mount', (t) => {
  const root = fixture(t);
  assert.throws(() => sqliteFile(root, undefined, 'empty-mount', true), /existing Giftly database/i);
  const file = join(root, 'original', 'nested', 'original.sqlite');
  originalDatabase(file);
  assert.equal(sqliteFile(root, undefined, 'original', true), file);
  assert.throws(() => sqliteFile(root, 'missing.sqlite', undefined, true), /existing Giftly database/i);
});

test('private backup directories are not searched or mistaken for the active database', (t) => {
  const root = fixture(t);
  const source = join(root, 'state', 'v3', 'd1', 'original.sqlite');
  originalDatabase(source);
  originalDatabase(join(root, 'state', 'backup-before-new-landing-20261026', 'copy.sqlite'));
  originalDatabase(join(root, 'state', 'backups', 'older.sqlite'));
  assert.equal(sqliteFile(root, undefined, 'state', true), source);
});
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'giftly-directory-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function originalDatabase(file) {
  mkdirSync(join(file, '..'), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(schema);
  db.exec("INSERT INTO courier_leads (id,name,phone,city,phone_type,ref) VALUES (42,'Existing applicant','0512345678','riyadh','iphone','original-ref')");
  db.exec("CREATE TABLE giftly_migrations (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO giftly_migrations VALUES (1,'original')");
  const definitions = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  db.close();
  return definitions;
}

test('SQLITE_DATA_DIR creates a database in the configured directory and reuses it', (t) => {
  const root = fixture(t);
  let store = openStore(root, undefined, 'persistent');
  assert.equal(store.file, join(root, 'persistent', 'couriers.sqlite'));
  store.addCourier({ name: 'Test applicant', phone: '0512345678', city: 'riyadh', phoneType: 'android', locale: 'ar' });
  store.close();
  store = openStore(root, undefined, 'persistent');
  try { assert.equal(store.list(filters).total, 1); } finally { store.close(); }
});

test('discovers the original Wrangler database, ignoring metadata, without replacing base tables or records', (t) => {
  const root = fixture(t);
  const directory = join(root, 'state');
  const file = join(directory, 'v3', 'd1', 'miniflare-D1DatabaseObject', 'opaque-original.sqlite');
  const definitions = originalDatabase(file);
  const metadata = new DatabaseSync(join(directory, 'metadata.sqlite'));
  metadata.exec('CREATE TABLE metadata (key TEXT)'); metadata.close();
  let store = openStore(root, undefined, directory);
  try {
    assert.equal(store.file, file);
    assert.equal(store.list(filters).items[0].id, 42);
    assert.equal(store.list(filters).items[0].ref, 'original-ref');
    store.addCourier({ name: 'New applicant', phone: '0512345679', city: 'jeddah', phoneType: 'android', locale: 'en' });
  } finally { store.close(); }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    for (const table of definitions) assert.equal(db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(table.name).sql, table.sql);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM courier_leads').get().count, 2);
    assert.equal(db.prepare('SELECT name FROM giftly_migrations').get().name, 'original');
  } finally { db.close(); }
  store = openStore(root, undefined, directory);
  try { assert.equal(store.list(filters).total, 2); } finally { store.close(); }
  assert.equal(existsSync(join(directory, 'couriers.sqlite')), false);
});

test('ambiguous, unrelated, or unreadable databases do not silently create an empty replacement', (t) => {
  const root = fixture(t);
  originalDatabase(join(root, 'multiple', 'one.sqlite'));
  originalDatabase(join(root, 'multiple', 'two.sqlite'));
  assert.throws(() => openStore(root, undefined, 'multiple'), /multiple.*SQLITE_PATH/i);
  mkdirSync(join(root, 'other'));
  const db = new DatabaseSync(join(root, 'other', 'other.db'));
  db.exec('CREATE TABLE unrelated (id INTEGER)'); db.close();
  assert.throws(() => openStore(root, undefined, 'other'), /no compatible/i);
  assert.equal(existsSync(join(root, 'other', 'couriers.sqlite')), false);
  mkdirSync(join(root, 'corrupt'));
  writeFileSync(join(root, 'corrupt', 'broken.sqlite'), 'not a SQLite database');
  assert.throws(() => openStore(root, undefined, 'corrupt'), /cannot inspect/i);
  assert.equal(existsSync(join(root, 'corrupt', 'couriers.sqlite')), false);
});

test('legacy SQLITE_PATH still selects its file, but cannot conflict with the configured folder', (t) => {
  const root = fixture(t);
  const file = join(root, 'legacy', 'selected.sqlite');
  originalDatabase(file);
  const store = openStore(root, file, 'legacy');
  try { assert.equal(store.file, file); } finally { store.close(); }
  assert.throws(() => openStore(root, file, 'different'), /SQLITE_PATH.*SQLITE_DATA_DIR/i);
  assert.throws(() => openStore(root, undefined, 'public/database'), /outside publicly served/i);
});

test('folder aliases cannot expose databases or hide an existing database from discovery', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'public', 'database'), { recursive: true });
  symlinkSync(join(root, 'public', 'database'), join(root, 'alias'), 'junction');
  assert.throws(() => openStore(root, undefined, 'alias'), /outside publicly served/i);
  mkdirSync(join(root, 'state'));
  mkdirSync(join(root, 'real'));
  symlinkSync(join(root, 'real'), join(root, 'state', 'linked'), 'junction');
  assert.throws(() => openStore(root, undefined, 'state'), /symbolic links/i);
  assert.equal(existsSync(join(root, 'state', 'couriers.sqlite')), false);
});
