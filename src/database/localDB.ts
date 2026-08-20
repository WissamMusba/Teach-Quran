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

  // WAL pragmas stay OUTSIDE the batch transaction below — SQLite refuses a journal_mode
  // change from within a transaction ("cannot change into wal mode from within a transaction").
  await dbInstance.executeSql(`PRAGMA journal_mode=WAL;`);
  await dbInstance.executeSql(`PRAGMA synchronous=NORMAL;`);
  await dbInstance.executeSql(`PRAGMA busy_timeout=3000;`);   // parallel pull/push transactions wait up to 3s instead of failing with SQLITE_BUSY

  // ============================================================
  // [PERF-CHANGE-6] — REVERTIBLE OPTIMIZATION (safe batched startup).
  // ALL unconditional CREATE TABLE / CREATE INDEX statements run in ONE
  // transaction instead of ~15 separate awaited round-trips (faster splash
  // on slow storage). Semantics are identical: statement order is preserved
  // and every statement is idempotent (IF NOT EXISTS).
  // REVERSE: delete this try/catch block and restore the original sequential
  // statements, available verbatim in git: `git diff` or the v87 release
  // (commit bed0baf) of this file, lines 21-46.
  // ============================================================
  try {
    await dbInstance.transaction((tx: any) => {
      // Existing tables
      tx.executeSql(`CREATE TABLE IF NOT EXISTS surahs (id INTEGER PRIMARY KEY, name TEXT, englishName TEXT, verses INTEGER)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS verses (id INTEGER PRIMARY KEY AUTOINCREMENT, surahId INTEGER, verseNumber INTEGER, textArabic TEXT, textIndopak TEXT, textTranslation TEXT, page INTEGER)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages_indopak (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS student_list_cache (uid TEXT PRIMARY KEY, students TEXT NOT NULL, updatedAt TEXT NOT NULL)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS page_layout_cache (
        pageNumber INTEGER NOT NULL, textStyle TEXT NOT NULL, headerVisible INTEGER NOT NULL,
        fs INTEGER NOT NULL, sparse INTEGER NOT NULL, screenW INTEGER NOT NULL,
        lines TEXT NOT NULL,
        PRIMARY KEY (pageNumber, textStyle, headerVisible, fs, sparse, screenW))`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS frame_cache (key TEXT PRIMARY KEY, w INTEGER NOT NULL, h INTEGER NOT NULL)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
      tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId)`);
      tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_page ON verses(page)`);
      tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah_verse ON verses(surahId, verseNumber)`);
      // New V4 Tables
      tx.executeSql(`CREATE TABLE IF NOT EXISTS student_data_cache (
          studentId TEXT NOT NULL, canvasKey TEXT NOT NULL, data TEXT NOT NULL,
          v INTEGER DEFAULT 0, serverTs INTEGER DEFAULT 0,
          PRIMARY KEY (studentId, canvasKey))`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS student_manifest_cache (
          studentId TEXT PRIMARY KEY, manifest TEXT NOT NULL, serverTs INTEGER DEFAULT 0)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sync_queue (
          studentId TEXT NOT NULL, canvasKey TEXT NOT NULL,
          synced INTEGER DEFAULT 0, attempts INTEGER DEFAULT 0,
          PRIMARY KEY (studentId, canvasKey))`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sync_last_push (
          studentId TEXT PRIMARY KEY, pushedAt INTEGER NOT NULL)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sync_last_pull (
          studentId TEXT PRIMARY KEY, pulledAt INTEGER NOT NULL)`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS audio_notes_cache (
          studentId TEXT NOT NULL, rangeKey TEXT NOT NULL, entries TEXT NOT NULL,
          v INTEGER DEFAULT 0,
          PRIMARY KEY (studentId, rangeKey))`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS local_student_state (
          sid TEXT PRIMARY KEY, lastPageSeen TEXT, updatedAt TEXT NOT NULL)`);
    });
  } catch (e) {
    // Safety net: if the batched transaction ever fails wholesale (e.g. disk
    // full mid-batch), fall back to the original one-statement-at-a-time path
    // so a partial failure is still repaired statement by statement.
    console.warn('initDatabase: batched setup failed, retrying sequentially', e);
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
    await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS frame_cache (key TEXT PRIMARY KEY, w INTEGER NOT NULL, h INTEGER NOT NULL)`);
    await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
    await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId)`);
    await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_page ON verses(page)`);
    await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah_verse ON verses(surahId, verseNumber)`);
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
    await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS local_student_state (
        sid TEXT PRIMARY KEY, lastPageSeen TEXT, updatedAt TEXT NOT NULL)`);
  }

  const r = await dbInstance.executeSql(`SELECT value FROM meta WHERE key='layoutVer'`);
  const ver = r && r[0] && r[0].rows && r[0].rows.length ? parseInt(r[0].rows.item(0).value, 10) : 0;
  // layoutVer 4: v4 rows bundle the one-shot vertical-fit payload ({ lines, fit }) in the
  // lines TEXT column. v3 rows (plain number[]) lack the fit, so they are wiped ONCE here —
  // a hit mount must never replay a row without its paired fit (see MushafPageView replayFit).
  // layoutVer 5 (v93): the page cells gained a 24px bottom margin band (in-frame bottom pills),
  // shrinking the frame box by 24px — stale v4 fits replay against a boxH mismatch via the
  // live-fit guard but never re-persist, degrading every mount, so wipe once to re-measure.
  if (ver < 5) {
    await dbInstance.executeSql(`DELETE FROM page_layout_cache`);
    await dbInstance.executeSql(`INSERT OR REPLACE INTO meta(key,value) VALUES('layoutVer','5')`);
  }

  // Migrate V1 to V2 schema if needed
  await migrateV1IfNeeded(dbInstance);
};

