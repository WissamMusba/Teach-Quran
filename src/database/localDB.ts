/**
 * FILE: src/database/localDB.ts
 * ROLE: SQLite layer: local source of truth for students, mushaf pages, and
 *       the sync queue. Every table and accessor lives here.
 * DEPENDS ON: react-native-sqlite-storage (driver, promise mode),
 *             @react-native-firebase/auth (current user uid for the per-user
 *             student_list_cache key)
 * USED BY: src/api/sync.ts, src/api/student.ts, src/database/quranData.ts,
 *          src/screens/QuranViewScreen.tsx, src/screens/DashboardScreen.tsx,
 *          src/components/quran/MushafPageView.tsx, src/utils/audioPlayback.ts
 */
import SQLite from 'react-native-sqlite-storage';
import auth from '@react-native-firebase/auth';
SQLite.enablePromise(true);
let dbInstance: any = null;

/**
 * WHAT: Idempotent one-time DB bootstrap: opens quran.db (WAL mode) and creates
 *       every table, the sync_queue dedup + UNIQUE index, and the verses indexes.
 * FLOW: 1) Guard: if dbInstance set, return (module-level singleton).
 *       2) SQLite.openDatabase('quran.db', location 'default').
 *       3) PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL.
 *       4) CREATE TABLE IF NOT EXISTS for all 8 tables (in order below).
 *       5) Legacy cleanup: DELETE sync_queue rows keeping the OLDEST row per
 *          student (dedup of pre-index multi-row queues).
 *       6) CREATE UNIQUE INDEX idx_sync_queue_student — one queue row per student.
 *       7) CREATE INDEX idx_verses_surah / idx_verses_page.
 * CALLS: SQLite.openDatabase, executeSql (native)
 * CALLED BY: downloadAndCacheQuran (src/database/quranData.ts) — the ONLY caller
 *            in src/. DB init happens lazily on first Quran download, i.e.
 *            through SplashScreen.tsx.
 * AFFECTS: ALL tables. Nothing reads/writes SQLite before this runs; every other
 *          helper (getDB()-based) assumes it already completed.
 * NOTES: The dedup DELETE runs on EVERY app start, not once. With the UNIQUE
 *        index + INSERT OR REPLACE flow (max 1 row/student) it is a no-op on
 *        fresh data, but on legacy multi-row queues it keeps MIN(id) = the
 *        OLDEST row: if the oldest is synced=1 and a newer row is synced=0,
 *        the dirty row is deleted and the student stops syncing.
 *        No `PRAGMA foreign_keys`; verses.surahId has no FK constraint (surahs
 *        and verses are only linked by convention).
 */
