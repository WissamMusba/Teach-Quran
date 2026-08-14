/**
 * FILE: src/database/quranData.ts
 * ROLE: Quran data pipeline: downloads surah metadata + 3 editions of verses
 *       from alquran.cloud, caches uthmani mushaf page JSON from GitHub, imports
 *       bundled indopak pages, and serves all verse/page/surah read queries.
 * DEPENDS ON: src/database/localDB.ts (surahs, verses, mushaf_pages,
 *             mushaf_pages_indopak tables); bundled assets
 *             src/assets/data/indopak_pages.json + indopak_verse_pages.json;
 *             network: api.alquran.cloud, raw.githubusercontent.com
 * USED BY: src/screens/SplashScreen.tsx (bootstrap),
 *          src/screens/QuranViewScreen.tsx (page/verse reads + indopak import),
 *          src/components/quran/SurahList.tsx (surah list)
 */
import { initDatabase, getDB } from './localDB';

// SURAH_API: alquran.cloud surah metadata + edition endpoints (verse texts in
// quran-uthmani, en.sahih and indo.pak — always fetched as a triple).
const SURAH_API = 'https://api.alquran.cloud/v1/surah';
// MUSHAF_BASE: GitHub raw host of the 604 uthmani mushaf page JSONs
// (page-001.json .. page-604.json) fetched by fetchMushafPages.
const MUSHAF_BASE = 'https://raw.githubusercontent.com/zonetecde/mushaf-layout/main/mushaf';
// Two-tier "good enough" thresholds for downloadAndCacheQuran:
// TOTAL_VERSES (6236) = fully cached; MIN_USABLE_VERSES (6000) = partial DB
// that is acceptable to launch with while fetchMissing repairs in background.
const TOTAL_VERSES = 6236;
const MIN_USABLE_VERSES = 6000;

// Module-level caches (memory only — no persistence, evicted only by process
// death):
// indopakVerseCache: lazily loaded bundled indopak_verse_pages.json map
//   (`${surahId}:${verseNum}` -> page), shared by getIndopakVersePage and the
//   reverse-map build in getVersesByPage.
// indopakReverseMap: page -> list of `${surahId}:${verseNum}` keys, built on
//   first getVersesByPage indopak call.
// indopakPageVerseCache: page -> verse rows, memoized per page.
// Single-flight DEFERRED builders (Promise.resolve().then one-shot, module-
//   lifetime): indopakVerseMapPromise loads indopak_verse_pages.json and
//   indopakReverseMapPromise folds the 6236-key reverse index. Defer
//   both the require() and the fold to a microtask so NO page/verse read ever
//   pays a multi-MB synchronous JSON parse on the render path — the render
//   paints first, the indexes land once per process, every later read is an
//   O(1) map hit.
// versesPageCache: key `${surahId}:${offset}:${limit}` -> {verses, total},
//   never invalidated (stale after fetchMissing repairs a surah until restart).
// surahTotalCache: surahId -> verse COUNT(*), memoized per surah.
let indopakVerseCache: Record<string, number> | null = null;
let indopakReverseMap: Record<string, string[]> | null = null;
const indopakPageVerseCache: Record<number, any[]> = {};
const versesPageCache = new Map<string, { verses: any[]; total: number }>();
const surahTotalCache = new Map<number, number>();
// indopakVerseMapPromise: single-flight, deferred loader of indopak_verse_pages.json.
// indopakReverseMapPromise: single-flight, deferred fold of page -> verse keys.
let indopakVerseMapPromise: Promise<Record<string, number>> | null = null;
let indopakReverseMapPromise: Promise<Record<string, string[]> | null> | null = null;

// Page-memoization caches (memory only, bounded, survive LRU evictions):
// - mushafPageMemo: `${script}:${page}` -> parsed mushaf page JSON. Pages the
//   reader's LRU evicts stay here, so revisiting within the same script is an
//   O(1) Map hit instead of a SQLite SELECT + JSON.parse round-trip.
// - indopakPagesByNum: page -> pageData index over the BUNDLED indopak JSON,
//   built once per process by the deferred single-flight getIndopakPageIndex
//   (whose promise is indopakPagesIndexPromise). Indopak pages never touch
//   SQLite, which also sidesteps the latency of a page read queued behind the
//   bulk importIndopakPages transaction on a cold start.
// - versesByPageMemo: script + page -> verse rows (uthmani: the indopak path
//   already memoizes via indopakPageVerseCache — this analog makes uthmani page
//   verse revisits hit memory instead of re-querying verses).
let indopakPagesByNum: Record<number, any> | null = null;
let indopakPagesIndexPromise: Promise<Record<number, any> | null> | null = null;
const mushafPageMemo = new Map<string, any>();
const MUSHAF_PAGE_MEMO_MAX = 300;
const versesByPageMemo = new Map<string, any[]>();
const VERSES_BY_PAGE_MEMO_MAX = 400;

