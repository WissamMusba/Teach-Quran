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
// MUSHAF_TOTAL_PAGES: the uthmani mushaf_pages table is complete only at 604
// rows — fetchMushafPages' no-op check compares against this (a partial fill
// must be repaired, not skipped).
const MUSHAF_TOTAL_PAGES = 604;
// MAX_VERSES_PAGE_CACHE: FIFO cap on versesPageCache so one-shot deep-link
// loads (limit up to 12k rows) and surah scrolls cannot grow the map unbounded.
const MAX_VERSES_PAGE_CACHE = 60;

// Module-level caches (memory only — no persistence, evicted only by process
// death):
// indopakVerseCache: lazily loaded bundled indopak_verse_pages.json map
//   (`${surahId}:${verseNum}` -> page), shared by getIndopakVersePage and the
//   reverse-map build in getVersesByPage.
// indopakReverseMap: page -> list of `${surahId}:${verseNum}` keys, built on
//   first getVersesByPage indopak call.
// indopakPageVerseCache: page -> verse rows, memoized per page.
// versesPageCache: key `${surahId}:${offset}:${limit}` -> {verses, total},
//   FIFO-capped; cleared by fetchMissing after a repair run (see NOTES).
// surahTotalCache: surahId -> verse COUNT(*), memoized per surah; cleared
//   together with versesPageCache.
let indopakVerseCache: Record<string, number> | null = null;
let indopakReverseMap: Record<string, string[]> | null = null;
const indopakPageVerseCache: Record<number, any[]> = {};
const versesPageCache = new Map<string, { verses: any[]; total: number }>();
const surahTotalCache = new Map<number, number>();

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
 *        FIX: the completeness COUNT query is inside the try block — a
 *        transient DB error there previously rejected the single-flight
 *        promise WITHOUT resetting it to null, permanently blocking indopak
 *        imports for the rest of the process.
 */
export const importIndopakPages = async () => {
  if (!indopakPagesPromise) {
    indopakPagesPromise = (async () => {
      try {
        const db = getDB();
        const check = await db.executeSql(`SELECT COUNT(*) as c FROM mushaf_pages_indopak`);
        if (check && check.length > 0 && check[0].rows.item(0).c > 0) return true;
        const allPages = require('../assets/data/indopak_pages.json');
        if (!allPages?.pages) return false;
        const entries = Object.values(allPages.pages) as any[];
        await db.transaction((tx: any) => {
          for (const p of entries) {
            tx.executeSql(`INSERT OR REPLACE INTO mushaf_pages_indopak (pageNumber, data) VALUES (?, ?)`,
              [p.page, JSON.stringify(p)]);
          }
        });
        return true;
      } catch (e) { console.warn('importIndopakPages failed', e); indopakPagesPromise = null; return false; }
    })();
  }
  return indopakPagesPromise;
};

/**
 * WHAT: Synchronous verse -> mushaf page lookup from the bundled
 *       indopak_verse_pages.json map (key `${surahId}:${verseNum}`).
 * FLOW: Lazy-require the JSON into indopakVerseCache on first call; return
 *       map[key] || 1 (fallback page 1 — a known wrong-page fallback).
 * CALLED BY: getVersePage (indopak branch)
 * AFFECTS: none (pure map read); populates indopakVerseCache on first call.
 * NOTES: Returns page 1 for any verse missing from the map — misrender, not a
 *        crash. The map is also reused as the source for the reverse index in
 *        getVersesByPage.
 */
const getIndopakVersePage = (surahId: number, verseNum: number): number => {
  if (!indopakVerseCache) {
    try { indopakVerseCache = require('../assets/data/indopak_verse_pages.json'); }
    catch { indopakVerseCache = {}; }
  }
  const key = `${surahId}:${verseNum}`;
  return indopakVerseCache[key] || 1;
};