export const initDatabase = async () => {
  if (dbInstance) return;
  dbInstance = await SQLite.openDatabase({ name: 'quran.db', location: 'default' });
  
  await dbInstance.executeSql(`PRAGMA journal_mode=WAL;`);
  await dbInstance.executeSql(`PRAGMA synchronous=NORMAL;`);
  
  // surahs: master list of the 114 surahs (id, name, englishName, verse count)
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS surahs (id INTEGER PRIMARY KEY, name TEXT, englishName TEXT, verses INTEGER)`);
  // verses: all 6236 ayahs with Arabic/Indopak/translation text and mushaf page number
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS verses (id INTEGER PRIMARY KEY AUTOINCREMENT, surahId INTEGER, verseNumber INTEGER, textArabic TEXT, textIndopak TEXT, textTranslation TEXT, page INTEGER)`);
  // student_data_cache: student blobs — studentId PK + one JSON data column (local source of truth)
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS student_data_cache (studentId TEXT PRIMARY KEY, data TEXT)`);
  // sync_queue: dirty-flag queue — one row per dirty student; data column is ALWAYS '{}', the real payload lives in student_data_cache
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, studentId TEXT, data TEXT, synced BOOLEAN DEFAULT 0)`);
  // mushaf_pages: cached mushaf page JSON (standard Uthmani text)
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
  // mushaf_pages_indopak: cached mushaf page JSON (Indopak text)
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages_indopak (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
  // student_list_cache: per-uid Firestore student-list mirror (uid PK, students JSON, updatedAt timestamp)
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS student_list_cache (uid TEXT PRIMARY KEY, students TEXT NOT NULL, updatedAt TEXT NOT NULL)`);
  // page_layout_cache: cached per-line word-width sums; composite PK = 6-part key (pageNumber, textStyle, headerVisible, fs, sparse, screenW)
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS page_layout_cache (
    pageNumber INTEGER NOT NULL, textStyle TEXT NOT NULL, headerVisible INTEGER NOT NULL,
    fs INTEGER NOT NULL, sparse INTEGER NOT NULL, screenW INTEGER NOT NULL,
    lines TEXT NOT NULL,
    PRIMARY KEY (pageNumber, textStyle, headerVisible, fs, sparse, screenW))`);

  // dedup DELETE: collapse legacy multi-row queues — keeps the OLDEST row per student
  await dbInstance.executeSql(`DELETE FROM sync_queue WHERE id NOT IN (SELECT MIN(id) FROM sync_queue GROUP BY studentId)`);
  // UNIQUE index: enforces one queue row per student, matches the INSERT OR REPLACE semantics of persistStudentData
  await dbInstance.executeSql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_student ON sync_queue (studentId)`);
  // verses indexes: speed up getVersePage (surahId) and page-based lookups (page)
  await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId)`);
  await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_page ON verses(page)`);
};

/**
 * WHAT: Returns the singleton dbInstance; callers use it for ad-hoc SQL.
 * CALLS: none (accessor)
 * CALLED BY: quranData.ts (verse/page lookups), audioPlayback.ts:172
 *            (buildEstimatedTimeline reads verses.textArabic lengths), and
 *            every localDB helper internally.
 * AFFECTS: none
 * NOTES: Returns null if initDatabase never ran — no guard. Since the only
 *        initDatabase caller is downloadAndCacheQuran (splash flow), any screen
 *        that touches SQLite before splash completes would crash on null.
 */
export const getDB = () => dbInstance;

/**
 * WHAT: Read one student's entire JSON blob from student_data_cache.
 * FLOW: SELECT data FROM student_data_cache WHERE studentId=? -> JSON.parse,
 *       else null.
 * CALLS: getDB().executeSql
 * CALLED BY: sync.ts:23 (upload source for processSyncQueue),
 *            QuranViewScreen.tsx:293 (hydrate Redux studentSlice on select)
 * AFFECTS: Feeds studentSlice.studentData -> every screen that renders
 *          highlights/bookmarks/notes/drawings (QuranView, Mistakes, Notes,
 *          Bookmarks).
 * NOTES: JSON.parse on every read — 400KB-1.3MB blob parse per student switch.
 *        [v1] single blob column. [v4] replaced by per-canvas rows
 *        (student_data_cache: studentId+canvasKey).
 */
export const getStudentData = async (studentId: string) => {
  const res = await getDB().executeSql(`SELECT data FROM student_data_cache WHERE studentId=?`, [studentId]);
  if (res && res.length > 0 && res[0].rows.length > 0) return JSON.parse(res[0].rows.item(0).data);
  return null;
};

/**
 * WHAT: Atomic SQLite transaction: upsert student blob + insert/replace a dirty
 *       sync_queue row (data column '{}' — payload lives in the blob row).
 * FLOW: 1) transaction -> INSERT OR REPLACE student_data_cache.
 *       2) INSERT OR REPLACE sync_queue(studentId, '{}', synced=0).
 * CALLS: getDB().transaction
 * CALLED BY: saveStudentData:48, addToSyncQueue:52 (pure delegations)
 * AFFECTS: student_data_cache + sync_queue rows; making a student "dirty" is
 *          what processSyncQueue() later picks up.
 * NOTES: sync_queue.data is ALWAYS '{}' — the real payload is re-read from
 *        student_data_cache at push time. Deleting one table without the other
 *        breaks the pipeline.
 */
const persistStudentData = async (studentId: string, data: any) => {
  await getDB().transaction((tx: any) => {
    tx.executeSql(`INSERT OR REPLACE INTO student_data_cache (studentId, data) VALUES (?, ?)`, [studentId, JSON.stringify(data)]);
    tx.executeSql(`INSERT OR REPLACE INTO sync_queue (studentId, data, synced) VALUES (?, '{}', 0)`, [studentId]);
  });
};

/**
 * WHAT: Public alias for persistStudentData. Called on every student edit.
 * CALLS: persistStudentData (delegation)
 * CALLED BY: QuranViewScreen.tsx:295 (create-if-absent after hydrate),
 *            QuranViewScreen.tsx:327 (flushPendingSave, debounced 400ms)
 * AFFECTS: Marks student dirty -> next sync trigger pushes.
 * NOTES: [v4] signature changes to per-canvas saveChunk.
 */
export const saveStudentData = async (studentId: string, data: any) => {
  await persistStudentData(studentId, data);
};

/**
 * WHAT: Public alias for persistStudentData — v1 compat name.
 * CALLS: persistStudentData (delegation)
 * CALLED BY: QuranViewScreen.tsx:327 (immediately after saveStudentData)
 * AFFECTS: Same as saveStudentData (it is the same call).
 * NOTES: v1 redundancy kept for API stability; [v4] becomes a no-op.
 */
export const addToSyncQueue = async (studentId: string, data: any) => {
  await persistStudentData(studentId, data);
};

/**
 * WHAT: Legacy row-level queue read: all sync_queue rows with synced=0.
 * FLOW: SELECT * FROM sync_queue WHERE synced=0 -> rows as objects.
 * CALLS: getDB().executeSql
 * CALLED BY: NOTHING in src/ today (kept for compat; safe to delete).
 * AFFECTS: none (read)
 * NOTES: Superseded by getPendingSyncStudents + clearSyncQueueForStudent;
 *        [v4] replaced by getDirtyCanvasesByStudent (per-canvas granularity).
 */
export const getPendingSyncQueue = async () => {
  const res = await getDB().executeSql(`SELECT * FROM sync_queue WHERE synced=0`);
  const q = []; for (let i = 0; i < res[0].rows.length; i++) q.push(res[0].rows.item(i)); return q;
};

/**
 * WHAT: Legacy row-level queue write: set synced=1 for the given row ids.
 * FLOW: No-op when ids empty; else UPDATE sync_queue SET synced=1
 *       WHERE id IN (?, ?, ...) with one placeholder per id.
 * CALLS: getDB().executeSql
 * CALLED BY: NOTHING in src/ today (kept for compat; safe to delete).
 * AFFECTS: sync_queue.synced flags.
 * NOTES: Shadowed by clearSyncQueueForStudent (row delete instead of flag).
 *        Safe to delete in rebuild.
 */
export const markQueueItemsSynced = async (ids: number[]) => {
  if (ids.length === 0) return; 
  await getDB().executeSql(`UPDATE sync_queue SET synced=1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
};