/**
 * WHAT: True if the mushaf style string is an indopak-script font
 *       ('saleem','indopak','alqalam','lateef','harmattan').
 * CALLED BY: getMushafPageData, getVersePage, getVersesByPage — every read
 *            route splits into the indopak vs uthmani pipeline here.
 * AFFECTS: none (pure string test).
 * NOTES: The uthmani branch is the DEFAULT (mushaf undefined -> false). Adding
 *        a font to this list silently switches all three readers to the
 *        indopak tables/maps.
 */
const isIndopakStyle = (mushaf?: string) => {
  const indopakFonts = ['saleem', 'indopak', 'alqalam', 'lateef', 'harmattan'];
  return mushaf && indopakFonts.includes(mushaf);
};

// indopakPagesPromise: single-flight guard so importIndopakPages runs its bulk
// import at most once per process (reset to null only on failure).
let indopakPagesPromise: Promise<boolean> | null = null;

/**
 * WHAT: One-time (promise-guarded) bulk import of the bundled indopak mushaf
 *       page JSON into SQLite, so indopak pages never need the network.
 * FLOW: 1) If indopakPagesPromise exists, return it (single-flight).
 *       2) If mushaf_pages_indopak already has rows -> resolve true, done.
 *       3) require('../assets/data/indopak_pages.json'); missing/invalid -> false.
 *       4) Single transaction: INSERT OR REPLACE (page, JSON) per page entry.
 *       5) Success -> true; failure -> reset promise to null (retry next call)
 *          and log warning.
 * CALLS: getDB() + db.transaction (native)
 * CALLED BY: QuranViewScreen.tsx (ensurePageLoaded, indopak mode; split-view
 *            init) — fire-and-forget before page reads, so the FIRST indopak
 *            page load can race the import (see NOTES).
 * AFFECTS: mushaf_pages_indopak (bulk write, ~604 rows).
 * NOTES: Uses `require()` of a JSON asset, so the data ships inside the APK
 *        (~big; check asset size in rebuild). The import is NOT awaited by
 *        callers: getMushafPageData may return { lines: [] } for the first
 *        frames if the transaction is still running — MushafPageView treats
 *        empty lines as a no-render page.
 */
export const importIndopakPages = async () => {
  if (!indopakPagesPromise) {
    indopakPagesPromise = (async () => {
      const db = getDB();
      const check = await db.executeSql(`SELECT COUNT(*) as c FROM mushaf_pages_indopak`);
      if (check && check.length > 0 && check[0].rows.item(0).c > 0) return true;
      try {
        const allPages = require('../assets/data/indopak_pages.json');
        if (!allPages?.pages) return false;
        const entries = Object.values(allPages.pages) as any[];
        // CHUNKED inserts (~60 rows per transaction) instead of ONE 610-row transaction:
        // react-native-sqlite-storage serializes every query on a single connection, so a giant
        // transaction stalls ALL other DB work (layout-cache reads, verse lookups, student data)
        // for the whole import — the "first open crawls for seconds" on slow phones. With chunks
        // the connection frees between them, so reads interleave and the mushaf is usable while
        // the seeding finishes in the background.
        const CHUNK = 60;
        for (let i = 0; i < entries.length; i += CHUNK) {
          const slice = entries.slice(i, i + CHUNK);
          await db.transaction((tx: any) => {
            for (const p of slice) {
              tx.executeSql(`INSERT OR REPLACE INTO mushaf_pages_indopak (pageNumber, data) VALUES (?, ?)`,
                [p.page, JSON.stringify(p)]);
            }
          });
        }
        return true;
      } catch (e) { console.warn('importIndopakPages failed', e); indopakPagesPromise = null; return false; }
    })();
  }
  return indopakPagesPromise;
};

/**
 * WHAT: Single-flight, DEFERRED loader of the bundled indopak_verse_pages.json
 *       map (`${surahId}:${verseNum}` -> page) into indopakVerseCache. The
 *       multi-MB require() is pushed into a Promise.resolve().then one-shot so
 *       the first indopak verse/page navigation never blocks the render on a
 *       synchronous JSON parse; every later read returns the cached promise.
 * CALLED BY: getIndopakVersePage, getVersesByPage (reverse-map fold) — both
 *            await it; after the one-shot resolves it resolves instantly.
 * AFFECTS: indopakVerseCache (in-memory, once per process).
 */
const loadIndopakVerseMap = (): Promise<Record<string, number>> => {
  if (!indopakVerseMapPromise) {
    indopakVerseMapPromise = Promise.resolve().then(() => {
      try { indopakVerseCache = require('../assets/data/indopak_verse_pages.json'); }
      catch { indopakVerseCache = {}; }
      return indopakVerseCache;
    });
  }
  return indopakVerseMapPromise;
};