export const getDB = () => dbInstance;

export const getFrameBox = async (key: string): Promise<{ w: number; h: number } | null> => {
  try {
    const r = await getDB().executeSql(`SELECT w, h FROM frame_cache WHERE key=?`, [key]);
    if (r && r[0] && r[0].rows && r[0].rows.length) {
      const row = r[0].rows.item(0);
      return { w: row.w, h: row.h };
    }
  } catch {}
  return null;
};
export const saveFrameBox = async (key: string, w: number, h: number) => {
  try {
    await getDB().executeSql(`INSERT OR REPLACE INTO frame_cache (key, w, h) VALUES (?,?,?)`, [key, w, h]);
  } catch {}
};

// ============================================================
// [PERF-CHANGE-1] — REVERTIBLE OPTIMIZATION (bundled indopak mushaf moved
// from a 4.5 MB JSON require() into a shipped SQLite asset).
//
// The shipped asset lives at android/app/src/main/assets/www/indopak_pages.db
// — the www/ subfolder is REQUIRED: createFromLocation: 1 makes the plugin
// look it up at "www/" + dbName inside the APK assets
// (platforms/android/.../SQLitePlugin.java, openDatabase() — the
// assetFilePath == "1" branch). On FIRST open the plugin copies
// www/indopak_pages.db from the APK assets into the app's databases/ dir
// and opens it; later opens hit the stored copy directly. Reads are served
// from that connection via getIndopakPageDataFromAsset().
// disableIndopakAssetDB() shuts the connection mid-process if a fallback
// SQLite path wins the race on devices where the asset copy failed.
//
// KNOWN LIMITATION OF THE FALLBACK: the legacy mushaf_pages_indopak table is
// never written since v75 (importIndopakPages was removed), so if the asset
// copy fails the indopak reader only gets empty pages — the self-check probe
// below surfaces that as a loud 'indopak asset empty/setup failed' log line
// instead of silently spinning forever.
//
// REVERSE (full revert checklist, all in one go):
//   1. Delete this block + the exported functions below it.
//   2. src/database/quranData.ts: restore the old body of getIndopakPageIndex
//      (`Promise.resolve().then(() => require('../assets/data/indopak_pages.json') ...fold...)`)
//      and plain `index[pageNum] || null` in getIndopakPageFromBundle —
//      both hunks are marked [PERF-CHANGE-1] and visible in
//      `git diff HEAD` (compare against release v87, commit bed0baf).
//   3. Restore src/assets/data/indopak_pages.json (git checkout of that path
//      from commit bed0baf) and delete android/app/src/main/assets/www/
//      indopak_pages.db + scripts/build_indopak_db.mjs.
// ============================================================
// indopakAssetDb: lazily opened asset-backed connection, null until first open.
// indopakAssetPromise: single-flight open (concurrent first reads share it).
// indopakAssetDisabled: set true forever for this process when the asset path
//   fails (copy failed / corrupt asset) — asset reads then fast-return null
//   and getMushafPageData rides its legacy chain (mushaf_pages_indopak table).
//   Runtime flag only — nothing persisted.
let indopakAssetDb: any = null;
let indopakAssetPromise: Promise<any> | null = null;
let indopakAssetDisabled = false;