/**
 * WHAT: Deletes a student's row from BOTH student_data_cache and sync_queue
 *       (the only writer of a student's queue row besides persistStudentData).
 * FLOW: DELETE student_data_cache WHERE studentId=?;
 *       DELETE sync_queue WHERE studentId=?.
 * CALLS: getDB().executeSql
 * CALLED BY: DashboardScreen.tsx:53 (deleteStudent flow: cloud delete ->
 *            purgeLocalStudent -> dispatch removeStudent)
 * AFFECTS: student_data_cache, sync_queue. If the cloud delete fails the
 *          student comes back on next list fetch; local purge is fire-and-forget.
 * NOTES: In rebuild, keep symmetric with student.ts deleteStudent.
 */
export const purgeLocalStudent = async (studentId: string) => {
  const db = getDB();
  await db.executeSql(`DELETE FROM student_data_cache WHERE studentId=?`, [studentId]);
  await db.executeSql(`DELETE FROM sync_queue WHERE studentId=?`, [studentId]);
};

/**
 * WHAT: DISTINCT dirty studentIds (sync_queue WHERE synced=0) — the sync
 *       engine's work list.
 * FLOW: SELECT DISTINCT studentId FROM sync_queue WHERE synced=0; any error is
 *       swallowed with a console.warn -> [].
 * CALLS: getDB().executeSql
 * CALLED BY: sync.ts:17 (processSyncQueue)
 * AFFECTS: Controls which students get uploaded.
 * NOTES: [v4] replaced by getDirtyCanvasesByStudent (per-canvas granularity).
 */