/**
 * WHAT: Synchronous verse -> mushaf page lookup from the bundled
 *       indopak_verse_pages.json map (key `${surahId}:${verseNum}`).
 * FLOW: await the deferred single-flight indopakVerseMapPromise (see
 *       loadIndopakVerseMap — one-shot per process, instant thereafter) and
 *       return map[key] || 1 (fallback page 1 — a known wrong-page fallback).
 * CALLED BY: getVersePage (indopak branch)
 * AFFECTS: none (pure map read); populates indopakVerseCache on first call.
 * NOTES: Returns page 1 for any verse missing from the map — misrender, not a
 *        crash. The map is also reused as the source for the reverse index in
 *        getVersesByPage.
 */
const getIndopakVersePage = async (surahId: number, verseNum: number): Promise<number> => {
  const indopakMap = await loadIndopakVerseMap();
  const key = `${surahId}:${verseNum}`;
  return indopakMap[key] || 1;
};

/**
 * WHAT: Single-flight, DEFERRED build of the page index over the bundled
 *       indopak mushaf JSON (indopak_pages.json). The require() + ~604-entry
 *       fold are pushed into a Promise.resolve().then one-shot: every caller
 *       that races the build simply awaits the same promise, so the first
 *       Uthmani->Indopak switch never blocks the page render on a multi-MB
 *       synchronous JSON fold; the index is built once per process and every
 *       later getIndopakPageFromBundle read is an O(1) property lookup.
 * CALLED BY: getIndopakPageFromBundle (each indopak page read awaits it until
 *            the one-shot resolves; afterwards it resolves instantly).
 * AFFECTS: indopakPagesByNum (in-memory, once).
 * NOTES: On parse failure the index is an empty map guarded by the fulfilled
 *        promise — retries are NOT re-attempted within this process (same as
 *        the pre-existing getIndopakPageFromBundle catch behavior, minus the
 *        per-call re-require).
 */
const getIndopakPageIndex = (): Promise<Record<number, any> | null> => {
  if (!indopakPagesIndexPromise) {
    indopakPagesIndexPromise = Promise.resolve().then(() => {
      try {
        const allPages = require('../assets/data/indopak_pages.json');
        const m: Record<number, any> = {};
        if (allPages?.pages) {
          for (const p of Object.values(allPages.pages) as any[]) { if (p?.page) m[p.page] = p; }
        }
        indopakPagesByNum = m;
        return m;
      } catch { indopakPagesByNum = {}; return indopakPagesByNum; }
    });
  }
  return indopakPagesIndexPromise;
};

/**
 * WHAT: Lazy index over the bundled indopak mushaf JSON (indopak_pages.json).
 * FLOW: await getIndopakPageIndex() (single-flight deferred build — see above);
 *       then every individual read is a plain property lookup. Keep the index
 *       alive for the whole process — getMushafPageData serves indopak pages
 *       from it, skipping SQLite + JSON.parse entirely.
 * CALLED BY: getMushafPageData (indopak fast path).
 * AFFECTS: none (pure in-memory index).
 * NOTES: The bundle is the SAME object importIndopakPages writes into SQLite
 *        (JSON.stringify per page) — content is byte-identical, only the transport
 *        differs. Keeps ~5MB of parsed JSON resident, the same data the import
 *        already parses transiently.
 */
const getIndopakPageFromBundle = async (pageNum: number): Promise<any | null> => {
  const index = await getIndopakPageIndex();
  return index ? index[pageNum] || null : null;
};

/**
 * WHAT: Inserts {key -> page} into mushafPageMemo under a FIFO cap (evicts the
 *   oldest-inserted entry when the map exceeds MUSHAF_PAGE_MEMO_MAX). Only
 *   non-empty pages are memoized — an empty { lines: [] } read must re-query so
 *   a self-healed page can land in the memo on the next read.
 * CALLED BY: getMushafPageData, ensureMushafPageData.
 */
const memoizeMushafPage = (key: string, page: any, memo: Map<string, any>, max: number) => {
  if (!page?.lines || page.lines.length === 0) return;
  if (memo.size >= max) memo.delete(memo.keys().next().value);
  memo.set(key, page);
};

/**
 * WHAT: Read one mushaf page's JSON (lines/words layout) — synchronous-fast for
 *       revisits thanks to the module-level memo, and for indopak pages served
 *       straight from the bundled JSON (no database at all).
 * FLOW: 1) memo key `${script}:${pageNum}` hit -> return the same parsed object.
 *       2) indopak: indopakPagesByNum lookup (bundle) — miss falls through to
 *          SQLite for safety. 3) SELECT data WHERE pageNumber=? from the
 *          script's table; JSON.parse; memoize non-empty pages. Missing -> { lines: [] }.
 * CALLS: getIndopakPageFromBundle, getDB().executeSql
 * CALLED BY: QuranViewScreen.tsx (ensurePageLoaded — populates pageCache,
 *            evicts to PAGE_CACHE_MAX keeping ±PAGE_CACHE_KEEP of current).
 * AFFECTS: reads mushaf_pages / mushaf_pages_indopak; feeds pageCache ->
 *          MushafPageView's line/word layout engine.
 * NOTES: The empty-page sentinel ({ lines: [] }) is indistinguishable from a
 *        page still being downloaded/fetched — callers must coordinate with
 *        fetchMushafPages/importIndopakPages ordering. The memo is keyed by
 *        script, so a textStyle switch (which wipes the React pageCache) does
 *        NOT lose already-loaded pages: flipping back to a previous script is
 *        an instant re-hydration.
 */
