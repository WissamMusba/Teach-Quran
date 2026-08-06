/**
 * FILE: src/database/localDB.ts
 */
import SQLite from 'react-native-sqlite-storage';
import auth from '@react-native-firebase/auth';
SQLite.enablePromise(true);
let dbInstance: any = null;

export const canvasKeyForPage = (pageNum: number) => `page_${pageNum}`;
export const canvasKeyForSurah = (surahId: number) => `surah_${surahId}`;

export const initDatabase = async () => {
  if (dbInstance) return;
  dbInstance = await SQLite.openDatabase({ name: 'quran.db', location: 'default' });
  
  await dbInstance.executeSql(`PRAGMA journal_mode=WAL;`);
  await dbInstance.executeSql(`PRAGMA synchronous=NORMAL;`);
  
  // Existing tables
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS surahs (id INTEGER PRIMARY KEY, name TEXT, englishName TEXT, verses INTEGER)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS verses (id INTEGER PRIMARY KEY AUTOINCREMENT, surahId INTEGER, verseNumber INTEGER, textArabic TEXT, textIndopak TEXT, textTranslation TEXT, page INTEGER)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages_indopak (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS student_list_cache (uid TEXT PRIMARY KEY, students TEXT NOT NULL, updatedAt TEXT NOT NULL)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS page_layout_cache (
    pageNumber INTEGER NOT NULL, textStyle TEXT NOT NULL, headerVisible INTEGER NOT NULL,
    fs INTEGER NOT NULL, sparse INTEGER NOT NULL, screenW INTEGER NOT NULL,
    lines TEXT NOT NULL,
    PRIMARY KEY (pageNumber, textStyle, headerVisible, fs, sparse, screenW))`);

  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
  const r = await dbInstance.executeSql(`SELECT value FROM meta WHERE key='layoutVer'`);
  const ver = r && r[0] && r[0].rows && r[0].rows.length ? parseInt(r[0].rows.item(0).value, 10) : 0;
  if (ver < 2) {
    await dbInstance.executeSql(`DELETE FROM page_layout_cache`);
    await dbInstance.executeSql(`INSERT OR REPLACE INTO meta(key,value) VALUES('layoutVer','2')`);
  }

  await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId)`);
  await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_page ON verses(page)`);
  await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah_verse ON verses(surahId, verseNumber)`);

  // Migrate V1 to V2 schema if needed
  await migrateV1IfNeeded(dbInstance);

  // New V4 Tables
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS student_data_cache (
      studentId TEXT NOT NULL, canvasKey TEXT NOT NULL, data TEXT NOT NULL,
      v INTEGER DEFAULT 0, serverTs INTEGER DEFAULT 0,
      PRIMARY KEY (studentId, canvasKey))`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS student_manifest_cache (
      studentId TEXT PRIMARY KEY, manifest TEXT NOT NULL, serverTs INTEGER DEFAULT 0)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS sync_queue (
      studentId TEXT NOT NULL, canvasKey TEXT NOT NULL,
      synced INTEGER DEFAULT 0, attempts INTEGER DEFAULT 0,
      PRIMARY KEY (studentId, canvasKey))`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS sync_last_push (
      studentId TEXT PRIMARY KEY, pushedAt INTEGER NOT NULL)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS sync_last_pull (
      studentId TEXT PRIMARY KEY, pulledAt INTEGER NOT NULL)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS audio_notes_cache (
      studentId TEXT NOT NULL, rangeKey TEXT NOT NULL, entries TEXT NOT NULL,
      v INTEGER DEFAULT 0,
      PRIMARY KEY (studentId, rangeKey))`);
};

export const getDB = () => dbInstance;

// ---------------- canvas CRUD (SQLite is the single source of truth) --------
export const getChunk = async (studentId: string, canvasKey: string) => {
  const r = await getDB().executeSql(`SELECT data, v FROM student_data_cache WHERE studentId=? AND canvasKey=?`, [studentId, canvasKey]);
  if (r && r[0].rows.length > 0) { const row = r[0].rows.item(0); return { data: JSON.parse(row.data), v: row.v }; }
  return null;
};

export const saveChunk = async (studentId: string, canvasKey: string, data: any, v: number, queue = true) => {
  await getDB().transaction((tx: any) => {
    tx.executeSql(`INSERT OR REPLACE INTO student_data_cache (studentId, canvasKey, data, v) VALUES (?, ?, ?, ?)`,
      [studentId, canvasKey, JSON.stringify(data), v]);
    if (queue) tx.executeSql(`INSERT OR REPLACE INTO sync_queue (studentId, canvasKey, synced, attempts) VALUES (?, ?, 0, 0)`,
      [studentId, canvasKey]);
  });
};

/** Pull-side writes must NOT re-dirty the sync queue (else every pull re-pushes forever). */
export const saveChunkNoQueue = async (studentId: string, canvasKey: string, data: any, v: number) =>
  saveChunk(studentId, canvasKey, data, v, false);

export const saveCanvasEdit = async (studentId: string, canvasKey: string, section: string, patch: any) => {
  const cur = await getChunk(studentId, canvasKey);
  const data = cur?.data || { strokes: [], highlights: {}, notes: {} };
  if (section === 'strokes') data.strokes = patch;
  else if (section === 'highlights') data.highlights = { ...(data.highlights || {}), ...patch };
  else if (section === 'notes') data.notes = { ...(data.notes || {}), ...patch };
  await saveChunk(studentId, canvasKey, data, (cur?.v || 0) + 1);   // 0 cloud writes here
  return data;
};

export const markSynced = async (studentId: string, canvasKey: string) => {
  try { await getDB().executeSql(`DELETE FROM sync_queue WHERE studentId=? AND canvasKey=?`, [studentId, canvasKey]); } catch {}
};
export const bumpAttempt = async (studentId: string, canvasKey: string) => {
  try { await getDB().executeSql(`UPDATE sync_queue SET attempts = attempts + 1 WHERE studentId=? AND canvasKey=?`, [studentId, canvasKey]); } catch {}
};

/** Dirty canvases grouped by student - the push pass iterates this. */
export const getDirtyCanvasesByStudent = async (): Promise<Record<string, string[]>> => {
  const r = await getDB().executeSql(`SELECT studentId, canvasKey FROM sync_queue ORDER BY attempts`);
  const groups: Record<string, string[]> = {};
  for (let i = 0; i < r[0].rows.length; i++) {
    const row = r[0].rows.item(i);
    (groups[row.studentId] = groups[row.studentId] || []).push(row.canvasKey);
  }
  return groups;
};

// ---------------- min-interval guard (lever 5) ----------------
export const getLastPushAt = async (studentId: string): Promise<number> => {
  const r = await getDB().executeSql(`SELECT pushedAt FROM sync_last_push WHERE studentId=?`, [studentId]);
  return r && r[0].rows.length > 0 ? r[0].rows.item(0).pushedAt : 0;
};
export const setLastPushAt = async (studentId: string, ts: number) => {
  await getDB().executeSql(`INSERT OR REPLACE INTO sync_last_push (studentId, pushedAt) VALUES (?, ?)`, [studentId, ts]);
};

// ---------------- pull watermark (server time of the last applied pull) ----------------
export const getLastPullAt = async (studentId: string): Promise<number> => {
  const r = await getDB().executeSql(`SELECT pulledAt FROM sync_last_pull WHERE studentId=?`, [studentId]);
  return r && r[0].rows.length > 0 ? r[0].rows.item(0).pulledAt : 0;
};
export const setLastPullAt = async (studentId: string, ts: number) => {
  await getDB().executeSql(`INSERT OR REPLACE INTO sync_last_pull (studentId, pulledAt) VALUES (?, ?)`, [studentId, ts]);
};

/**
 * WHAT: Applies one student's COMPLETE pull pass atomically — all pulled
 *   annotation chunks, the cloud manifest (bookmarks/lastRead), any audio-note
 *   ranges, and the pull watermark — in ONE SQLite transaction.
 * WHY: the old pull wrote each chunk in its own transaction (minutes on a big
 *   book, and reloads mid-pull showed partial data). Bulk-committing makes the
 *   DB itself all-or-nothing: Redux reloads after sync can never observe a
 *   half-pulled student. queue=false everywhere — pulled data must never
 *   re-dirty the push queue.
 */
export const savePullBatch = async (
  studentId: string,
  chunks: { canvasKey: string; data: any; v: number }[],
  manifest?: { data: any; serverTs: number } | null,
  audioRanges?: { rangeKey: string; entries: any; v: number }[],
  pulledAt?: number,
) => {
  await getDB().transaction((tx: any) => {
    for (const c of chunks) {
      tx.executeSql(`INSERT OR REPLACE INTO student_data_cache (studentId, canvasKey, data, v) VALUES (?, ?, ?, ?)`,
        [studentId, c.canvasKey, JSON.stringify(c.data), c.v]);
    }
    if (manifest) {
      tx.executeSql(`INSERT OR REPLACE INTO student_manifest_cache (studentId, manifest, serverTs) VALUES (?, ?, ?)`,
        [studentId, JSON.stringify(manifest.data), manifest.serverTs]);
    }
    for (const a of audioRanges || []) {
      tx.executeSql(`INSERT OR REPLACE INTO audio_notes_cache (studentId, rangeKey, entries, v) VALUES (?, ?, ?, ?)`,
        [studentId, a.rangeKey, JSON.stringify(a.entries), a.v]);
    }
    if (pulledAt != null) {
      tx.executeSql(`INSERT OR REPLACE INTO sync_last_pull (studentId, pulledAt) VALUES (?, ?)`,
        [studentId, pulledAt]);
    }
  });
};

// ---------------- manifest ----------------
export const getManifest = async (studentId: string) => {
  const r = await getDB().executeSql(`SELECT manifest, serverTs FROM student_manifest_cache WHERE studentId=?`, [studentId]);
  if (r && r[0].rows.length > 0) { const row = r[0].rows.item(0); return { data: JSON.parse(row.manifest), serverTs: row.serverTs }; }
  return { data: { schemaVersion: 3, v: 0, pages: {}, bookmarks: {}, audioNotes: {}, lastRead: null }, serverTs: 0 };
};
export const saveManifestLocal = async (studentId: string, manifest: any, serverTs = 0, queue = true) => {
  const db = getDB();
  await db.executeSql(`INSERT OR REPLACE INTO student_manifest_cache (studentId, manifest, serverTs) VALUES (?, ?, ?)`,
    [studentId, JSON.stringify(manifest), serverTs]);
  // queue=false on pull paths so pulled manifests never re-dirty the push queue.
  if (queue) await addToSyncQueue(studentId, '_manifest');
};

// ---------------- audio notes per 10-page range (lazy-synced groups) ----------------
export const rangeKeyForPage = (pageNum: number) => {
  const lo = Math.floor((pageNum - 1) / 10) * 10 + 1;
  return `r_${lo}_${lo + 9}`;
};
export const getVersePageDB = async (surah: number, verse: number): Promise<number> => {
  try {
    const r = await getDB().executeSql(`SELECT page FROM verses WHERE surahId=? AND verseNumber=? LIMIT 1`, [surah, verse]);
    return r && r[0].rows.length ? r[0].rows.item(0).page : 0;
  } catch { return 0; }
};
export const rangeKeyForVerse = async (verseKey: string) => {
  const [s, v] = verseKey.split('_').map(Number);
  const page = await getVersePageDB(s, v);
  return page > 0 ? rangeKeyForPage(page) : `s_${s}`;
};
export const getAudioNotesRange = async (studentId: string, rangeKey: string) => {
  const r = await getDB().executeSql(`SELECT entries, v FROM audio_notes_cache WHERE studentId=? AND rangeKey=?`, [studentId, rangeKey]);
  if (r && r[0].rows.length > 0) { const row = r[0].rows.item(0); return { entries: JSON.parse(row.entries), v: row.v }; }
  return { entries: {}, v: 0 };
};
export const saveAudioNotesRange = async (studentId: string, rangeKey: string, entries: any, v: number, queue = true) => {
  await getDB().executeSql(`INSERT OR REPLACE INTO audio_notes_cache (studentId, rangeKey, entries, v) VALUES (?, ?, ?, ?)`,
    [studentId, rangeKey, JSON.stringify(entries), v]);
  if (queue) await addToSyncQueue(studentId, `_audio_${rangeKey}`);
};
export const getAllAudioRanges = async (studentId: string) => {
  const r = await getDB().executeSql(`SELECT rangeKey, entries, v FROM audio_notes_cache WHERE studentId=?`, [studentId]);
  const out: Record<string, { entries: any; v: number }> = {};
  for (let i = 0; i < r[0].rows.length; i++) { const row = r[0].rows.item(i); out[row.rangeKey] = { entries: JSON.parse(row.entries), v: row.v }; }
  return out;
};
/** One-time move: legacy manifest audioNotes map -> per-range rows (idempotent). */
export const migrateLegacyAudioNotes = async (studentId: string) => {
  try {
    const m = await getManifest(studentId);
    const legacy = m.data.audioNotes;
    if (!legacy || typeof legacy !== 'object' || Object.keys(legacy).length === 0) return;
    const byRange: Record<string, any> = {};
    for (const [fileId, entry] of Object.entries(legacy)) {
      const e = entry as any;
      if (typeof e?.surah !== 'number' || typeof e?.ayah !== 'number') continue;
      const key = await rangeKeyForVerse(`${e.surah}_${e.ayah}`);
      byRange[key] = { ...(byRange[key] || {}), [fileId]: e };
    }
    for (const [key, entries] of Object.entries(byRange)) {
      const cur = await getAudioNotesRange(studentId, key);
      await saveAudioNotesRange(studentId, key, { ...cur.entries, ...entries }, cur.v + 1, true);
    }
    delete m.data.audioNotes;
    await saveManifestLocal(studentId, m.data, m.serverTs, false);
  } catch (e) { console.warn('migrateLegacyAudioNotes', e); }
};

// ---------------- v1 COMPAT SHIMS (delete after migration) ----------------
export const getStudentData = async (studentId: string) => {
  const r = await getDB().executeSql(`SELECT canvasKey, data FROM student_data_cache WHERE studentId=?`, [studentId]);
  const blob: any = { bookmarks: {}, highlights: {}, drawings: {}, notes: {}, lastRead: null };
  for (let i = 0; i < r[0].rows.length; i++) {
    const row = r[0].rows.item(i);
    const d = JSON.parse(row.data);
    Object.assign(blob.highlights, d.highlights || {});
    Object.assign(blob.notes, d.notes || {});
    if (d.strokes && d.strokes.length > 0) blob.drawings[row.canvasKey] = { paths: d.strokes, updatedAt: new Date() };
  }
  const m = await getManifest(studentId);
  blob.bookmarks = m.data.bookmarks || {};
  blob.lastRead = m.data.lastRead || null;
  const ranges = await getAllAudioRanges(studentId);
  let audioNotes: any = {};
  for (const r of Object.values(ranges)) Object.assign(audioNotes, r.entries);
  blob.audioNotes = audioNotes;
  return blob;
};
export const saveStudentData = async (studentId: string, data: any) => {
  for (const [k, v] of Object.entries(data.drawings || {}) as Array<[string, any]>) {
    if (v && v.paths) {
      const cur = await getChunk(studentId, k);
      // merge so strokes never wipe co-located highlights/notes; drawings are
      // LAZY-SYNCED per 10-page range: keep the local cache write, never queue
      await saveChunk(studentId, k, { ...(cur?.data || { strokes: [], highlights: {}, notes: {} }), strokes: v.paths }, (cur?.v || 0) + 1, false);
    }
  }
  const m = await getManifest(studentId);
  let changed = false;
  if (JSON.stringify(m.data.bookmarks) !== JSON.stringify(data.bookmarks)) {
    m.data.bookmarks = data.bookmarks || m.data.bookmarks;
    changed = true;
  }
  if (JSON.stringify(m.data.lastRead) !== JSON.stringify(data.lastRead)) {
    m.data.lastRead = data.lastRead || m.data.lastRead;
    changed = true;
  }
  if (changed) {
    m.data.v = (m.data.v || 0) + 1;
    await saveManifestLocal(studentId, m.data);
  }
  return changed;   // true only when bookmarks/lastRead queued a manifest row — lets flushPendingSave count the badge exactly
};
export const addToSyncQueue = async (studentId: string, canvasKey: string) => {
  const db = getDB();
  await db.executeSql(
    `INSERT INTO sync_queue (studentId, canvasKey, synced, attempts) VALUES (?, ?, 0, 0) 
     ON CONFLICT(studentId, canvasKey) DO UPDATE SET synced=0`,
    [studentId, canvasKey]
  );
};
export const purgeLocalStudent = async (studentId: string) => {
  const db = getDB();
  await db.executeSql(`DELETE FROM student_data_cache WHERE studentId=?`, [studentId]);
  await db.executeSql(`DELETE FROM sync_queue WHERE studentId=?`, [studentId]);
  await db.executeSql(`DELETE FROM student_manifest_cache WHERE studentId=?`, [studentId]);
  await db.executeSql(`DELETE FROM sync_last_push WHERE studentId=?`, [studentId]);
  await db.executeSql(`DELETE FROM audio_notes_cache WHERE studentId=?`, [studentId]);
  // Also drop the student from the per-uid LIST cache — getStudents() is cache-first, so a
  // deleted student left in student_list_cache is what resurrects it in the Dashboard on the
  // next focus/sync. Tombstone (deletedStudentIds) guards the in-flight refresh race too.
  deletedStudentIds.add(studentId);
  try {
    const uid = auth().currentUser?.uid; if (!uid) return;
    const r = await db.executeSql(`SELECT students FROM student_list_cache WHERE uid = ?`, [uid]);
    if (r[0].rows.length > 0) {
      const list = JSON.parse(r[0].rows.item(0).students).filter((s: any) => s?.id !== studentId);
      await db.executeSql(`INSERT OR REPLACE INTO student_list_cache (uid, students, updatedAt) VALUES (?, ?, ?)`,
        [uid, JSON.stringify(list), new Date().toISOString()]);
    }
  } catch {}
};

// ---------------- student list cache (unchanged API) ----------------
// Tombstones: student ids deleted on THIS device this session. cacheStudentList filters them
// out, so an in-flight background refresh (snapshot taken before the delete) or a pull can never
// resurrect a deleted student into the list cache. In-memory only — the cache row itself is
// rewritten at purge time (purgeLocalStudent), so a restart can't resurrect either.
const deletedStudentIds = new Set<string>();

export const getCachedStudentList = async (): Promise<any[] | null> => {
  try {
    const uid = auth().currentUser?.uid; if (!uid) return null;
    const r = await getDB().executeSql(`SELECT students FROM student_list_cache WHERE uid = ?`, [uid]);
    if (r[0].rows.length === 0) return null;
    return JSON.parse(r[0].rows.item(0).students).filter((s: any) => !deletedStudentIds.has(s?.id));
  } catch { return null; }
};
export const cacheStudentList = async (students: any[]): Promise<void> => {
  try {
    const uid = auth().currentUser?.uid; if (!uid) return;
    const filtered = students.filter((s: any) => !deletedStudentIds.has(s?.id));
    await getDB().executeSql(`INSERT OR REPLACE INTO student_list_cache (uid, students, updatedAt) VALUES (?, ?, ?)`,
      [uid, JSON.stringify(filtered), new Date().toISOString()]);
  } catch {}
};

async function migrateV1IfNeeded(db: any) {
  try {
    let legacy = false;
    const r = await db.executeSql(`PRAGMA table_info(student_data_cache)`);
    for (let i = 0; i < r[0].rows.length; i++) if (r[0].rows.item(i).name === 'canvasKey') return; // already v2/v4
    if (r[0].rows.length === 0) return; // table doesn't exist yet
    
    // It's legacy. Rename and recreate
    await db.executeSql(`ALTER TABLE student_data_cache RENAME TO student_data_cache_v1`);
    await db.executeSql(`CREATE TABLE student_data_cache (
        studentId TEXT NOT NULL, canvasKey TEXT NOT NULL, data TEXT NOT NULL,
        v INTEGER DEFAULT 0, serverTs INTEGER DEFAULT 0,
        PRIMARY KEY (studentId, canvasKey))`);
    // we also need to wipe the legacy sync_queue and recreate it
    await db.executeSql(`DROP TABLE IF EXISTS sync_queue`);
  } catch (e) { console.warn('migrateV1IfNeeded', e); }
}

// ---------------- Layout Cache ----------------
// In-memory fast-path for the layout cache: MushafPageView reads its row on every mount, and on
// low-end devices the async SQLite hop (queued behind student-data writes and other page reads)
// is the visible delay. The reader warms a RANGE (±2 pages) with one query; subsequent mounts
// resolve synchronously from layoutCacheMem with zero DB traffic. The Mem LRU is small (cache
// rows are tiny) but bounded so a session of paging through the whole mushaf can't grow it
// unboundedly: evicts when > MAX_MEM_ENTRIES (simple FIFO by insertion order — Map semantics).
const MAX_MEM_ENTRIES = 900;
const layoutCacheMem = new Map<string, number[] | null>();
const memKey = (pageNumber: number, textStyle: string, headerVisible: boolean, fs: number, sparse: number, screenW: number) =>
  `${pageNumber}|${textStyle}|${headerVisible ? 1 : 0}|${fs}|${sparse}|${screenW}`;
const memStore = (key: string, value: number[] | null) => {
  layoutCacheMem.set(key, value);
  if (layoutCacheMem.size > MAX_MEM_ENTRIES) {
    const oldest = layoutCacheMem.keys().next().value;
    if (oldest !== undefined) layoutCacheMem.delete(oldest);
  }
};
/**
 * preloadPageLayoutCacheRange(first, last, ...keyParts) — one SQLite query warms every
 * page_layout_cache row in [first,last] matching the caller's exact key parts (textStyle,
 * headerVisible, fs, sparse, screenW) into the layoutCacheMem map, so the MushafPageView mounts
 * for those pages resolve their cache synchronously instead of queueing N separate DB reads.
 * CALLED BY: MushafPageView cache-load effect (warms pageNum ± 2 before the user swipes there).
 * NOTES: reads only; never writes. Rows with other key parts are ignored — each MushafPageView
 *   mount still falls back to a direct DB read if its own exact key is absent from the mem map.
 */
export const preloadPageLayoutCacheRange = async (
  first: number, last: number, textStyle: string, headerVisible: boolean,
  fs: number, sparse: number, screenW: number,
): Promise<void> => {
  try {
    const r = await getDB().executeSql(
      `SELECT pageNumber, headerVisible, fs, sparse, screenW, lines FROM page_layout_cache WHERE pageNumber>=? AND pageNumber<=? AND textStyle=? AND headerVisible=? AND fs=? AND sparse=? AND screenW=?`,
      [first, last, textStyle, headerVisible ? 1 : 0, fs, sparse, screenW]);
    for (let i = 0; i < r[0].rows.length; i++) {
      const row = r[0].rows.item(i);
      memStore(memKey(row.pageNumber, textStyle, !!row.headerVisible, row.fs, row.sparse, row.screenW), JSON.parse(row.lines));
    }
  } catch { /* best-effort */ }
};
export const getPageLayoutCache = async (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  fs: number, sparse: number, screenW: number,
): Promise<number[] | null> => {
  const key = memKey(pageNumber, textStyle, headerVisible, fs, sparse, screenW);
  const mem = layoutCacheMem.get(key);
  if (mem !== undefined) return mem;
  try {
    const r = await getDB().executeSql(
      `SELECT lines FROM page_layout_cache WHERE pageNumber=? AND textStyle=? AND headerVisible=? AND fs=? AND sparse=? AND screenW=?`,
      [pageNumber, textStyle, headerVisible ? 1 : 0, fs, sparse, screenW]);
    const parsed = (r && r[0].rows.length > 0) ? JSON.parse(r[0].rows.item(0).lines) : null;
    memStore(key, parsed);
    return parsed;
  } catch { /* cache is best-effort */ }
  return null;
};
export const savePageLayoutCache = async (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  fs: number, sparse: number, screenW: number, lines: number[],
) => {
  memStore(memKey(pageNumber, textStyle, headerVisible, fs, sparse, screenW), lines);
  try {
    await getDB().executeSql(
      `INSERT OR REPLACE INTO page_layout_cache (pageNumber, textStyle, headerVisible, fs, sparse, screenW, lines) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pageNumber, textStyle, headerVisible ? 1 : 0, fs, sparse, screenW, JSON.stringify(lines)]);
  } catch { /* best-effort */ }
};
export const clearPageLayoutCacheRange = async (from: number, to: number): Promise<void> => {
  for (const k of Array.from(layoutCacheMem.keys())) {
    const pg = parseInt(k.split('|')[0], 10);
    if (pg >= from && pg <= to) layoutCacheMem.delete(k);
  }
  try {
    await getDB().executeSql(
      `DELETE FROM page_layout_cache WHERE pageNumber >= ? AND pageNumber <= ?`,
      [from, to],
    );
  } catch {
  }
};