export const getPendingSyncStudents = async (): Promise<string[]> => {
  try {
    const r = await getDB().executeSql(`SELECT DISTINCT studentId FROM sync_queue WHERE synced = 0`);
    const ids: string[] = [];
    for (let i = 0; i < r[0].rows.length; i++) ids.push(r[0].rows.item(i).studentId);
    return ids;
  } catch (e) { console.warn('getPendingSyncStudents failed', e); return []; }
};

/**
 * WHAT: Delete all queue rows for a student (called after successful upload).
 * FLOW: DELETE FROM sync_queue WHERE studentId=?; errors swallowed -> warn.
 * CALLS: getDB().executeSql
 * CALLED BY: sync.ts:30 (success), sync.ts:24 (stale local data)
 * AFFECTS: Removes the student from the dirty set; failure to clear would
 *          re-upload forever.
 */
export const clearSyncQueueForStudent = async (studentId: string): Promise<void> => {
  try {
    await getDB().executeSql(`DELETE FROM sync_queue WHERE studentId = ?`, [studentId]);
  } catch (e) { console.warn('clearSyncQueueForStudent failed', e); }
};

/**
 * WHAT: Read the authenticated user's cached students list (Firestore snapshot
 *       mirror) from student_list_cache, keyed by auth uid.
 * FLOW: 1) auth().currentUser?.uid; no user -> null.
 *       2) SELECT students FROM student_list_cache WHERE uid=?.
 *       3) No row -> null; else JSON.parse(students).
 * CALLS: auth().currentUser, getDB().executeSql
 * CALLED BY: src/api/student.ts:14 and :21 — offline-first reads in
 *            listStudents/studentsCache (returns cached list before/while
 *            fetching Firestore).
 * AFFECTS: student_list_cache (read); feeds the student list UI
 *          (DashboardScreen, SurahList-student-picker style screens).
 * NOTES: Whole-error swallow -> returns null on any failure (treated as "no
 *        cache"). updatedAt column is written but NEVER read — dead data.
 */
export const getCachedStudentList = async (): Promise<any[] | null> => {
  try {
    const uid = auth().currentUser?.uid; if (!uid) return null;
    const r = await getDB().executeSql(`SELECT students FROM student_list_cache WHERE uid = ?`, [uid]);
    if (r[0].rows.length === 0) return null;
    return JSON.parse(r[0].rows.item(0).students);
  } catch { return null; }
};

/**
 * WHAT: Upsert the current user's students array into student_list_cache with
 *       an ISO timestamp.
 * FLOW: uid guard -> INSERT OR REPLACE (uid, JSON.stringify(students), now).
 * CALLS: auth().currentUser, getDB().executeSql
 * CALLED BY: src/api/student.ts:18 (after cached-list path resolves) and :30
 *            (after a fresh Firestore snapshot — keeps the cache warm offline).
 * AFFECTS: student_list_cache (write). Mirrors Firestore users/{uid}/students.
 * NOTES: Empty catch -> best-effort. Callers must NOT depend on this succeeding.
 *        Per-user row means switching Firebase accounts swaps the cache row.
 */
export const cacheStudentList = async (students: any[]): Promise<void> => {
  try {
    const uid = auth().currentUser?.uid; if (!uid) return;
    await getDB().executeSql(`INSERT OR REPLACE INTO student_list_cache (uid, students, updatedAt) VALUES (?, ?, ?)`,
      [uid, JSON.stringify(students), new Date().toISOString()]);
  } catch {}
};