export const getMushafPageData = async (pageNum: number, mushaf?: string) => {
  const indopak = isIndopakStyle(mushaf);
  const memoKey = `${indopak ? 'indopak' : 'uthmani'}:${pageNum}`;
  const hit = mushafPageMemo.get(memoKey);
  if (hit) return hit;
  // Indopak fast path: the bundle index is built once (deferred, single-flight)
  // and served from memory from then on — avoids the SQLite round trip +
  // bulk-import queue wait.
  if (indopak) {
    const bundled = await getIndopakPageFromBundle(pageNum);
    if (bundled) return bundled;
  }
  const table = indopak ? 'mushaf_pages_indopak' : 'mushaf_pages';
  const res = await getDB().executeSql(`SELECT data FROM ${table} WHERE pageNumber=?`, [pageNum]);
  if (res && res.length > 0 && res[0].rows.length > 0) {
    const page = JSON.parse(res[0].rows.item(0).data);
    memoizeMushafPage(memoKey, page, mushafPageMemo, MUSHAF_PAGE_MEMO_MAX);
    return page;
  }
  return { lines: [] };
};

const ensuredPageQueues = new Map<string, Promise<any>>();

/**
 * WHAT: On-demand self-heal for a mushaf page missing from SQLite. Fresh
 *   installs download pages sequentially from page 1 (fetchMushafPages, chunks
 *   of 20, unawaited) so far pages — e.g. Waaqia ~534 — can still be absent
 *   when the user jumps straight there, and a failed chunk used to leave a
 *   permanent { lines: [] } hole with no retry. This fetches just that one
 *   page JSON from MUSHAF_BASE and inserts it. Indopak pages are bundled +
 *   seeded in bulk by importIndopakPages, so no network path exists here.
 * FLOW: 1) row already present -> null (no-op); in-flight promise per page is
 *        reused 2) fetch page-NNN.json 3) INSERT OR REPLACE 4) return the page
 *        data (caller puts it in pageCache).
 * CALLED BY: QuranViewScreen.ensurePageLoaded on an empty { lines: [] } read.
 * AFFECTS: mushaf_pages (one row on a miss).
 */
export const ensureMushafPageData = async (pageNum: number, mushaf?: string): Promise<any | null> => {
  if (isIndopakStyle(mushaf)) return null;
  const inFlight = ensuredPageQueues.get(`p_${pageNum}`);
  if (inFlight) return inFlight;
  const job = (async () => {
    const res = await getDB().executeSql(`SELECT data FROM mushaf_pages WHERE pageNumber=?`, [pageNum]);
    if (res && res.length > 0 && res[0].rows.length > 0) return null;
    try {
      const r = await fetch(`${MUSHAF_BASE}/page-${String(pageNum).padStart(3, '0')}.json`);
      if (!r.ok) return null;
      const pageData = await r.json();
      await getDB().executeSql(`INSERT OR REPLACE INTO mushaf_pages (pageNumber, data) VALUES (?, ?)`, [pageData.page, JSON.stringify(pageData)]);
      return pageData;
    } catch (e) { console.warn('ensureMushafPageData', pageNum, e); return null; }
  })();
  ensuredPageQueues.set(`p_${pageNum}`, job);
  try { return await job; } finally { ensuredPageQueues.delete(`p_${pageNum}`); }
};

/**
 * WHAT: Background fill-in: re-downloads any surah whose verses count in the DB
 *       is below its declared ayah count, 10 surahs at a time.
 * FLOW: 1) GET /v1/surah (metadata); compare per-surah COUNT(*) to
 *          s.numberOfAyahs; collect `missing`.
 *       2) DELETE FROM verses WHERE surahId=? for each missing surah
 *          (inside one transaction) — removes half-downloaded surahs.
 *       3) Chunk missing by 10; per chunk: parallel fetch of
 *          /editions/quran-uthmani,en.sahih,indo.pak (3 editions), then one
 *          transaction inserting all verses (arabic, indopak, translation, page).
 *       4) Per-chunk catch -> console.error only, keep going.
 * CALLS: fetch(SURAH_API...), db.executeSql/db.transaction
 * CALLED BY: downloadAndCacheQuran (early-exit path and post-first-10-surahs
 *            path) — BOTH un-awaited (fire-and-forget).
 * AFFECTS: verses (delete + insert), surahs unchanged (does NOT upsert surahs).
 * NOTES: NOT awaited by downloadAndCacheQuran — SplashScreen proceeds with a
 *        partial DB and a live background download. It also duplicates the
 *        insert logic of downloadAndCacheQuran's inline loop — in rebuild,
 *        extract a single downloadSurah(s) helper.
 */
