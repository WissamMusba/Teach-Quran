/**
 * FILE: src/utils/startupPrefetch.ts
 * ROLE: Tier-1 startup ANCHOR prefetcher — after the Dashboard paints, quietly warms the
 *       mushaf pages each student is most likely to open next (their last-seen resume page
 *       ± a few neighbors, plus the manifest's lastRead daily page) so their first QuranView
 *       mount resolves instantly.
 * WHY: MushafPageView reads its page JSON, verse map, AND page_layout_cache row before it can
 *       paint; on low-end devices the async SQLite hops (queued behind student-data writes and
 *       other page reads) are the visible delay. Warping a page here primes all three caches:
 *       getMushafPageData/getVersesByPage are memoized (one DB round-trip per page), and
 *       preloadPageLayoutCacheRange loads the layout row into layoutCacheMem — so the
 *       MushafPageView mount for a warmed page resolves its cache SYNCHRONOUSLY (getLayoutCacheSync,
 *       zero DB traffic, zero skeleton flash).
 * TRIGGER: startStartupPrefetch(studentIds) — called from DashboardScreen on mount (student list
 *       exists). Wrapped in InteractionManager.runAfterInteractions + 1500ms grace so the
 *       Dashboard paints first. Module-level `started` guard fires at most ONCE per process and is
 *       RE-ARMED by cancelStartupPrefetch(), so a Dashboard refocus after a reader visit can resume
 *       the warming; a cancel (QuranViewScreen mount) stops the queue at its next tick.
 * BANDS: For the first 5 students: resume page (getLastPageSeenLocal -> getManifest.lastRead ->
 *       page 1 fallback, resolved to a page via getVersePage) ± -4..+6, then the manifest
 *       lastRead daily page ± -1..+1 (skipped when it equals the resume page). Every page is
 *       clamped to 1..totalPages (604 uthmani / 610 indopak) and deduped into ONE shared queue —
 *       resume bands first, then daily bands.
 * PACING: ONE paced drain — 3 pages every 100ms via a setTimeout chain (never more than 3
 *       outstanding page-warmings per tick, so the JS thread stays free for the UI).
 * ABORT: cancelStartupPrefetch() sets a module-level flag; the drain re-checks it every tick
 *       and after every await, returning immediately when set. EVERYTHING is try/caught —
 *       best-effort background warming never throws.
 */
import { Dimensions, InteractionManager } from 'react-native';
import { getMushafPageData, getVersesByPage, getVersePage } from '../database/quranData';
import { getLastPageSeenLocal, getManifest, preloadPageLayoutCacheRange } from '../database/localDB';
import { store } from '../store';
import { pageWFor, SPLIT_MIN_WIDTH } from './mushafLayout';
import { SPARSE_WORD_THRESHOLD } from '../components/quran/MushafPageView';

// P1-style single-flight guard (same pattern as SplashScreen.tsx:24): the prefetch pipeline
// starts at most ONCE per process, even if DashboardScreen re-mounts or re-fires its effect.
let startupPrefetchStarted = false;
// P1-style abort flag: QuranViewScreen's mount calls cancelStartupPrefetch() so the moment the
// reader is on screen the queue stops warming (it would only contend with the reader's own
// single-flight loads).
let startupPrefetchCancelled = false;

// Module-scope window width (Dimensions is fine for background warming; the reader itself uses
// live useWindowDimensions, but a rotation here only shifts which key we preload — never a crash).
const winW = Dimensions.get('window').width;

// Indopak font family list — mirrors quranData.ts:114 isIndopakStyle (NOT exported there) and
// QuranViewScreen.tsx:322. Keep in sync if a font is ever added/removed.
const INDOPAK_FONTS = ['saleem', 'indopak', 'alqalam', 'lateef', 'harmattan'];
const isIndopakStyle = (mushaf?: string): boolean => !!mushaf && INDOPAK_FONTS.includes(mushaf);

/**
 * cancelStartupPrefetch — sets the module-level abort flag. The active drain (or any tick it
 * has already queued via setTimeout) re-checks this flag on its next turn and exits immediately.
 * It also RE-ARMS the `started` guard, so if the reader is opened before the 1500ms grace (or
 * during the drain) and the Dashboard is later refocused, startStartupPrefetch runs again and
 * quietly finishes the warming — a fast reader-open no longer kills the feature for the session.
 * CALLED BY: QuranViewScreen on mount — once the reader is on screen, its own per-page
 *            single-flight loads own the page cache and this pass is pure noise.
 * AFFECTS: startupPrefetchCancelled; re-arms startupPrefetchStarted; stops the drain at its next tick.
 */
export const cancelStartupPrefetch = (): void => {
  startupPrefetchCancelled = true;
  startupPrefetchStarted = false;
};

/**
 * startStartupPrefetch — arms the anchor prefetcher for the given students.
 * FLOW: 1) no-op when studentIds is empty or the process-level started flag is set;
 *       2) reads textStyle / mushafSplit LIVE from the Redux store (post-rehydrate, so the
 *          user's actual font and split preference are used), derives splitOn, the effective
 *          page width (pageWFor), and the page total (604 uthmani / 610 indopak);
 *       3) schedules the build+drain via InteractionManager.runAfterInteractions + 1500ms so the
 *          Dashboard paints first; the 1500ms wait also re-checks the abort flag before starting.
 * CALLED BY: DashboardScreen mount effect.
 * AFFECTS: mushaf-page JSON / verse / page_layout_cache caches (via the paced drain).
 */