const ensureIndopakAsset = async (): Promise<any> => {
  if (indopakAssetDb) return indopakAssetDb;
  if (indopakAssetDisabled) return null;
  if (!indopakAssetPromise) {
    indopakAssetPromise = (async () => {
      try {
        // createFromLocation: 1 → the plugin resolves "www/" + name inside
        // the APK assets (this is why the file ships under assets/www/) and
        // copies it into the app databases dir on first open, then opens it.
        // readOnly is passed for intent; the plugin's import branch opens
        // the copied file READWRITE, which is fine (we never write to it).
        indopakAssetDb = await SQLite.openDatabase(
          { name: 'indopak_pages.db', readOnly: true, createFromLocation: 1 },
          () => {},
          (openErr: any) => { console.warn('indopak asset open failed', openErr); },
        );
        // Self-check: force any hidden problem (corrupt copy, wrong schema) to
        // surface NOW with a cheap row-count probe instead of silently
        // returning empty pages later.
        const r = await indopakAssetDb.executeSql(`SELECT COUNT(*) AS c FROM indopak_pages`);
        const c = r && r[0] && r[0].rows && r[0].rows.length ? r[0].rows.item(0).c : 0;
        if (!c) { console.warn('indopak asset empty — disabling asset path'); try { await indopakAssetDb.close(); } catch {} indopakAssetDb = null; }
        return indopakAssetDb;
      } catch (e) {
        console.warn('indopak asset setup failed', e);
        return null;
      }
    })();
  }
  return indopakAssetPromise;
};

/**
 * Read one indopak mushaf page from the shipped read-only asset DB.
 * Returns the parsed page object, or null when the asset path is
 * unavailable/failed/not-found (caller falls through to its legacy chain).
 * Failure mode: a broken asset disables this path for the PROCESS via
 * indopakAssetDisabled after the first null — all later callers take the
 * fast-null shortcut instead of re-probing.
 */
export const getIndopakPageDataFromAsset = async (pageNum: number): Promise<any | null> => {
  if (indopakAssetDisabled) return null;
  try {
    const db = await ensureIndopakAsset();
    if (!db) { indopakAssetDisabled = true; return null; }
    const r = await db.executeSql(`SELECT data FROM indopak_pages WHERE pageNumber=?`, [pageNum]);
    if (r && r[0] && r[0].rows && r[0].rows.length) {
      const data = r[0].rows.item(0).data;
      if (data) return JSON.parse(data);
    }
  } catch (e) {
    console.warn('getIndopakPageDataFromAsset', pageNum, e);
    indopakAssetDisabled = true;
  }
  return null;
};

/**
 * Called by quranData's FALLBACK import after it back-fills
 * mushaf_pages_indopak in SQLite: shuts the read-only asset connection and
 * disables the asset path for the process, so every subsequent indopak read
 * is served from the same SQLite indopak path the pre-change app used.
 * Null-safe (no-op if the asset DB was never opened / already disabled).
 */