/**
 * WHAT: Read one mushaf page's JSON (lines/words layout) from SQLite.
 * FLOW: Pick table by isIndopakStyle (mushaf_pages_indopak vs mushaf_pages);
 *       SELECT data WHERE pageNumber=?; JSON.parse; missing -> { lines: [] }.
 * CALLS: getDB().executeSql
 * CALLED BY: QuranViewScreen.tsx (ensurePageLoaded — populates pageCache,
 *            evicts to 40 pages keeping ±12 of current).
 * AFFECTS: reads mushaf_pages / mushaf_pages_indopak; feeds pageCache ->
 *          MushafPageView's line/word layout engine.
 * NOTES: The empty-page sentinel ({ lines: [] }) is indistinguishable from a
 *        page still being downloaded/fetched — callers must coordinate with
 *        fetchMushafPages/importIndopakPages ordering.
 *        HOT PATH: single PRIMARY KEY lookup (pageNumber) + one JSON.parse of
 *        a ~7 KB blob per page — no scan, no N+1.
 */
export const getMushafPageData = async (pageNum: number, mushaf?: string) => {
  const table = isIndopakStyle(mushaf) ? 'mushaf_pages_indopak' : 'mushaf_pages';
  const res = await getDB().executeSql(`SELECT data FROM ${table} WHERE pageNumber=?`, [pageNum]);
  if (res && res.length > 0 && res[0].rows.length > 0) return JSON.parse(res[0].rows.item(0).data);
  return { lines: [] };
};

/**
 * WHAT: Background fill-in: re-downloads any surah whose verses count in the DB
 *       is below its declared ayah count, 10 surahs at a time.
 * FLOW: 1) GET /v1/surah (metadata); upsert all 114 surahs (INSERT OR REPLACE)
 *          so a wiped surahs table can never stay empty.
 *       2) One GROUP BY COUNT(*) query builds per-surah totals (was 114
 *          sequential COUNT queries); `missing` = surahs under numberOfAyahs.
 *       3) DELETE FROM verses WHERE surahId=? for each missing surah
 *          (inside one transaction) — removes half-downloaded surahs.
 *       4) Chunk missing by 10; per chunk: parallel fetch of
 *          /editions/quran-uthmani,en.sahih,indo.pak (3 editions), then one
 *          transaction inserting all verses (arabic, indopak, translation, page).
 *       5) After a successful repair: clear versesPageCache + surahTotalCache
 *          so paginated reads and totals are not stale for the rest of the
 *          process (a read that ran mid-repair used to stay cached forever).
 *       6) Per-chunk catch -> console.error only, keep going.
 * CALLS: fetch(SURAH_API...), db.executeSql/db.transaction
 * CALLED BY: downloadAndCacheQuran (early-exit path and post-first-10-surahs
 *            path) — BOTH un-awaited (fire-and-forget).
 * AFFECTS: verses (delete + insert), surahs (114 upserts), in-memory
 *          versesPageCache/surahTotalCache (cleared after repair).
 * NOTES: NOT awaited by downloadAndCacheQuran — SplashScreen proceeds with a
 *        partial DB and a live background download. It also duplicates the
 *        insert logic of downloadAndCacheQuran's inline loop — in rebuild,
 *        extract a single downloadSurah(s) helper.
 *        FIXES: surah upsert (was: path 2 never touched surahs — an empty
 *        surahs table stayed empty forever); batch COUNT (was 114 awaits);
 *        cache invalidation (was: stale totals/verse lists until restart).
 */
const fetchMissing = async () => {
  const db = getDB();
  try {
    const metaData = await (await fetch(`${SURAH_API}`)).json();
    await db.transaction((tx: any) => {
      metaData.data.forEach((s: any) => tx.executeSql(`INSERT OR REPLACE INTO surahs (id, name, englishName, verses) VALUES (?, ?, ?, ?)`, [s.number, s.name, s.englishName, s.numberOfAyahs]));
    });
    const countRes = await db.executeSql(`SELECT surahId, COUNT(*) as c FROM verses GROUP BY surahId`);
    const counts: Record<number, number> = {};
    if (countRes && countRes.length > 0) for (let i = 0; i < countRes[0].rows.length; i++) { const row = countRes[0].rows.item(i); counts[row.surahId] = row.c; }
    const missing: any[] = metaData.data.filter((s: any) => (counts[s.number] || 0) < s.numberOfAyahs);
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
    versesPageCache.clear();
    surahTotalCache.clear();
  } catch (e) { console.error('Quran background fill failed:', e); }
};

