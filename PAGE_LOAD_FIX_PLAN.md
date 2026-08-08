# PAGE_LOAD_FIX_PLAN — Slow Mushaf Page Navigation (forward AND backward)

**Status:** Proposal only — no source files changed. This document proposes a purely
**additive performance** change set. Nothing below alters UI, UX, reading behavior, or the
data model. All line anchors refer to the current tree (verified by reading, Aug 2026).

---

## 1. Root-Cause Analysis

### Ground truth from the code

| Fact | Where |
|---|---|
| Page mode is a horizontal inverted paging FlatList over 604 (uthmani) / 610 (indopak) page items, `windowSize=3`, `initialNumToRender=3`, `maxToRenderPerBatch=3`, `updateCellsBatchingPeriod=40` | `src/screens/QuranViewScreen.tsx:1384-1391` |
| An unmounted page with no `pageCache[p]` renders a **full-screen ActivityIndicator** (single mode) or a per-half spinner (split `SpreadItem`) | `QuranViewScreen.tsx:1428`, `QuranViewScreen.tsx:92,100` |
| `ensurePageLoaded` fetches page JSON (SQLite + JSON.parse, memoized) into `pageCache` with a 40-entry LRU that keeps only pages within **±12** of the current page | `QuranViewScreen.tsx:231-271` (LRU eviction 260-265), `quranData.ts:204-223` |
| `ensurePageVersesLoaded` mirrors the same LRU pattern for verse rows | `QuranViewScreen.tsx:286-306` |
| **Prefetch only covers ±1..±2 pages** and fires **only on momentum end / jump / settle** — i.e. after the swipe already finished | `prefetchAround` `QuranViewScreen.tsx:317-323`; `onMomentumScrollEnd` `QuranViewScreen.tsx:1394-1409` |
| Split mode prefetch covers pairs ±2; `prefetchPartner` adds only the facing spread half | `QuranViewScreen.tsx:317-334` |
| A runtime page needs TWO resources: page JSON (word graph) + the per-device **layout-sum scale**. Every FIRST visit to a page runs the "measure-then-scale" pass: 120-180 `WordHitArea` `onMeasured` events, per-line overflow scales, `setLineScale` re-renders, plus a 150ms `fontReady` gate | `MushafPageView.tsx:332-374` (handleWordMeasured), `MushafPageView.tsx:485-487` (render gate), `MushafPageView.tsx:218-223` (font gate); see also `PAGE_LAYOUT_CACHE_AND_SPLIT_VIEW.txt` §1 |
| The layout cache exists (SQLite `page_layout_cache` + in-memory FIFO `layoutCacheMem`) but is warmed only **±2 pages per mount** | `MushafPageView.tsx:266` (`preloadPageLayoutCacheRange(pageNum-2, pageNum+2, ...)`), `localDB.ts:445-458` |
| Default `textStyle` is `'lateef'` → **indopak script (610 pages)** served from `require('../assets/data/indopak_pages.json')`, a **4.72 MB JSON asset** (~7.7 KB/page) | `quranSlice.ts:30`; `quranData.ts:72-75,108,158-168` |
| First indopak page touch: synchronous `require` of the **entire 4.7 MB JSON on the JS thread** (100-400ms+ jank) AND a fire-and-forget **610-row INSERT OR REPLACE in ONE SQLite transaction** (holds the single DB connection for 1s+, queueing every other DB call behind it) | `quranData.ts:101-122` (`importIndopakPages`); its own NOTES warn the first page read races the import (`quranData.ts:96-99`) |
| `importIndopakPages()` is invoked from `ensurePageLoaded` **on the touch path** — the worst moment — and again on every `textStyle` change | `QuranViewScreen.tsx:234`; `QuranViewScreen.tsx:694` |
| Deep-link / surah-change / lastRead jumps fetch the target page and only the split partner; the scroll to it is delayed 100-500ms | `QuranViewScreen.tsx:404-410`, `QuranViewScreen.tsx:479-488`, `QuranViewScreen.tsx:727-739`; `setTimeout` at 365, 410, 732 |
| Uthmani pages missing from SQLite heal by a **single-page network fetch** (`ensureMushafPageData`) — extra jank on a hole | `quranData.ts:241-258` |
| `textStyle` change wipes BOTH React caches and their LRU order refs; every page re-warms individually afterwards | `QuranViewScreen.tsx:689-695` |
| Nothing warms pages on idle after the initial ±2 settle | `QuranViewScreen.tsx:1394-1409` (prefetch only at settle) |