const fetchMissing = async () => {
  const db = getDB();
  try {
    const metaData = await (await fetch(`${SURAH_API}`)).json();
    const missing: any[] = [];
    for (const s of metaData.data) {
      const r = await db.executeSql(`SELECT COUNT(*) as c FROM verses WHERE surahId=?`, [s.number]);
      const c = r && r.length > 0 ? r[0].rows.item(0).c : 0;
      if (c < s.numberOfAyahs) missing.push(s);
    }
    if (missing.length === 0) return;
    await db.transaction((tx: any) => {
      missing.forEach(s => tx.executeSql(`DELETE FROM verses WHERE surahId=?`, [s.number]));
    });
    const chunkSize = 10;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      try {
        const promises = chunk.map(s => fetch(`${SURAH_API}/${s.number}/editions/quran-uthmani,en.sahih,indo.pak`).then(r => r.json()));
        const results = await Promise.all(promises);
        await db.transaction((tx: any) => {
          results.forEach((res) => {
            const arRes = res.data[0], enRes = res.data[1], indopakRes = res.data[2];
            for (let i = 0; i < arRes.ayahs.length; i++) {
              const ayah = arRes.ayahs[i];
              tx.executeSql(`INSERT INTO verses (surahId, verseNumber, textArabic, textIndopak, textTranslation, page) VALUES (?, ?, ?, ?, ?, ?)`,
                [arRes.number, ayah.numberInSurah, ayah.text, indopakRes.ayahs[i]?.text || ayah.text, enRes.ayahs[i]?.text || '', ayah.page]);
            }
          });
        });
      } catch (e) { console.error(`Failed chunk starting at surah ${chunk[0].number}`, e); }
    }
  } catch (e) { console.error('Quran background fill failed:', e); }
};

/**
 * WHAT: The Quran bootstrap entry point: guarantees surahs + verses are
 *       populated (6236 verses total), then kicks off mushaf page caching.
 * FLOW: 1) initDatabase() — the ONLY DB init call site in src/.
 *       2) COUNT(*) FROM verses:
 *          - >= 6236 (TOTAL_VERSES) -> return true (fully cached, no-op).
 *          - >= 6000 (MIN_USABLE_VERSES) -> fetchMissing() + fetchMushafPages()
 *            (unawaited), return true ("good enough" path).
 *       3) Else full download: GET /v1/surah -> INSERT OR REPLACE all 114
 *          surahs into `surahs`; delete half-downloaded surahs from `verses`;
 *          parallel fetch first 10 missing surahs (3 editions each); one
 *          transaction inserts all their verses.
 *       4) Fire fetchMissing() + fetchMushafPages() (rest of the surahs +
 *          all 604 uthmani pages, both unawaited), return true.
 *       5) Any error -> console.error + RE-THROW (caller sees failure).
 * CALLS: initDatabase, fetch(SURAH_API), fetch(SURAH_API/{n}/editions/quran-
 *        uthmani,en.sahih,indo.pak), fetchMissing, fetchMushafPages
 * CALLED BY: SplashScreen.tsx (before getSurahs — splash blocks on the
 *            first-10-surahs write, NOT on mushaf pages).
 * AFFECTS: surahs (114 upserts), verses (first 10 surahs synchronously, rest
 *          async), mushaf_pages (async), mushaf_pages_indopak (later, via
 *          QuranViewScreen importIndopakPages).
 * NOTES:
 *   - "return true" happens BEFORE fetchMissing/fetchMushafPages finish — the
 *     splash shows while the DB is still warming; getSurahs can return 114 rows
 *     while verses is still filling (reads just see fewer verses).
 *   - If the DB was previously cut off between 6000-6236 verses, path 2's
 *     fetchMissing repairs it, but `surahs` is never touched in that path: a
 *     wiped/empty surahs table would stay empty forever (getSurahs -> []) —
 *     surprise edge in rebuild: upsert surahs in fetchMissing too.
 *   - Re-throws on failure so SplashScreen can surface an error state; every
 *     other function in this file swallows errors instead.
 */