export const disableIndopakAssetDB = () => {
  indopakAssetDisabled = true;
  if (indopakAssetDb) {
    try { indopakAssetDb.close(); } catch {}
    indopakAssetDb = null;
  }
};
// ============================================================
// END [PERF-CHANGE-1]
// ============================================================

// ---------------- canvas CRUD (SQLite is the single source of truth) --------
export const getChunk = async (studentId: string, canvasKey: string) => {
  const r = await getDB().executeSql(`SELECT data, v FROM student_data_cache WHERE studentId=? AND canvasKey=?`, [studentId, canvasKey]);
  if (r && r[0].rows.length > 0) { const row = r[0].rows.item(0); return { data: JSON.parse(row.data), v: row.v }; }
  return null;
};

// Module-level, session-lived "this device wrote drawing strokes" flag — strokes are saved with
// queue=false (never in sync_queue), so the sync layer can't tell whether the device has strokes
// to flush without scanning the whole student_data_cache table + JSON.parsing every row. The flag
// is set on ANY chunk save carrying a non-empty strokes array (local draws and pull-side writes)
// and cleared after a clean full push, so pushAllDrawings' expensive sweep only runs when there
// is something to flush.
let strokesDirtySession = false;
export const markStrokesDirtySession = () => { strokesDirtySession = true; };
export const clearStrokesDirtySession = () => { strokesDirtySession = false; };
export const hasStrokesDirtySession = () => strokesDirtySession;

// Module-level, session-lived snapshot of each student's drawings map as of the last
// SUCCESSFUL saveStudentData flush, stored as a canonical JSON string. The next flush
// diffs against it and rewrites ONLY changed drawing chunks — untouched chunks keep
// their exact stored v (no phony version inflation, far fewer SQLite writes).
let lastPersistedDrawings: Record<string, string> = {};
/**
 * canonicalize — order-independent JSON serialization: plain-object keys are sorted
 * recursively (arrays keep their order; undefined members are dropped, matching JSON's
 * treatment of missing keys). Two structurally equal objects always compare equal.
 */