export const startStartupPrefetch = (studentIds: string[]): void => {
  if (!studentIds?.length) return;
  if (startupPrefetchStarted) return;
  startupPrefetchStarted = true;
  startupPrefetchCancelled = false;

  const textStyle = store.getState().quran?.textStyle as string | undefined;
  const mushafSplit = store.getState().settings?.mushafSplit;
  const splitOn = !!(mushafSplit && winW >= SPLIT_MIN_WIDTH);
  const pageW = Math.round(pageWFor(winW, splitOn));
  const totalPages = isIndopakStyle(textStyle) ? 610 : 604;
  const ids = studentIds.slice(0, 5);

  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      if (startupPrefetchCancelled) return;
      runStartupPrefetch(ids, textStyle, pageW, totalPages);
    }, 1500);
  });
};

/**
 * runStartupPrefetch — builds the deduped page queue for the first 5 students, then drains it
 * 3 pages per 100ms tick.
 * FLOW: 1) for each student resolve the resume page: getLastPageSeenLocal (per-student local
 *          "last page VIEWED" memory) first, falling back to the manifest lastRead, then page 1;
 *          resolve each verse source to a page via getVersePage; add resume -4..+6 (clamped);
 *          2) for each student add the manifest lastRead daily page -1..+1 (clamped, skipped
 *          when it equals the resume page); all pages land in ONE queue deduped by page number
 *          (resume bands first, then daily bands);
 *          3) paced drain: 3 pages per tick, each page warming getMushafPageData (to compute the
 *          sparse flag from total word count), getVersesByPage, then preloadPageLayoutCacheRange
 *          under the exact key the reader uses (headerVisible=false, sparse 1/0, rounded pageW).
 * CALLS: getLastPageSeenLocal, getManifest, getVersePage, getMushafPageData, getVersesByPage,
 *        preloadPageLayoutCacheRange.
 * CALLED BY: startStartupPrefetch (deferred via InteractionManager + 1500ms).
 * AFFECTS: in-memory page/verse memos + layoutCacheMem (+ SQLite read caching).
 * NOTES: EVERYTHING is try/caught — a failure in any step (missing row, race, DB error) is
 *        swallowed; the queue simply moves on. Cancellation is re-checked before each tick and
 *        after each tick's awaited work.
 */
const runStartupPrefetch = async (
  ids: string[],
  textStyle: string | undefined,
  pageW: number,
  totalPages: number,
): Promise<void> => {
  try {
    const queue: number[] = [];
    const seen = new Set<number>();
    const clampP = (p: number) => Math.max(1, Math.min(p, totalPages));
    const addPage = (p: number) => {
      const c = clampP(p);
      if (!seen.has(c)) { seen.add(c); queue.push(c); }
    };

    for (const sid of ids) {
      if (startupPrefetchCancelled) return;

      // (a) Resume anchor: per-student local last-seen -> manifest lastRead -> page 1.
      let surah: number | null = null;
      let verse: number | null = null;
      try {
        const local = await getLastPageSeenLocal(sid);
        if (local && Number(local.surah) > 0 && Number(local.verse) > 0) {
          surah = Number(local.surah); verse = Number(local.verse);
        } else {
          const mf = await getManifest(sid);
          const lr = mf?.data?.lastRead;
          if (lr && Number(lr.surah) > 0 && Number(lr.verse) > 0) {
            surah = Number(lr.surah); verse = Number(lr.verse);
          }
        }
      } catch {}

      let resumePage = 1;
      if (surah != null && verse != null) {
        try {
          const p = await getVersePage(surah, verse, textStyle);
          if (p && p > 0) resumePage = p;
        } catch {}
      }
      for (let d = -4; d <= 6; d++) addPage(resumePage + d);

      // (b) Daily anchor: manifest lastRead -> daily page ±1 (skipped when it IS the resume page).
      let dailyPage: number | null = null;
      try {
        const mf = await getManifest(sid);
        const lr = mf?.data?.lastRead;
        if (lr && Number(lr.surah) > 0 && Number(lr.verse) > 0) {
          const p = await getVersePage(Number(lr.surah), Number(lr.verse), textStyle);
          if (p && p > 0) dailyPage = p;
        }
      } catch {}
      if (dailyPage != null && dailyPage !== resumePage) {
        for (let d = -1; d <= 1; d++) addPage(dailyPage + d);
      }
    }

    if (startupPrefetchCancelled) return;

    // (c) ONE shared paced drain: 3 pages per 100ms tick.
    const prefetchPage = async (pg: number) => {
      try {
        const pd = await getMushafPageData(pg, textStyle);
        const totalWords = Array.isArray(pd?.lines)
          ? (pd.lines as any[]).reduce((a: number, l: any) => a + (Array.isArray(l?.words) ? l.words.length : 0), 0)
          : 0;
        const sparse = totalWords < SPARSE_WORD_THRESHOLD ? 1 : 0;
        await getVersesByPage(pg, textStyle);
        await preloadPageLayoutCacheRange(pg, pg, textStyle, false, sparse, pageW);
      } catch {}
    };

    let i = 0;
    const tick = async () => {
      if (startupPrefetchCancelled) return;
      if (i >= queue.length) return;
      const end = Math.min(i + 3, queue.length);
      await Promise.all(queue.slice(i, end).map(prefetchPage));
      i = end;
      if (startupPrefetchCancelled) return;
      if (i < queue.length) setTimeout(tick, 100);
    };
    tick();
  } catch {}
};