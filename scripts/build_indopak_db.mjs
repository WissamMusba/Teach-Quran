/**
 * ONE-OFF ASSET BUILDER for optimization change #1 (bundled indopak_pages.json moved into
 * a shipped SQLite file). Run ONLY if src/assets/data/indopak_pages.json ever changes:
 *
 *     node scripts/build_indopak_db.mjs
 *
 * Reads src/assets/data/indopak_pages.json and writes
 * android/app/src/main/assets/www/indopak_pages.db (table indopak_pages:
 * pageNumber INTEGER PRIMARY KEY, data TEXT). The www/ subfolder is REQUIRED —
 * SQLite.openDatabase({ createFromLocation: 1 }) looks up "www/" + dbName
 * inside the APK assets (see src/database/localDB.ts ensureIndopakAsset).
 * The app's first open copies that shipped file into the app sandbox and
 * serves indopak page reads from it instead of a 4.5 MB JSON require() —
 * removing ~4.5 MB from the Hermes bundle and its multi-MB first-use parse.
 * The .db is committed next to the JSON; normal builds never rebuild it.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'android/app/src/main/assets/www/indopak_pages.db');

const all = JSON.parse(readFileSync(resolve(root, 'src/assets/data/indopak_pages.json'), 'utf8'));

mkdirSync(dirname(out), { recursive: true });
rmSync(out, { force: true });

const db = new DatabaseSync(out);
db.exec(`CREATE TABLE indopak_pages (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
const ins = db.prepare(`INSERT INTO indopak_pages (pageNumber, data) VALUES (?, ?)`);
db.exec('BEGIN');
let n = 0;
for (const p of Object.values(all.pages)) {
  const pageNum = p?.page;
  if (typeof pageNum === 'number' && pageNum > 0) {
    ins.run(pageNum, JSON.stringify(p));
    n++;
  }
}
db.exec('COMMIT');
const { count } = db.prepare('SELECT COUNT(*) AS count FROM indopak_pages').get();
db.close();
console.log(`built ${out} — ${n} rows written, ${count} rows verified`);