### Why pages PAST the current page AND pages BEHIND it both lag

The cursor is always the center of a ±2 prefetch ring. Any target at distance |Δ| > 2 from
the landing point — in either direction — is cold, and every cold page pays the full stack:

1. `pageCache` miss → spinner while the page JSON resolves (`QuranViewScreen.tsx:1428`).
2. Page JSON read: SQLite SELECT + `JSON.parse(~7-40 KB)` (uthmani), or — in the default
   indopak path — the one-time 4.7 MB bundle parse + a blocking 610-row write transaction,
   or, if the in-memory bundle index is not populating, per-page SQLite + JSON.parse.
   See the "verify" flag below.
3. `MushafPageView` layout-cache miss → the measure-then-scale pipeline (`MushafPageView.tsx:332-374`),
   the dominant wall-clock cost for a never-visited page (150ms+ on a mid-tier device).
4. **Sequentiality:** each newly landed page starts steps 1-3 from scratch. The prefetch can
   only begin at momentum end, so consecutive multi-page swipes reduce nothing — each settle
   pays the whole stack for its ±2 only.
5. The LRU keeps a ±12 window but prefetch never uses it — the window contains only pages
   previously *rendered*, so going back behind the visited band is equally cold.

Net effect: flipping forward **and** backward from a random jump point both hit the same
cold-load wall independently.

### Verify-during-implementation flag (do not assert as fact)
- `quranData.ts:56` declares `const indopakPagesByNum: Record<number, any> | null = null;`
  yet `getIndopakPageFromBundle` (`quranData.ts:158-168`) assigns to it (and again in the
  catch). If a typecheck (`tsc --noEmit`) flags a const-assignment error, the in-memory
  bundle index never builds and every indopak page read falls back to SQLite +
  `JSON.parse` per page — which would independently explain "slow both directions" for the
  default `'lateef'` style. The fix would be `const` → `let` (a 1-token change). Confirm or
  refute before touching anything else in the indopak path.

---

## 2. Proposed Fix (concrete steps, all additive, file:line anchored)

### S1. Contiguous predictive prefetch — replace the ±2 ring with the full ±10 window

**Where:** `QuranViewScreen.tsx:317-323` (`prefetchAround`), call sites at `1394-1409`
(momentum end), `351-366` (`handleSelectPage`), `404-410` (deep-link effect), `479-488`
(surah-change effect), `727-739` (lastRead restore).

**What:** replace the ±1/±2 loop with a single `prefetchContiguous(page, K)` helper that
calls `ensurePageLoaded` + `ensurePageVersesLoaded` for every page in `[page-K, page+K]`
(clamped to `[1, pageNumbers.length]`; in split mode the same page-range covers both halves
of every pair automatically because each half is a page number). Keep `K = 10` — exactly
the window the LRU already retains (see S2), so nothing is fetched that would be evicted.

**Guarantee:** `ensurePageLoaded`/`ensurePageVersesLoaded` are single-flight promise-guarded
(`QuranViewScreen.tsx:232`, `287`) and `getMushafPageData` memoizes per script
(`quranData.ts:206-208`) — re-calling on already-cached pages is a no-op. This is the core
of the fix: after ANY settle or jump, the entire ±10 neighborhood is in `pageCache`, so the
FlatList's next mount hits `pageCache[p]` synchronously and renders without the spinner.

**Throttling:** spread the 20-21 requests with a tiny queue (2 in flight, next deferred by
~16ms) so a settle never bursts the SQLite connection. Reuse a `prefetchTimerRef`; a new
page-settle cancels and re-queues.

### S2. Formalize the LRU keep-window = prefetch window

**Where:** `QuranViewScreen.tsx:167-168` (order refs), eviction at `259-265` (pageCache) and
`294-300` (pageVersesCache).

**What:** replace the hardcoded `40`/`12` with named constants
`PAGE_CACHE_MAX = 40`, `PREFETCH_KEEP = 12` and make `PREFETCH_K = PREFETCH_KEEP - 2`
(10). Prefetch (S1) and eviction then provably agree — no page is ever fetched that the LRU
would drop on the next insert, and no page inside the prefetch window is ever evicted while
the cursor is at its center. Pure refactor, zero behavior change for the cached path.

### S3. Background warm after initial load / idle

**Where:** `QuranViewScreen.tsx:1394-1409` (settle), plus a new idle effect alongside the
existing effects (no new deps beyond `currentPageNum`).