/**
 * WHAT: Read a previously measured mushaf page layout (per-line summed word
 *       widths) so the page can render in a single pass without measuring.
 * FLOW: SELECT lines FROM page_layout_cache WHERE all 6 key columns match
 *       (headerVisible bool -> 1/0); JSON.parse(lines) -> number[] (index =
 *       line index, value = sum of word widths), else null.
 * CALLS: getDB().executeSql
 * CALLED BY: MushafPageView.tsx:118 — cache probe on every page/font/width
 *            change; 'hit' -> layoutContentRef.current set, 'miss' ->
 *            measurement pass runs.
 * AFFECTS: page_layout_cache (read). Directly controls whether MushafPageView
 *          does the expensive word-measurement render pass.
 * NOTES: best-effort: any SQL/parse error -> null (triggering a re-measure).
 *        Key must EXACTLY match what savePageLayoutCache wrote, including the
 *        headerVisible 1/0 encoding — a mismatch makes the cache useless.
 */
export const getPageLayoutCache = async (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  fs: number, sparse: number, screenW: number,
): Promise<number[] | null> => {
  try {
    const r = await getDB().executeSql(
      `SELECT lines FROM page_layout_cache WHERE pageNumber=? AND textStyle=? AND headerVisible=? AND fs=? AND sparse=? AND screenW=?`,
      [pageNumber, textStyle, headerVisible ? 1 : 0, fs, sparse, screenW]);
    if (r && r[0].rows.length > 0) return JSON.parse(r[0].rows.item(0).lines);
  } catch { /* cache is best-effort */ }
  return null;
};

/**
 * WHAT: Persist the measured per-line width sums for a page so the next visit
 *       skips measurement.
 * FLOW: INSERT OR REPLACE with the 6-key composite PK + JSON.stringify(lines).
 * CALLS: getDB().executeSql
 * CALLED BY: MushafPageView.tsx:157 (handleWordMeasured, when all lines of the
 *            page have completed measurement and no cache was present).
 * AFFECTS: page_layout_cache (write). Written once per (page, style, fs, width)
 *          combination, then reused forever until invalidated.
 * NOTES: Fires inside the onLayout-driven measurement callback; guarded by
 *        cacheWrittenRef so it runs at most once per page-load; errors
 *        swallowed (best-effort). Invariant to preserve in rebuild: key
 *        columns must byte-match getPageLayoutCache's query.
 */
export const savePageLayoutCache = async (
  pageNumber: number, textStyle: string, headerVisible: boolean,
  fs: number, sparse: number, screenW: number, lines: number[],
) => {
  try {
    await getDB().executeSql(
      `INSERT OR REPLACE INTO page_layout_cache (pageNumber, textStyle, headerVisible, fs, sparse, screenW, lines) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pageNumber, textStyle, headerVisible ? 1 : 0, fs, sparse, screenW, JSON.stringify(lines)]);
  } catch { /* best-effort */ }
};

/**
 * WHAT: Invalidate cached layouts for a page-number range (range delete).
 * FLOW: DELETE FROM page_layout_cache WHERE pageNumber BETWEEN from AND to.
 * CALLS: getDB().executeSql
 * CALLED BY: QuranViewScreen.tsx:196 — handleFixFont: after a font-size change
 *            (fix font flow) wipes pages [currentPage-3, currentPage+3], then
 *            bumps fixNonce so MushafPageView remounts and re-measures.
 * AFFECTS: page_layout_cache (range delete). Re-measure of the range on next
 *          render; other pages keep their cached layouts.
 * NOTES: Fire-and-forget, swallowed errors — if the delete fails the page
 *        re-renders with the OLD cached widths under the NEW font size (visual
 *        mislayout, no crash). Only ever clears a 7-page range, never wholesale.
 */
export const clearPageLayoutCacheRange = async (from: number, to: number): Promise<void> => {
  try {
    await getDB().executeSql(
      `DELETE FROM page_layout_cache WHERE pageNumber >= ? AND pageNumber <= ?`,
      [from, to],
    );
  } catch {
    // best-effort invalidation
  }
};