/**
 * WHAT: The Quran bootstrap entry point: guarantees surahs + verses are
 *       populated (6236 verses total), then kicks off mushaf page caching.
 * FLOW: 1) initDatabase() — the ONLY DB init call site in src/.
 *       2) COUNT(*) FROM verses:
 *          - >= 6236 (TOTAL_VERSES) -> ALSO ensure mushaf pages are complete:
 *            fetchMushafPages() (unawaited, self-heals partial fills), return
 *            true. (FIX: a kill between verse and page download used to leave
 *            mushaf_pages partially filled — or empty — forever.)
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
 *   - Path 2's fetchMissing now upserts surahs too (see fetchMissing NOTES).
 *   - Re-throws on failure so SplashScreen can surface an error state; every
 *     other function in this file swallows errors instead.
 */
export const downloadAndCacheQuran = async () => {
  await initDatabase();
  const db = getDB();
  const [verseCheck] = await Promise.all([db.executeSql(`SELECT COUNT(*) as c FROM verses`)]);
  const count = verseCheck && verseCheck.length > 0 ? verseCheck[0].rows.item(0).c : 0;
  if (count >= TOTAL_VERSES) { fetchMushafPages(); return true; }
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
 *       mushaf_pages (skipped only when the table is already complete).
 * FLOW: 1) COUNT(*): >= 604 rows -> return (cache complete, no-op). A partial
 *          fill (e.g. app killed mid-download) is REPAIRED, not skipped —
 *          INSERT OR REPLACE makes re-download of existing rows a no-op.
 *       2) Chunks of 20 pages (page-001.json .. page-604.json, zero-padded):
 *          parallel fetch, filter r.ok, one transaction of INSERT OR REPLACE.
 *       3) Per-chunk catch -> console.error, continue to next chunk.
 * CALLS: fetch(MUSHAF_BASE/page-NNN.json), db.transaction
 * CALLED BY: downloadAndCacheQuran — all call sites unawaited.
 * AFFECTS: mushaf_pages (up to 604 rows, ~JSON blobs each).
 * NOTES: No retry beyond the chunk loop; a permanently failing page keeps the
 *        count below 604, so the repair re-runs on every launch (background,
 *        INSERT OR REPLACE idempotent) — trade-off vs. the old behavior where
 *        ANY partial fill was abandoned forever. The whole body is guarded so
 *        the fire-and-forget call can never produce an unhandled rejection.
 *        Network-only — indopak pages come from the bundle instead
 *        (importIndopakPages). ~604 network requests total on a fresh install.
 */
const fetchMushafPages = async () => {
  try {
    const db = getDB();
    const check = await db.executeSql(`SELECT COUNT(*) as c FROM mushaf_pages`);
    if (check && check.length > 0 && check[0].rows.item(0).c >= MUSHAF_TOTAL_PAGES) return;

    const chunkSize = 20;
    for (let i = 1; i <= MUSHAF_TOTAL_PAGES; i += chunkSize) {
      const promises = [];
      for (let j = i; j < Math.min(i + chunkSize, MUSHAF_TOTAL_PAGES + 1); j++) {
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
  } catch (e) { console.error('fetchMushafPages failed', e); }
};

/**
 * WHAT: Full surah list ordered by id (the app's surah picker data).
 * CALLS: getDB().executeSql SELECT * FROM surahs ORDER BY id
 * CALLED BY: SplashScreen.tsx (initial list after download),
 *            SurahList.tsx (on modal open, if visible).
 * AFFECTS: reads surahs; feeds the surah grid/list UI + QuranView navigation.
 * NOTES: No in-memory cache — re-queries SQLite on every modal open (114 rows,
 *        cheap). Empty only if both download paths failed (fetchMissing now
 *        also upserts surahs, see its NOTES).
 */
export const getSurahs = async () => {
  const res = await getDB().executeSql(`SELECT * FROM surahs ORDER BY id`);
  const s = []; if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) s.push(res[0].rows.item(i)); return s; 
};

/**
 * WHAT: Paginated verse rows for one surah, with total count, memoized in
 *       module memory (FIFO-capped at MAX_VERSES_PAGE_CACHE entries).
 * FLOW: 1) key = `${surahId}:${offset}:${limit}`; cache hit -> return.
 *       2) total from surahTotalCache, else COUNT(*) cached per surah.
 *       3) SELECT * FROM verses WHERE surahId=? ORDER BY verseNumber
 *          LIMIT ? OFFSET ? (covered by idx_verses_surah_verse).
 *       4) Cache {verses, total} under the key; evict oldest entry when over
 *          cap; return.
 * CALLS: getDB().executeSql
 * CALLED BY: QuranViewScreen.tsx (scroll-to-verse: loads targetPage*20 rows;
 *            onEndReached pagination while reading).
 * AFFECTS: reads verses; feeds the QuranViewScreen verse list (Redux not used —
 *          component-local state).
 * NOTES: The cache is cleared by fetchMissing after a repair (no more stale
 *        short results until restart — see fetchMissing). Deep-link loads are
 *        one-shot (each carries a different targetPage*20 limit), so the FIFO
 *        cap drops them instead of pinning huge blobs forever.
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
  if (versesPageCache.size > MAX_VERSES_PAGE_CACHE) {
    const oldest = versesPageCache.keys().next().value;
    if (oldest !== undefined) versesPageCache.delete(oldest);
  }
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
 *        HOT PATH: covered by idx_verses_surah_verse (surahId, verseNumber).
 */
export const getVersePage = async (surahId: number, verseNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) return getIndopakVersePage(surahId, verseNum);
  const res = await getDB().executeSql(`SELECT page FROM verses WHERE surahId=? AND verseNumber=? LIMIT 1`, [surahId, verseNum]);
  return res && res.length > 0 && res[0].rows.length > 0 ? res[0].rows.item(0).page : 1;
};