export const downloadAndCacheQuran = async () => {
  await initDatabase();
  const db = getDB();
  const [verseCheck] = await Promise.all([db.executeSql(`SELECT COUNT(*) as c FROM verses`)]);
  const count = verseCheck && verseCheck.length > 0 ? verseCheck[0].rows.item(0).c : 0;
  if (count >= TOTAL_VERSES) return true;
  if (count >= MIN_USABLE_VERSES) { fetchMissing(); fetchMushafPages(); return true; }

  try {
    const metaData = await (await fetch(`${SURAH_API}`)).json();
    await db.transaction((tx: any) => {
      metaData.data.forEach((s: any) => tx.executeSql(`INSERT OR REPLACE INTO surahs (id, name, englishName, verses) VALUES (?, ?, ?, ?)`, [s.number, s.name, s.englishName, s.numberOfAyahs]));
    });

    const missing: any[] = [];
    for (const s of metaData.data) {
      const r = await db.executeSql(`SELECT COUNT(*) as c FROM verses WHERE surahId=?`, [s.number]);
      const c = r && r.length > 0 ? r[0].rows.item(0).c : 0;
      if (c < s.numberOfAyahs) missing.push(s);
    }
    for (const s of missing) {
      await db.executeSql(`DELETE FROM verses WHERE surahId=?`, [s.number]);
    }

    const firstTenPromises = [];
    for (const s of missing.slice(0, 10)) {
      firstTenPromises.push(fetch(`${SURAH_API}/${s.number}/editions/quran-uthmani,en.sahih,indo.pak`).then(r => r.json()));
    }
    const firstTenResults = await Promise.all(firstTenPromises);

    await db.transaction((tx: any) => {
      firstTenResults.forEach((res) => {
        const arRes = res.data[0], enRes = res.data[1], indopakRes = res.data[2];
        for (let i = 0; i < arRes.ayahs.length; i++) {
          const ayah = arRes.ayahs[i];
          tx.executeSql(`INSERT INTO verses (surahId, verseNumber, textArabic, textIndopak, textTranslation, page) VALUES (?, ?, ?, ?, ?, ?)`, 
            [arRes.number, ayah.numberInSurah, ayah.text, indopakRes.ayahs[i]?.text || ayah.text, enRes.ayahs[i]?.text || '', ayah.page]);
        }
      });
    });

    fetchMissing();
    fetchMushafPages();

    return true;
  } catch (e) {
    console.error('Quran download failed:', e);
    throw e;
  }
};

/**
 * WHAT: Download + cache all 604 uthmani mushaf page JSONs from GitHub into
 *       mushaf_pages (skipped if table is already populated).
 * FLOW: 1) COUNT(*): any rows -> return (cache present, no-op).
 *       2) Chunks of 20 pages (page-001.json .. page-604.json, zero-padded):
 *          parallel fetch, filter r.ok, one transaction of INSERT OR REPLACE.
 *       3) Per-chunk catch -> console.error, continue to next chunk.
 * CALLS: fetch(MUSHAF_BASE/page-NNN.json), db.transaction
 * CALLED BY: downloadAndCacheQuran — both call sites unawaited.
 * AFFECTS: mushaf_pages (up to 604 rows, ~JSON blobs each).
 * NOTES: No retry beyond the chunk loop; a failed chunk leaves a permanent hole
 *        (page renders as { lines: [] } forever). Network-only — indopak pages
 *        come from the bundle instead (importIndopakPages). ~604 network
 *        requests total on a fresh install.
 */
const fetchMushafPages = async () => {
  const db = getDB();
  const check = await db.executeSql(`SELECT COUNT(*) as c FROM mushaf_pages`);
  if (check && check.length > 0 && check[0].rows.item(0).c > 0) return;

  const chunkSize = 20;
  for (let i = 1; i <= 604; i += chunkSize) {
    const promises = [];
    for (let j = i; j < Math.min(i + chunkSize, 605); j++) {
      const pageStr = String(j).padStart(3, '0');
      promises.push(fetch(`${MUSHAF_BASE}/page-${pageStr}.json`).then(r => r.ok ? r.json() : null));
    }
    try {
      const results = await Promise.all(promises);
      await db.transaction((tx: any) => {
        results.forEach((pageData) => {
          if (pageData) {
            tx.executeSql(`INSERT OR REPLACE INTO mushaf_pages (pageNumber, data) VALUES (?, ?)`, [pageData.page, JSON.stringify(pageData)]);
          }
        });
      });
    } catch (e) { console.error(`Failed mushaf chunk starting at page ${i}`, e); }
  }
};

/**
 * WHAT: Full surah list ordered by id (the app's surah picker data).
 * CALLS: getDB().executeSql SELECT * FROM surahs ORDER BY id
 * CALLED BY: SplashScreen.tsx (initial list after download),
 *            SurahList.tsx (on modal open, if visible).
 * AFFECTS: reads surahs; feeds the surah grid/list UI + QuranView navigation.
 * NOTES: No in-memory cache — re-queries SQLite on every modal open (114 rows,
 *        cheap). Empty if downloadAndCacheQuran never inserted surahs (see its
 *        NOTES).
 */