**What:** after `onMomentumScrollEnd` (and after the deep-link/surah/lastRead jumps) settle,
set an idle timer (~800ms with no further page change) and then re-run `prefetchContiguous`
for the *next* band (`[p+11, p+KEEP]` and `[p-KEEP, p-11]`) at a low rate (1 page per
40ms). The LRU keeps ±12, so idle-fetched pages survive. This converts dead reading time
into cache warmth — by the time the user actually flips, the JSON + verses are already in
memory and the only remaining cost is the layout render (see S5).

### S4. Widen the layout-cache prewarm from ±2 to the whole window

**Where:** `MushafPageView.tsx:266`.

**What:** `preloadPageLayoutCacheRange(pageNum - 2, pageNum + 2, ...)` →
`preloadPageLayoutCacheRange(pageNum - 10, pageNum + 10, ...)`. The existing helper
(`localDB.ts:445-458`) already resolves the whole range in ONE SQLite query into
`layoutCacheMem`, and `getPageLayoutCache` (`localDB.ts:459-475`) serves subsequent mounts
synchronously from memory. This is a one-number change; the cache-hit path
(`MushafPageView.tsx:270-273, 382-389`) renders single-pass with no measurement.

### S5. Decouple page build from visibility — build neighbors off-screen

**Where:** the page FlatList props `QuranViewScreen.tsx:1391-1392`.

**What:** `windowSize` 3 → 7, `initialNumToRender` 3 → 5, `maxToRenderPerBatch` 3 → 6,
`updateCellsBatchingPeriod` 40 → 25. This mounts ~±2-3 neighbor pages while they are
off-screen, so their MushafPageViews run the layout cache load AND — for never-measured
pages — the measure pass **before** the user swipes there. The measure result writes to
`page_layout_cache` (`MushafPageView.tsx:370-371`), so the second visit is a cache hit.
Together with S1 this makes the visible page-swap instant for ±3 and cheap for the rest.
No scroll/UI behavior changes: `snapToInterval`, `inverted`, and item dimensions are
untouched.

### S6. Parallel / merged DB reads for the window

**Where:** `quranData.ts` — `getMushafPageData` (`204-223`), `getVersesByPage` (`536-569`).

**What:**
- Add one optional module helper `getMushafPagesData(range: [number, number], mushaf)`
  that issues a single `SELECT data FROM <table> WHERE pageNumber BETWEEN ? AND ?` for
  uthmani and folds the results into `mushafPageMemo` (FIFO cap already exists,
  `quranData.ts:178-182`). S1's prefetch queue then does 1 query per window-half instead of
  ~10, and the per-page `JSON.parse` still happens once per page (unavoidable, cheap).
- For indopak, reads already bypass SQLite entirely via `getIndopakPageFromBundle`
  (`quranData.ts:211-214`) once the bundle index works — see S7. No new code needed there
  beyond the verify-flag fix.
- `getVersesByPage` indopak path already builds the reverse map once (`539-548`) and issues
  one IN-query per surah on the page — fine as-is; move the map build into S7's warm-up so
  it never runs on a visible page's critical path.

All new code lives behind the existing module-level caches — pure acceleration, same results.

### S7. Amortize the one-time indopak costs (donate to idle / script change)

**Where:** `quranData.ts:101-122` (`importIndopakPages`), `QuranViewScreen.tsx:234`
(touch-path call), `QuranViewScreen.tsx:694` (textStyle reset), `SplashScreen.tsx:54-68`
(load).

**What:**
- Move the `importIndopakPages()` trigger off the touch path (`QuranViewScreen.tsx:234`
  currently fires it inside `ensurePageLoaded`, i.e. on the first visible page). Instead
  fire it (a) from `SplashScreen.load()` after `downloadAndCacheQuran` resolves — the splash
  spinner is already showing, so the 4.7 MB require + map build + DB import cost nothing to
  the user — and (b) from the textStyle reset (`QuranViewScreen.tsx:694`, already present)
  and a new `setTimeout(..., 3000)` on QuranViewScreen mount for the cold-start case.
  The function is single-flight (`quranData.ts:79,102`) so the extra call sites are free.
- Expose a tiny `warmIndopakIndex()` in `quranData.ts` that eagerly populates
  `indopakVerseCache` + `indopakReverseMap` (the code currently in `quranData.ts:539-548`)
  and the bundle index (`157-169`). Call it from the same idle hooks, so the first
  `getVersesByPage`/`getMushafPageData` in indopak mode never pays a synchronous 6236-key
  build on a visible page.
- Do NOT remove the SQLite import: the table is the documented fallback and other code may
  read it. The import just stops being on anyone's critical path.