/**
 * WHAT: All verses belonging to one mushaf page, ordered by surahId then
 *       verseNumber (indopak: in-memory reverse map + IN queries).
 * FLOW (indopak): 1) cache hit (indopakPageVerseCache) -> return.
 *       2) Build indopakReverseMap from indopak_verse_pages.json (page -> keys).
 *       3) keys for pageNum -> group by surahId -> per surah
 *          `WHERE surahId=? AND verseNumber IN (...)` with placeholders,
 *          ALL surah queries issued in parallel (was sequential — a page
 *          crossing 2-3 surah boundaries cost 2-3 round trips).
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
 * NOTES: The indopak branch builds the whole 6236-entry reverse map on first
 *        call (sync require + loop — a few ms, cold-start jank). The tapped-
 *        verse callers at QuranViewScreen.tsx:901/945/996 destructure the
 *        FIRST row as an array (`const [vs] = ...`) — getVersesByPage returns
 *        a FLAT verse row array, so `vs?.find(...)` / `vs?.[0]` are always
 *        undefined there; fix the CALLERS, not this return shape (the render
 *        path MushafPageView relies on the flat array).
 */
export const getVersesByPage = async (pageNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) {
    if (indopakPageVerseCache[pageNum]) return indopakPageVerseCache[pageNum];
    if (!indopakReverseMap) {
      try { indopakVerseCache = require('../assets/data/indopak_verse_pages.json'); }
      catch { indopakVerseCache = {}; }
      indopakReverseMap = {};
      for (const key of Object.keys(indopakVerseCache)) {
        const pg = indopakVerseCache[key];
        if (!indopakReverseMap[pg]) indopakReverseMap[pg] = [];
        indopakReverseMap[pg].push(key);
      }
    }
    const keys = indopakReverseMap[pageNum] || [];
    const out: any[] = [];
    if (keys.length > 0) {
      const bySurah: Record<number, number[]> = {};
      keys.forEach(k => { const parts = k.split(':'); const s = parseInt(parts[0], 10); const v = parseInt(parts[1], 10); if (!bySurah[s]) bySurah[s] = []; bySurah[s].push(v); });
      const db = getDB();
      const surahIds = Object.keys(bySurah);
      const results = await Promise.all(surahIds.map(surahIdKey => {
        const surahId = parseInt(surahIdKey, 10);
        const vs = bySurah[surahId];
        const placeholders = vs.map(() => '?').join(',');
        return db.executeSql(`SELECT * FROM verses WHERE surahId=? AND verseNumber IN (${placeholders}) ORDER BY verseNumber`, [surahId, ...vs]);
      }));
      for (const res of results) if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) out.push(res[0].rows.item(i));
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