export const getSurahs = async () => {
  const res = await getDB().executeSql(`SELECT * FROM surahs ORDER BY id`);
  const s = []; if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) s.push(res[0].rows.item(i)); return s; 
};

/**
 * WHAT: Paginated verse rows for one surah, with total count, memoized in
 *       module memory.
 * FLOW: 1) key = `${surahId}:${offset}:${limit}`; cache hit -> return.
 *       2) total from surahTotalCache, else COUNT(*) cached per surah.
 *       3) SELECT * FROM verses WHERE surahId=? ORDER BY verseNumber
 *          LIMIT ? OFFSET ?.
 *       4) Cache {verses, total} under the key; return.
 * CALLS: getDB().executeSql
 * CALLED BY: QuranViewScreen.tsx (scroll-to-verse: loads targetPage*20 rows;
 *            onEndReached pagination while reading).
 * AFFECTS: reads verses; feeds the QuranViewScreen verse list (Redux not used —
 *          component-local state).
 * NOTES: The in-memory cache is never invalidated — after fetchMissing fills in
 *        a missing surah, a previously cached "short" result for that surah
 *        stays stale until app restart. memory-only, so no SQLite table is
 *        involved; eviction only by process death.
 */
export const getVersesBySurahPaginated = async (surahId: number, page: number = 1, limit: number = 20) => {
  const offset = (page - 1) * limit;
  const key = `${surahId}:${offset}:${limit}`;
  const cached = versesPageCache.get(key);
  if (cached) return cached;
  const db = getDB();
  let total = surahTotalCache.get(surahId);
  if (total === undefined) {
    const countRes = await db.executeSql(`SELECT COUNT(*) as total FROM verses WHERE surahId=?`, [surahId]);
    total = countRes && countRes.length > 0 ? countRes[0].rows.item(0).total : 0;
    surahTotalCache.set(surahId, total);
  }
  const res = await db.executeSql(`SELECT * FROM verses WHERE surahId=? ORDER BY verseNumber LIMIT ? OFFSET ?`, [surahId, limit, offset]);
  const verses = []; if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) verses.push(res[0].rows.item(i));
  const result = { verses, total };
  versesPageCache.set(key, result);
  return result;
};

/**
 * WHAT: Map a verse to its mushaf page number.
 * FLOW: indopak style -> getIndopakVersePage (synchronous map lookup);
 *       else SELECT page FROM verses WHERE surahId=? AND verseNumber=? LIMIT 1;
 *       missing -> 1.
 * CALLS: isIndopakStyle, getIndopakVersePage, getDB().executeSql
 * CALLED BY: QuranViewScreen.tsx (scrollToVerse navigation; go-to-first-verse
 *            on surah switch; deep-link/jump-to-verse: sets current page,
 *            header, then ensurePageLoaded + prefetchPartner + scroll).
 * AFFECTS: reads verses (uthmani) / indopak_verse_pages.json (indopak);
 *          drives page navigation in QuranViewScreen.
 * NOTES: Uthmani page comes from alquran.cloud's ayah.page column (their page
 *        layout); indopak pages come from the bundle — the two layouts are
 *        unrelated, hence the fork. LIMIT 1 masks duplicate rows if any.
 */
export const getVersePage = async (surahId: number, verseNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) return getIndopakVersePage(surahId, verseNum);
  const res = await getDB().executeSql(`SELECT page FROM verses WHERE surahId=? AND verseNumber=? LIMIT 1`, [surahId, verseNum]);
  return res && res.length > 0 && res[0].rows.length > 0 ? res[0].rows.item(0).page : 1;
};

/**
 * WHAT: Single-flight, DEFERRED fold of the page -> verse-key reverse index
 *       (page -> [`${surahId}:${verseNum}`, ...]) over indopakVerseCache,
 *       stored in indopakReverseMap. Runs once per process inside a
 *       Promise.resolve().then one-shot so the ~6236-entry fold never blocks
 *       the render synchronously on the first indopak page-verses read;
 *       subsequent getVersesByPage indopak calls await the already-resolved
 *       promise (near-zero) or hit indopakPageVerseCache.
 * CALLED BY: getVersesByPage (indopak branch).
 * AFFECTS: indopakReverseMap (in-memory, once per process).
 */
const getIndopakReverseMap = (): Promise<Record<string, string[]> | null> => {
  if (!indopakReverseMapPromise) {
    indopakReverseMapPromise = Promise.resolve().then(async () => {
      const indopakMap = await loadIndopakVerseMap();
      const m: Record<string, string[]> = {};
      for (const key of Object.keys(indopakMap)) {
        const pg = indopakMap[key];
        if (!m[pg]) m[pg] = [];
        m[pg].push(key);
      }
      indopakReverseMap = m;
      return m;
    });
  }
  return indopakReverseMapPromise;
};