### S8. Faster jump delivery (deep-link / surah change / lastRead)

**Where:** `QuranViewScreen.tsx:351-366` (handleSelectPage), `404-410` (deep link),
`479-488` (surah-change), `727-739` (lastRead).

**What:** in every jump site, after `ensurePageLoaded(pg)`, also call
`prefetchContiguous(pg, PREFETCH_K)` immediately (replacing the split-only
`prefetchPartner` calls at 364, 409, 487, 732), and reduce the scroll delay from
100-500ms to a single constant (e.g. 50ms) — the target page is already in `pageCache`
(synchronous state), so the scroll no longer needs to wait for the network/SQLite round
trip. This directly fixes "open a random surah, then flip pages": the moment the jump
lands, both neighbors' data and layout rows are warming.

---

## 3. Acceptance Criteria (measurable, mid-tier device ≈ SD660-class)

- **A1** — After any page settle or jump, within 1.0s of the settle, every page in
  `[p-10, p+10]` is in `pageCache` and `pageVersesCache` (assert via a debug counter —
  existing `pageCacheOrderRef` length). No page in the window shows the ActivityIndicator.
- **A2** — Flipping to p±1..p±3 (already-prefetched): from momentum settle to fully painted
  page **< 80ms**; p±4..p±10 **< 150ms**. (Today: 300ms-2s+, spinner visible.)
- **A3** — Deep link / surah jump: first paint of the target page **< 100ms** after the
  reduced scroll delay, no intermediate blank frame.
- **A4** — First-ever visit to a page (cold, layout-cache miss) while idle-warming:
  measure-pass completes off-screen so the on-screen flip is **< 100ms**; total JS long
  tasks during a 10-page warm burst stay **< 50ms each** (JS profiler).
- **A5** — Cold start with default `'lateef'`: opening QuranView shows the first page
  without a >200ms UI-thread block from the 4.7 MB bundle require/import (it ran at splash).
- **A6** — No regression: all edit flows (highlights/bookmarks/notes/drawings), header
  toggle, split view, textStyle switching, and audio page-turns behave identically to today
  (manual smoke list, see rollback).

---

## 4. Rollback Risk

| Risk | Mitigation in this plan |
|---|---|
| More mounted pages (S5) → higher memory + first-render cost | windowSize 7 keeps only ~±3 mounted; every change is a one-number revert; verify A4/A6 before shipping |
| Prefetch burst (S1/S3) competes with the 400ms debounced save flush | Prefetch queue is 2-in-flight with 16ms spacing; S3 idle timer (800ms) never overlaps edit debounce; skip prefetch while `isDrawing`/`isCapturing` |
| SQLite single connection gets busier during warm | WAL already on (`localDB.ts:16-17`); warm reads are SELECTs that reuse the memoized paths; the heavy 610-row write moved off the touch path (S7) |
| The `const` → `let` verify-flag fix changes indopak behavior | If the flag is real, today's indopak path is broken-slow — the fix only makes reads hit the in-memory bundle (same data, same API, faster). If typecheck passes, do NOT touch that line at all |
| Layout prewarm range read grows (S4) | Still one parameterized query (`localDB.ts:450-452`); worst case returns < 20 rows (only visited pages have rows) |
| Scroll feel changes (S5/S8) | `snapToInterval`/`inverted`/`getItemLayout` untouched; only virtualization numbers and a constant scroll delay change |

All steps are additive: no new tables, no schema change, no new props required by callers,
no reordering of the edit pipeline. Every step is individually revertible in ≤ 5 lines.

## 5. Why Not Heavier Alternatives

- **Preload ALL 600+ pages at launch.** 4.7 MB parsed JS + ~40 MB of uthmani rows read from
  SQLite up front; minutes of warm-up on mid-tier, memory pressure, and — critically — the
  LRU would evict anything beyond ±12 anyway, so most of it is wasted work. The ±10 window
  (S1) covers every realistic reading motion; anything further is a jump, which S8 warms
  synchronously.
- **Single flat page file (drop the 604/610 layout split).** Changes the data model,
  deep-link page math, juz map, and the split-view pairing — a behavior break, not a perf
  change.
- **Pre-render pages to PNG (image mushaf).** Kills word-level tapping, mistake
  highlights, bookmarks, notes, drawings — the product's core feature set.
- **Network-background-download ALL pages on install.** Already exists
  (`fetchMushafPages`, `quranData.ts:414-437`); the slowness is not fetch, it is the
  per-page layout measure + missing prefetch + cold in-memory caches, which this plan
  addresses directly.
