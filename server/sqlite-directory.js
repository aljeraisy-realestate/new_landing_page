import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const inside = (parent, child) => {
  const path = relative(parent, child);
  return !path || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};
const canonical = (path) => existsSync(path) ? realpathSync(path) : resolve(canonical(dirname(path)), relative(dirname(path), path));

function privateLocation(root, path) {
  for (const directory of ['public', 'dist', 'src', 'node_modules']) {
    if (inside(resolve(root, directory), path) || inside(canonical(resolve(root, directory)), canonical(path))) {
      throw new Error('SQLite must be outside publicly served directories.');
    }
  }
}

function databaseFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    // A linked database must not be overlooked and replaced with a new empty file.
    if (entry.isSymbolicLink()) throw new Error('SQLITE_DATA_DIR must not contain symbolic links; use the real database folder.');
    if (entry.isDirectory()) return databaseFiles(path);
    return entry.isFile() && /\.(sqlite|sqlite3|db)$/i.test(entry.name) ? [path] : [];
  });
}

function isGiftlyDatabase(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name));
    return tables.has('courier_leads') || (tables.has('couriers') && tables.has('admin_sessions'));
  } finally { db.close(); }
}

export function sqliteFile(root, filename, dataDirectory) {
  const directory = resolve(root, dataDirectory?.trim() || 'data');
  privateLocation(root, directory);
  if (filename?.trim()) {
    const file = resolve(root, filename.trim());
    privateLocation(root, file);
    if (dataDirectory?.trim() && !inside(canonical(directory), canonical(file))) {
      throw new Error('SQLITE_PATH must be inside SQLITE_DATA_DIR when both are configured.');
    }
    return file;
  }
  if (canonical(directory) === canonical(root)) throw new Error('SQLITE_DATA_DIR must be a dedicated database folder.');
  const files = databaseFiles(directory);
  const matches = files.filter((file) => {
    privateLocation(root, file);
    try { return isGiftlyDatabase(file); }
    catch (cause) { throw new Error('Cannot inspect SQLite in SQLITE_DATA_DIR. Check permissions and database integrity before restarting.', { cause }); }
  });
  if (matches.length > 1) throw new Error('Multiple Giftly databases found. Set SQLITE_PATH to select the intended file within SQLITE_DATA_DIR.');
  if (matches.length === 1) return matches[0];
  if (files.length) throw new Error('No compatible Giftly database found in SQLITE_DATA_DIR; refusing to create an empty replacement.');
  return resolve(directory, 'couriers.sqlite');
}