const canonicalize = (obj: any): string => {
  if (obj === undefined) return 'null';
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalize).join(',')}]`;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
};

export const saveChunk = async (studentId: string, canvasKey: string, data: any, v: number, queue = true) => {
  if (data?.strokes?.length) markStrokesDirtySession();
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

/**
 * WHAT: Every canvas that actually holds local drawing strokes, grouped by student
 *   — the "push EVERYTHING" scan for a full sync. Reads the whole student_data_cache
 *   table once, JSON.parses each row, and keeps only rows whose data has a non-empty
 *   `strokes` array (page_N / surah_N canvases).
 * WHY: drawings are stored with queue=false (never enqueued), so they'd otherwise only
 *   be pushed on the active-save path (pushDrawings) — a drawing saved while offline
 *   never reaches Firestore. pushAllDirty calls this on every full sync (30-min
 *   interval + AppState background) so stray strokes are always flushed upstream.
 * NOTES: reads only; raw strokes are returned unwrapped; the caller decides grouping.
 */
export const getAllCanvasesWithStrokesByStudent = async (): Promise<Record<string, { canvasKey: string; strokes: any[] }[]>> => {
  const r = await getDB().executeSql(`SELECT studentId, canvasKey, data FROM student_data_cache`);
  const groups: Record<string, { canvasKey: string; strokes: any[] }[]> = {};
  for (let i = 0; i < r[0].rows.length; i++) {
    const row = r[0].rows.item(i);
    let d: any = null;
    try { d = JSON.parse(row.data); } catch { /* corrupt row — skip, never abort the sweep */ }
    if (d?.strokes && d.strokes.length) {
      (groups[row.studentId] = groups[row.studentId] || []).push({ canvasKey: row.canvasKey, strokes: d.strokes });
    }
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
 *   annotation chunks, the cloud manifest (bookmarks + lastRead LWW-merged), any
 *   audio-note ranges, and the pull watermark — in ONE SQLite transaction.
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
/**
 * WHAT: Batched page lookup for MANY (surah, verse) pairs in ONE SQLite query —
 *   returns a Record keyed with the reader's `surah_verse` convention so callers
 *   can index it directly. Compare getVersePageDB (one SELECT per pair).
 * WHY: BookmarksScreen resolves one page per bookmarked verse; with many
 *   bookmarks the per-card getVersePageDB calls serialize on the shared SQLite
 *   connection (queued behind student-data writes and other page reads), so
 *   cards sit on "…" until every individual query has drained. A single OR-query
 *   resolves every card after one round-trip — and is far less bridge traffic.
 * NOTES: results are batched in chunks of 200 pairs to stay far under SQLite's
 *   variable limit for huge bookmark lists. Pairs that aren't in the verses
 *   table are simply ABSENT from the record (callers keep their "…" placeholder).
 *   Best-effort: on error returns whatever was found (possibly {}).
 */
const VERSE_PAGE_BATCH = 200;
export const getVersePagesDB = async (entries: [number, number][]): Promise<Record<string, number>> => {
  const out: Record<string, number> = {};
  for (let i = 0; i < entries.length; i += VERSE_PAGE_BATCH) {
    const slice = entries.slice(i, i + VERSE_PAGE_BATCH);
    if (!slice.length) continue;
    const clauses: string[] = [];
    const params: number[] = [];
    for (const [surah, verse] of slice) {
      clauses.push('(surahId=? AND verseNumber=?)');
      params.push(surah, verse);
    }
    try {
      const r = await getDB().executeSql(`SELECT surahId, verseNumber, page FROM verses WHERE ${clauses.join(' OR ')}`, params);
      for (let rI = 0; rI < r[0].rows.length; rI++) {
        const row = r[0].rows.item(rI);
        out[`${row.surahId}_${row.verseNumber}`] = row.page;
      }
    } catch { /* best-effort: caller keeps '…' placeholders */ }
  }
  return out;
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
  const drawings = data.drawings || {};
  const baseline = lastPersistedDrawings[studentId];
  const canonical = canonicalize(drawings);
  if (baseline === undefined) {
    // First saveStudentData call for this student this session: rewrite every drawing
    // chunk (session bootstrap) — parity with the historical full rewrite, one time only.
    for (const [k, v] of Object.entries(drawings) as Array<[string, any]>) {
      if (v && v.paths) {
        const cur = await getChunk(studentId, k);
        // merge so strokes never wipe co-located highlights/notes; drawings are
        // LAZY-SYNCED per 10-page range: keep the local cache write, never queue
        await saveChunk(studentId, k, { ...(cur?.data || { strokes: [], highlights: {}, notes: {} }), strokes: v.paths }, (cur?.v || 0) + 1, false);
      }
    }
  } else if (canonical !== baseline) {
    // Snapshot diff: rewrite only chunks whose content changed since the last persisted
    // flush; unchanged keys get no read, no write, no v bump.
    const lastDrawings = JSON.parse(baseline);
    for (const [k, v] of Object.entries(drawings) as Array<[string, any]>) {
      if (v && v.paths && canonicalize(v) !== canonicalize(lastDrawings[k])) {
        const cur = await getChunk(studentId, k);
        // merge so strokes never wipe co-located highlights/notes; drawings are
        // LAZY-SYNCED per 10-page range: keep the local cache write, never queue
        await saveChunk(studentId, k, { ...(cur?.data || { strokes: [], highlights: {}, notes: {} }), strokes: v.paths }, (cur?.v || 0) + 1, false);
      }
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
  // Persist the snapshot only after every write above succeeded: a mid-flush throw
  // leaves the baseline stale so the next flush retries every diff key.
  lastPersistedDrawings[studentId] = canonical;
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

/**
 * LOCAL-ONLY per-student "last page VIEWED" memory (StudentHub RESUME source).
 * Deliberately NOT part of any manifest/sync path — the cloud stays clean.
 */
export const saveLastPageSeenLocal = async (sid: string, seen: { surah: number; verse: number; at: string }): Promise<void> => {
  try {
    await getDB().executeSql(`INSERT OR REPLACE INTO local_student_state (sid, lastPageSeen, updatedAt) VALUES (?, ?, ?)`,
      [sid, JSON.stringify(seen), new Date().toISOString()]);
  } catch {}
};
export const getLastPageSeenLocal = async (sid: string): Promise<{ surah: number; verse: number; at: string } | null> => {
  try {
    const r = await getDB().executeSql(`SELECT lastPageSeen FROM local_student_state WHERE sid = ?`, [sid]);
    if (r && r[0] && r[0].rows && r[0].rows.length) {
      const v = JSON.parse(r[0].rows.item(0).lastPageSeen);
      if (v && Number(v.surah) > 0 && Number(v.verse) > 0) {
        return { surah: Number(v.surah), verse: Number(v.verse), at: String(v.at || '') };
      }
    }
  } catch {}
  return null;
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
// Rows store NORMALIZED line-width sums (px divided by the page's rendered base font size), so
// they are FONT-SIZE-INDEPENDENT: the DB key carries fs=0 always, and any app font-size change
// (settings, header toggle, release updates) reuses the same row — each page is measured ONCE
// per device and replayed forever. layoutVer in meta is bumped to wipe rows when the stored
// FORMAT changes (e.g. v2: fs-keyed raw widths -> v3: normalized units -> v4: { lines, fit }).
// V4 FORMAT: the lines TEXT column now stores JSON { lines: number[], fit: {boxH,
// headerVisible, pitchScale, fontScale} | null } — the width sums PLUS the one-shot vertical-fit
// scale pair they pair with (the fit frozen at the same render that froze the normalization
// base). A cache-hit mount replays BOTH synchronously: the sums multiply back by the base size
// x the SAME replayed fontScale, so the page is pixel-identical to its first measurement and
// needs no innerH measurement, no font gate and no ActivityIndicator.
const MAX_MEM_ENTRIES = 900;
export type PageLayoutCacheFit = { boxH: number; headerVisible: boolean; pitchScale: number; fontScale: number };
export type PageLayoutCacheRow = { lines: number[]; fit: PageLayoutCacheFit | null };
/**
 * parseLayoutRow — JSON.parse of the lines TEXT column into a PageLayoutCacheRow. Defensive
 * Array.isArray fallback: a legacy plain-number[] row (impossible after the layoutVer 4 wipe,
 * but harmless) normalizes to { lines, fit: null } — MushafPageView then falls back to the live
 * fit math instead of crashing. Never throws to callers (cache is best-effort).
 */
const parseLayoutRow = (raw: string): PageLayoutCacheRow => {
  const p = JSON.parse(raw);
  return Array.isArray(p) ? { lines: p, fit: null } : p;
};
const layoutCacheMem = new Map<string, PageLayoutCacheRow | null>();
const memKey = (pageNumber: number, textStyle: string, headerVisible: boolean, sparse: number, screenW: number) =>
  `${pageNumber}|${textStyle}|${headerVisible ? 1 : 0}|${sparse}|${screenW}`;
const memStore = (key: string, value: PageLayoutCacheRow | null) => {
  layoutCacheMem.set(key, value);
  if (layoutCacheMem.size > MAX_MEM_ENTRIES) {
    const oldest = layoutCacheMem.keys().next().value;
    if (oldest !== undefined) layoutCacheMem.delete(oldest);
  }
};
/**
 * preloadPageLayoutCacheRange(first, last, ...keyParts) — one SQLite query warms every
 * page_layout_cache row in [first,last] matching the caller's exact key parts (textStyle,
 * headerVisible, sparse, screenW) into the layoutCacheMem map, so the MushafPageView mounts
 * for those pages resolve their cache synchronously instead of queueing N separate DB reads.
 * CALLED BY: MushafPageView cache-load effect (warms pageNum ± 3/7 before the user swipes there).
 * NOTES: reads only; never writes. Rows with other key parts are ignored — each MushafPageView
 *   mount still falls back to a direct DB read if its own exact key is absent from the mem map.
 */
export const preloadPageLayoutCacheRange = async (
  first: number, last: number, textStyle: string, headerVisible: boolean,
  sparse: number, screenW: number,
): Promise<void> => {
  try {
    const r = await getDB().executeSql(
      `SELECT pageNumber, headerVisible, sparse, screenW, lines FROM page_layout_cache WHERE pageNumber>=? AND pageNumber<=? AND textStyle=? AND headerVisible=? AND fs=0 AND sparse=? AND screenW=?`,
      [first, last, textStyle, headerVisible ? 1 : 0, sparse, screenW]);
    for (let i = 0; i < r[0].rows.length; i++) {
      const row = r[0].rows.item(i);
      memStore(memKey(row.pageNumber, textStyle, !!row.headerVisible, row.sparse, row.screenW), parseLayoutRow(row.lines));
    }
  } catch { /* best-effort */ }
};
/**
 * getLayoutCacheSync — SYNCHRONOUS layoutCacheMem lookup (no SQLite, no promise). Returns the
 * cached row ({ lines, fit }) for the exact key, or undefined when the key is not in memory
 * (caller must fall back to the async getPageLayoutCache DB read). Used by MushafPageView's
 * cache-load effect so a warm cache-hit mount resolves BEFORE paint (zero DB traffic, zero
 * skeleton flash) and replays its one-shot vertical fit synchronously.
 */
export const getLayoutCacheSync = (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  sparse: number, screenW: number,
): PageLayoutCacheRow | null | undefined => layoutCacheMem.get(memKey(pageNumber, textStyle, headerVisible, sparse, screenW));

export const getPageLayoutCache = async (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  sparse: number, screenW: number,
): Promise<PageLayoutCacheRow | null> => {
  const key = memKey(pageNumber, textStyle, headerVisible, sparse, screenW);
  const mem = layoutCacheMem.get(key);
  if (mem !== undefined) return mem;
  try {
    const r = await getDB().executeSql(
      `SELECT lines FROM page_layout_cache WHERE pageNumber=? AND textStyle=? AND headerVisible=? AND fs=0 AND sparse=? AND screenW=?`,
      [pageNumber, textStyle, headerVisible ? 1 : 0, sparse, screenW]);
    const parsed = (r && r[0].rows.length > 0) ? parseLayoutRow(r[0].rows.item(0).lines) : null;
    memStore(key, parsed);
    return parsed;
  } catch { /* cache is best-effort */ }
  return null;
};
/**
 * savePageLayoutCache — persists a full page_layout_cache ROW ({ lines, fit }) both to the
 * in-memory fast path and to SQLite (lines TEXT column, fs column always 0 for normalized
 * sums). MushafPageView's measure pass hands over the sums AND the vertical-fit scale pair the
 * sums were normalized with, so the next mount replays both instead of re-measuring.
 */
export const savePageLayoutCache = async (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  sparse: number, screenW: number, row: PageLayoutCacheRow,
) => {
  memStore(memKey(pageNumber, textStyle, headerVisible, sparse, screenW), row);
  try {
    await getDB().executeSql(
      `INSERT OR REPLACE INTO page_layout_cache (pageNumber, textStyle, headerVisible, fs, sparse, screenW, lines) VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [pageNumber, textStyle, headerVisible ? 1 : 0, sparse, screenW, JSON.stringify(row)]);
  } catch { /* best-effort */ }
};
/**
 * savePageLayoutCacheMemOnly — layoutCacheMem write WITHOUT the SQLite INSERT (row payload
 * identical to savePageLayoutCache). Used by the hidden pre-measure slot (P0-C): a
 * background-measured row must resolve synchronously for every VISIBLE mount this session, but
 * must never queue a write behind the reader's own connection traffic. The row lands in SQLite
 * the next time a visible page measures it (handleWordMeasured -> savePageLayoutCache) or is
 * re-warmed after an app restart.
 */
export const savePageLayoutCacheMemOnly = (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  sparse: number, screenW: number, row: PageLayoutCacheRow,
) => {
  memStore(memKey(pageNumber, textStyle, headerVisible, sparse, screenW), row);
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