/**
 * WHAT: All verses belonging to one mushaf page, ordered by surahId then
 *       verseNumber (indopak: in-memory reverse map + IN queries).
 * FLOW (indopak): 1) cache hit (indopakPageVerseCache) -> return.
 *       2) Build indopakReverseMap from indopak_verse_pages.json (page -> keys).
 *       3) keys for pageNum -> group by surahId -> per surah
 *          `WHERE surahId=? AND verseNumber IN (...)` with placeholders.
 *       4) Concatenate, sort (surahId, verseNumber), memoize per page, return.
 * FLOW (uthmani): SELECT * FROM verses WHERE page=? ORDER BY surahId,
 *        verseNumber (uses idx_verses_page).
 * CALLS: isIndopakStyle, require(indopak_verse_pages.json) lazy, getDB()
 * CALLED BY: QuranViewScreen.tsx (ensurePageVersesLoaded — fills
 *            pageVersesCache, evicts to 40 pages; mapping a tapped verse
 *            number back to its surahId for highlighting — note: destructures
 *            the FIRST element as a verse array; firstVerse of page for
 *            header/scroll math).
 * AFFECTS: reads verses + indopak reverse map; feeds MushafPageView's
 *          verse-to-word mapping and highlight overlays.
 * NOTES: The indopak branch builds the whole 6236-entry reverse map once on
 *        first call — deferred behind a single-flight promise (getIndopakReverseMap)
 *        so first-call jank never blocks the render; the tapped-verse caller's
 *        `vs?.find(...)` on a Promise-of-array-of-arrays is suspicious typing
 *        (uthmani path returns a flat array) — verify during rebuild. The
 *        uthmani path re-queries SQLite per page (idx_verses_page) — expensive
 *        on a uthmani<->indopak flip, mitigated by the module memo + the
 *        screen-side cache-wipe skip for same-family switches.
 */
export const getVersesByPage = async (pageNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) {
    if (indopakPageVerseCache[pageNum]) return indopakPageVerseCache[pageNum];
    // Single-flight deferred fold (see getIndopakReverseMap): the 6236-key
    // reverse index over indopak_verse_pages.json is built once, off the
    // render path, then reused by every page.
    if (!indopakReverseMap) await getIndopakReverseMap();
    const keys = indopakReverseMap?.[pageNum] || [];
    const out: any[] = [];
    if (keys.length > 0) {
      const bySurah: Record<number, number[]> = {};
      keys.forEach(k => { const parts = k.split(':'); const s = parseInt(parts[0], 10); const v = parseInt(parts[1], 10); if (!bySurah[s]) bySurah[s] = []; bySurah[s].push(v); });
      const db = getDB();
      for (const surahId of Object.keys(bySurah)) {
        const vs = bySurah[parseInt(surahId, 10)];
        const placeholders = vs.map(() => '?').join(',');
        const res = await db.executeSql(`SELECT * FROM verses WHERE surahId=? AND verseNumber IN (${placeholders}) ORDER BY verseNumber`, [parseInt(surahId, 10), ...vs]);
        if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) out.push(res[0].rows.item(i));
      }
      out.sort((a, b) => (a.surahId - b.surahId) || (a.verseNumber - b.verseNumber));
    }
    indopakPageVerseCache[pageNum] = out;
    return out;
  }
  const res = await getDB().executeSql(`SELECT * FROM verses WHERE page=? ORDER BY surahId, verseNumber`, [pageNum]);
  const out: any[] = [];
  if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) out.push(res[0].rows.item(i));
  return out;
};

/**
 * WHAT: One-shot startup warm-up of the three indopak single-flight builders
 *       (getIndopakPageIndex, loadIndopakVerseMap, importIndopakPages) so the
 *       multi-MB JSON require()s and the ~604-row SQLite bulk import run on the
 *       splash, NOT on the first indopak page press. Every target is already
 *       single-flight/deferred — it returns the same promise to all concurrent
 *       callers — so press-path reads that await them just join the promise
 *       started here (near-zero).
 * FLOW: Fire each builder in an isolated try/catch — a failure in one must not
 *       abort the others; importIndopakPages additionally resets its promise on
 *       failure, so a later press-path call retries the import itself.
 * CALLED BY: SplashScreen.tsx (right after downloadAndCacheQuran) —
 *            fire-and-forget, NOT awaited: the splash must not block on the
 *            multi-MB parses.
 * AFFECTS: indopakPagesByNum, indopakVerseCache, mushaf_pages_indopak — all
 *          pre-warmed once per process.
 * NOTES: No page/verse READ logic changes — reads still lazy-await the same
 *        single-flight promises, which resolve instantly once warm. The import
 *        transaction races nothing on the press path: indopak page reads are
 *        served from the bundle index, never from the table being written.
 */
export const warmIndopakIndexes = async () => {
  try { getIndopakPageIndex() } catch {}
  try { loadIndopakVerseMap() } catch {}
  try { importIndopakPages() } catch {}
};
