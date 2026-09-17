# PageLoad.md — Mushaf page-load & page-swipe performance brief

**Project:** QuranMasterApp / "Teach Quran" (React Native 0.72, Redux, SQLite, Firebase, Hermes, old architecture)
**Target user profile:** phones (not tablets), **IndoPak script** (`lateef` / `alqalam` / `saleem`), **page swipe mode** (`readingMode === 'page'`, `mushafSplit` off).
**Author of this brief:** static analysis of the current tree (build v143). No source file has been changed by this document.
**Status:** proposal + executable spec. Items are ordered so that the agent can implement them one at a time and verify each.

---

## 0. HOW TO USE THIS DOCUMENT

### 0.1 For the human owner

Everything is in the **change catalogue** (§4 small, §5 big). Each item is self-contained: what to
change, where (file:line), why it helps, what it should do to load times, what could break, how to
verify, how to roll back. §6 gives the order. §7 tells you how to *measure* so the next round is not
guesswork. §9 is the smoke list of features that must never regress.

Implement small items first — most are under an hour and carry no feature risk. Big items are
projects with design sketches, not patches.

### 0.2 For a coding agent picking this up

**Hard rules (violating any of these is a failure, not a trade-off):**

1. **No feature may change behaviour.** Word tap → mistake highlight, verse badges, bookmark ribbon,
   notes, drawings, share capture, split/spread mode, deep links, night mode + 3 colour themes,
   audio page turns, and uthmani⇄indopak switching must all work exactly as today after every item.
2. **One item per commit.** Do not bundle. Every item is individually revertible; keep it that way.
3. **No speculative refactors.** Do not clean up, rename, reformat or "improve" code outside the
   listed anchors. The reading screen is 2738 lines of deliberately tuned logic with hard-won
   comments — respect them.
4. **Do not change the data model.** No schema changes, no `layoutVer` bumps, no changes to the sync
   pipeline (`src/api/sync.ts`), no changes to student/bookmark/note chunk keys.
5. **Do not remove the existing safety nets** (single-flight promise guards in `ensurePageLoaded`,
   the stale-offset self-validation in `onMomentumScrollEnd`, the `programmaticScrollRef` stamp,
   the `paramsHandledRef` deep-link ownership). They exist because of real bugs.
6. **Run §9 (smoke list) after every item**, on a real mid-tier Android phone, in IndoPak page mode.
   A change that is faster but subtly breaks a highlight is worth nothing here.
7. If an item's template says "verify", actually verify it — either with the perf HUD (§7) or by
   naming the two screenshots/frames you compared.

**Context you need before touching anything:** read §3 first (the model), then §8 (pipeline map).

---

## 1. THE PROBLEM, STATED PRECISELY

> "The app is on the Play Store and almost production-ready. Some pages load fast, some are slow, and
> it's not consistent. Page swipe mode in IndoPak takes noticeable time to show a page — it is not
> 'instant/AAA' feeling. Go-to-page is fast, and I already hooked all the other page entries up to
> work like go-to-page, but swiping is still meh. I have already tried a lot of the usual
> optimisations (caching, prefetching, memos, lazy loading) and they gave only marginal gains."

### 1.1 Why "go to page" is fast but swiping is not

Go-to-page is **one mount, prepared before it is needed**:

* `StudentHub` navigates with `{ page }` → `QuranViewScreen` seeds `pageCache` synchronously from the
  quranData module memos (`initialSeed`, `QuranViewScreen.tsx:330-340`),
* `initialScrollIndex` is set (`:2389`) so the FlatList starts at the target cell,
* `landOnPage` scrolls *first* with `getItemLayout` and only then loads data behind a skeleton
  (`:747-780`),
* `warmPageLayoutFor` preloads the layout row so the mount is a synchronous `layoutCacheMem` hit.

Swiping does the opposite: **the page you are swiping towards is created mid-gesture.** `onScroll`
fires every 16 ms, the FlatList mounts new cells while your thumb is moving, and the whole mount cost
(~300–350 native views, ~137 text measurements, a full React subtree) lands inside the animation.
That is the structural difference, and it is why the caching work already done did not fix it — the
cache removes the *scale derivation*, never the *view construction*.

### 1.2 Why "sometimes fast, sometimes slow" (not just slow)

Four independent things add milliseconds non-deterministically, so the same swipe is smooth on one
attempt and janky on the next:

1. **Duplicate cold reads.** `onScroll` re-issues the same SQLite reads for the same pages at up to
   60 Hz with no in-flight guard (M2, §3).
2. **GC pressure.** ~330 full stylesheet rebuilds per page render plus per-word closures (M4, §3).
3. **Cross-page re-render.** Every settle/cache-fill changes prop identities for `notes`,
   `highlights`, `pData`, `pVerses`, so all 7 mounted pages re-render (M3, §3).
4. **Background write contention.** Student-data flushes, chunk merges, sync pushes and layout
   preloads share the one `quran.db` connection and are not suspended during gestures (M5, §3).

---

## 2. MEASURED EVIDENCE (verified, not assumed)

### 2.1 Measured from the shipped asset database

Measured with `sqlite3` over `android/app/src/main/assets/www/indopak_pages.db`:

| Metric | Value |
|---|---|
| Pages in the shipped IndoPak mushaf | **611** (max pageNumber 611; page 1 = 2 words) |
| Lines per page | 15 (min 2, avg 14.9) |
| **Words per page** | **avg 136.9**, **max 176** (page 254), min 2 |
| Total line entries | 9,133 |

Derived: a typical page renders **1 `Pressable` + 1 `Text` per word** plus a badge `View` + `Text`
per verse boundary plus frame/overlays → **~300–350 native views per page**, and ~137 independent
text-layout passes per page.

### 2.2 Verified code anchors (all line numbers current as of this analysis)

| # | Anchor | What it is | Why it matters |
|---|---|---|---|
| A1 | `src/screens/QuranViewScreen.tsx:2400-2435` | page-mode `onScroll` handler | issues `getMushafPageData` + `getVersesByPage` + `getPageLayoutCache` for 3–5 pages (+ spread partners) per scroll event, 16 ms throttle → up to 60×/s |
| A2 | `src/screens/QuranViewScreen.tsx:2398-2399` | `initialNumToRender={5} maxToRenderPerBatch={5} windowSize={7} updateCellsBatchingPeriod={16}` | up to 5 full pages (~1600 views) mount in the first commit; later batches can land mid-flick |
| A3 | `src/screens/QuranViewScreen.tsx:2387` | `data={splitOn ? pagePairsFor(pageNumbers.length) : pageNumbers}` | **new array identity on every render** → VirtualizedList re-runs its render window on every parent commit |
| A4 | `src/screens/QuranViewScreen.tsx:781` and `:726` | `prefetchAround` / `warmNearPages` | both are **empty stubs** — all background page warming was deliberately disabled; the per-frame warm in A1 replaced it |
| A5 | `src/screens/QuranViewScreen.tsx:2685` | `const styles = (nightMode) => StyleSheet.create({…})` | style factory; 37 call sites in this file |
| A6 | `src/components/quran/MushafPageView.tsx:1134` | same style factory | **65 call sites, 2 of them inside the per-word map** (`.wordBox`, `.text`) → ~274 executions per page render |
| A7 | `src/components/quran/MushafPageView.tsx:1094` | `onMeasured={cacheState === 'miss' ? ((w) => handleWordMeasured(…, (line.words\|\|[]).filter(…)…)) : undefined}` | a fresh arrow per word per render; when it fires it re-filters the whole line with `stripPua` + regex per word |
| A8 | `src/components/quran/MushafPageView.tsx:664-667` | deferred `preloadPageLayoutCacheRange(pageNum-4, pageNum+4, …)` | runs **on every page mount**, unconditionally issuing SQL |
| A9 | `src/database/localDB.ts:805-819` | `preloadPageLayoutCacheRange` | **always executes the SELECT** — it never checks whether those keys are already in `layoutCacheMem` |
| A10 | `src/database/localDB.ts:826-829` | `getLayoutCacheSync` | synchronous mem peek — the fast path that makes a warm page paint without a skeleton |
| A11 | `src/database/localDB.ts:831-847` | `getPageLayoutCache` | mem-first (good) but **no in-flight dedupe** for the miss path |
| A12 | `src/database/quranData.ts:257-278` | `getMushafPageData` | memo-first (good) but **no in-flight dedupe** across concurrent callers |
| A13 | `src/database/quranData.ts:642-674` | `getVersesByPage` | indopak branch reads `indopakPageVerseCache` (`:644`); the **uthmani branch re-queries SQLite every call** (`:664-670`) and only *writes* `versesByPageMemo` (`:672-673`) — a write-only memo |
| A14 | `src/components/quran/MushafPageView.tsx:631-670` | layout cache-load `useLayoutEffect` | mem hit → `cacheState='hit'` + `frozenRef` → single-arithmetic-pass render, zero measurement (the mechanism that already works) |
| A15 | `src/components/quran/MushafPageView.tsx:445, 544-548` | `fontReady` gate (150 ms, once per process) | first-ever page in a session waits 150 ms before the measure pass |
| A16 | `src/components/quran/MushafPageView.tsx:606-620` | reset `useLayoutEffect` | on page/style/width change resets measurement state and forces `cacheState='loading'` |
| A17 | `src/screens/QuranViewScreen.tsx:1130, 1157, 2285` | `InteractionManager.runAfterInteractions` users | layout preload, post-sync refresh, modal open — they queue during a fling and then fire as a burst at momentum end |
| A18 | `src/screens/QuranViewScreen.tsx:1125, 615-620` | `setCanvasData(await mergeChunks(keys))` and `stagePageData`/`stagePageVerses` | create new object identities that flow into every mounted page cell |
| A19 | `src/store/index.ts:26` | `whitelist: ['auth','drawing','sync','settings','audio']` | **`quran` is not persisted** → `textStyle` resets to `'alqalam'` on every cold start |
| A20 | `android/app/src/main/assets/www/indopak_pages.db` + `src/database/localDB.ts:211-287` | shipped read-only IndoPak asset DB (5.19 MB) | IndoPak page reads never touch `quran.db`; they are already off the main connection |
| A21 | `src/database/localDB.ts:14-20` | WAL, `synchronous=NORMAL`, `busy_timeout=3000` | already tuned; not a problem area |
| A22 | `src/components/quran/MushafPageView.tsx:1130` region + `QuranViewScreen` memo usage | `export default memo(MushafPageView)` | the file's own comment says memo is "largely ineffective due to prop identity churn" |

### 2.3 What is already fast (do not "fix" these)

* IndoPak page JSON: shipped asset DB, one small SELECT per page, then memoised. ✔
* Layout rows: normalized (font-size-independent), one-shot vertical fit persisted and replayed. ✔
* Verse rows: in-memory reverse map + per-page memo. ✔
* `initialScrollIndex` landing + memo seeding + `warmPageLayoutFor` (the go-to-page path). ✔
* SQLite pragmas, Hermes, R8. ✔

---

## 3. THE BOTTLENECK MODEL (the five mechanisms)

Ranked by how much wall-clock time they cost on a mid-tier phone, during an IndoPak page swipe.

### M1 — Per-word native views (the hard floor) — *unchanged by any caching work*

Each word is `WordHitArea` (a `Pressable`) wrapping a `Text` (`MushafPageView.tsx:1085-1100`). ~137
words/page → ~300–350 native views, each needing creation, Yoga layout and (for `Text`) native text
measurement. The layout cache removes the *scaling* computation (a JS-side concern) but **nothing**
about view creation. A cache-hit page is still a full native mount.

**Consequence:** every "make the cache better" change has a ceiling. Once the data path is warm,
the remaining cost is *mount*, and only §5 B0/B2/B3/B4/B5 reduce it.

### M2 — Duplicate cold reads during a fling — *the main cause of "sometimes slow"*

`onScroll` (A1) fires at up to 60 Hz and calls, for each warm-target page:

```
getMushafPageData(p, ts)     // memo-first, but no in-flight guard (A12)
getVersesByPage(p, ts)       // indopak: in-memory hit (A13) — cheap
getPageLayoutCache(p, ts,…)  // mem-first, but no in-flight guard (A11)
```

For a **cold** page in the swipe direction, every scroll event starts a *new* SQLite read for the
same `(page, key)`. Over a 400 ms fling that can be 10–30 duplicate `SELECT`s per page, all queued on
the single connection — **ahead of the reads the page currently on screen needs**. The number of
duplicates depends on fling speed and timing, which is exactly why the same swipe is fine once and
bad the next time.

**Fix:** §4 S2 (single-flight + per-gesture dedupe).

### M3 — Every settle re-renders every mounted page

`stagePageData` / `stagePageVerses` (A18) rebuild `pageCache` / `pageVersesCache`, and the canvas
merge rebuilds `canvasData` (A18). Those objects are passed straight down as `pData`, `pVerses`,
`notes`, `highlights`. New identity → `React.memo` fails → **all 7 mounted pages reconcile
(~7 × 137 words) at the exact moment the swipe animation is running.**

**Fix:** §4 S4 (+ S3 for the list plumbing).

### M4 — Allocation churn → GC pauses — *the "fast, fast, fast, SLOW" pattern*

`styles(nightMode)` (A6) is executed **~330 times per page render** (2× per word), and each execution
rebuilds the whole ~35-key `StyleSheet.create` object. That is ~10,000 property writes per page
render, ×7 mounted pages, plus `getThemeColors()` (a fresh 17-key object per call, per page render),
plus ~137 fresh arrow closures (A7) and ~137 `React.Fragment` allocations per render.

**Fix:** §4 S1 (freeze the sheets), S12 (hoist the closures), S3/S4 (less re-rendering = less churn).

### M5 — Background work interleaving with the gesture

Chunk merges (`getChunk` ×1–2 per settle), cloud drawing pulls, the sync watcher's
`getStudentData`, student-data flushes (`saveStudentData`) and the layout preloads (A8/A9) share one
SQLite connection and one JS thread with the page mount. `InteractionManager.runAfterInteractions`
work **accumulates during a fling and then fires in a burst at momentum end** (A17) — precisely when
the landing page is mounting.

**Fix:** §4 S9 (gesture gate), S10 (coalesce), S6 (stop redundant preloads).

---

## 4. CHANGE CATALOGUE — SMALL (each ≤ ~1 hour, no feature risk)

Each item: **what to change · why · expected effect · risk · verify · rollback.**

---

### S1 — Freeze the stylesheets *(highest impact/effort ratio in the repo)*

**Priority:** P0 · **Effort:** 30–60 min · **Risk:** none

**Where:** every `const styles = (…) => StyleSheet.create({…})` factory. Worst offender
`MushafPageView.tsx:1134` (A6). Then `QuranViewScreen.tsx:2685` (A5), `FlowingText.tsx:113`,
`VerseDisplay.tsx:96`, `DashboardScreen.tsx:888`, `BookmarksScreen.tsx:498`, `NotesScreen.tsx:410`,
`MistakesScreen.tsx`, `AlertModal.tsx:89`, `ScreenHeader.tsx:58`, `JuzIndexScreen.tsx:87`,
`LoopSettingsScreen.tsx:332`.

**The change** — keep every call site untouched (no 65-site diff), memoise the *result*:

```ts
// before
const styles = (nightMode: boolean) => StyleSheet.create({ /* ~35 keys */ });

// after
const buildStyles = (nightMode: boolean) => StyleSheet.create({ /* unchanged body */ });
const LIGHT_STYLES = buildStyles(false);
const DARK_STYLES = buildStyles(true);
const styles = (nightMode: boolean) => (nightMode ? DARK_STYLES : LIGHT_STYLES);
```

For factories that also take a theme (`styles(nightMode, theme)`), use a small two-key memo instead:

```ts
const sheetCache = new Map<string, any>();
const styles = (nightMode: boolean, theme: any) => {
  const key = `${nightMode ? 'n' : 'd'}|${theme?.accent ?? ''}|${theme?.bg ?? ''}`;
  let sheet = sheetCache.get(key);
  if (!sheet) { sheet = StyleSheet.create({ /* unchanged body */ }); sheetCache.set(key, sheet); }
  return sheet;
};
```

**Why it helps:** removes ~330 full stylesheet allocations per page render (M4) → less GC → fewer
random hitches. It also makes the objects identity-stable, which helps the memo work in S4.

**Risk:** none. `StyleSheet.create` is a pure transform; the returned styles are identical.
**Verify:** page renders pixel-identical (compare a screenshot before/after at the same page, same
theme, header on and off); perf HUD shows fewer JS long tasks during a 10-page swipe.
**Rollback:** revert the 3 lines per file.

---

### S2 — Single-flight + per-gesture dedupe on the page warm path *(the "sometimes slow" fix)*

**Priority:** P0 · **Effort:** 1–2 h · **Risk:** very low

**Where:** `src/database/quranData.ts:257` (`getMushafPageData`),
`src/database/localDB.ts:831` (`getPageLayoutCache`), `src/screens/QuranViewScreen.tsx:2400-2435`
(the `onScroll` warm loop).

**2a — in-flight guard in `getMushafPageData`** (mirror the pattern already used by
`ensuredPageQueues` at `quranData.ts:281`):

```ts
const pageInFlight = new Map<string, Promise<any>>();

export const getMushafPageData = async (pageNum: number, mushaf?: string) => {
  const indopak = isIndopakStyle(mushaf);
  const memoKey = `${indopak ? 'indopak' : 'uthmani'}:${pageNum}`;
  const hit = mushafPageMemo.get(memoKey);
  if (hit) return hit;
  const existing = pageInFlight.get(memoKey);
  if (existing) return existing;                     // ← new: join the in-flight read
  const job = (async () => { /* existing body, unchanged */ })()
    .finally(() => { pageInFlight.delete(memoKey); });
  pageInFlight.set(memoKey, job);
  return job;
};
```

**2b — same guard in `getPageLayoutCache`** around the SELECT at `localDB.ts:840-846`.

**2c — per-gesture dedupe in the reader.** Add
`const warmedThisGestureRef = useRef<Set<string>>(new Set());`, clear it in a new
`onScrollBeginDrag` handler, and inside the warm loop skip a page whose key
`` `${p}|${ts}|${sw}` `` is already in the set (add it when you warm). Also cap the set (e.g. skip
warming once it holds > 24 keys) so a very long fling cannot grow work without bound.

**Why it helps:** a fling stops queueing 10–30 duplicate SELECTs for the same cold page on the single
SQLite connection (M2). This is the most likely single cause of the inconsistency you feel.
**Risk:** very low — same results, shared promises. The only care needed: do **not** let the guard
suppress the *user-facing* load (`ensurePageLoaded` / `ensurePageVersesLoaded` keep their own guards
and must stay untouched).
**Verify:** with the perf HUD (§7), count `executeSql` calls during a fixed 10-page fling — expect a
large drop; the landing page's paint time should become consistent rather than occasionally bad.
**Rollback:** remove the maps / the Set.

---

### S3 — Memoize the FlatList plumbing

**Priority:** P0 · **Effort:** 20 min · **Risk:** none

**Where:** `src/screens/QuranViewScreen.tsx:2387-2399`.

**The change:**

```ts
const pageListData = useMemo(
  () => (splitOn ? pagePairsFor(pageNumbers.length) : pageNumbers),
  [splitOn, pageNumbers],
);
const pageKeyExtractor = useCallback(
  (item: any) => (splitOn ? String(item[0]) : String(item)),
  [splitOn],
);
const getPageItemLayout = useCallback(
  (_data: any, index: number) => ({ length: winW, offset: winW * index, index }),
  [winW],
);
```

then `data={pageListData} keyExtractor={pageKeyExtractor} getItemLayout={getPageItemLayout}`.

**Why it helps:** `pagePairsFor(...)` currently allocates a new array on **every** render of a screen
that re-renders on every cache fill and page settle; VirtualizedList treats a new `data` identity as
new data and re-runs its cell computation (M3).
**Risk:** none — identical values, stable identities.
**Verify:** `React DevTools` profiler or the perf HUD: fewer `renderItem` invocations per settle.

---

### S4 — Make `MushafPageView`'s `memo` actually work

**Priority:** P0 · **Effort:** 1–2 h · **Risk:** medium (prop-identity bugs hide real changes)

**Where:** the props passed at `QuranViewScreen.tsx:2471-2500` (`SpreadItem` and `PageCell`), and the
canvas/merge state at `:1125`, `:615-620`.

**The change:** memoize every non-primitive that crosses that boundary so identity changes only when
the contents change:

```ts
// notes / highlights / bookmarks — one memo each, invalidated by their source object only
const readerNotes = useMemo(() => canvasData.notes, [canvasData.notes]);
const readerHighlights = useMemo(() => captureHighlights, [captureHighlights]);
const readerBookmarks = useMemo(() => captureBookmarks, [captureBookmarks]);

// readingMarkDate is currently recomputed as a string expression inline — hoist it
const readingMarkDate = useMemo(
  () => studentData?.lastRead?.updatedAt || studentData?.lastRead?.createdAt || null,
  [studentData?.lastRead?.updatedAt, studentData?.lastRead?.createdAt],
);
```

Also note `captureHighlights` is computed in render as
`isCapturing && !shareMistakes ? {} : canvasData.highlights` — the `{}` literal is a new object every
render while capturing. Use a module-level `const EMPTY = {}`.

**Why it helps:** a page settle or cache fill currently re-renders **all ~7 mounted mushaf trees**;
after this it re-renders only the cell whose data actually changed (M3), which is what removes the
"swipe stutter that happens 300 ms after the swipe".
**Risk:** if a memo is wrong, a highlight/note stops appearing on a neighbouring pre-rendered page.
That is the thing to test explicitly: tap a word (or add a note), then swipe one page away and back
while the neighbour page is still mounted — the mark must be there.
**Verify:** React DevTools profiler — `MushafPageView` render count per settle; smoke list §9.

---

### S5 — `allowFontScaling={false}` on mushaf word `Text`s

**Priority:** P2 · **Effort:** 10 min · **Risk:** very low

**Where:** the word `Text` in `MushafPageView.tsx` (~`:1095`), the fallback verse `Text`, the ta'awwud
and basmala `Text`s.

**The change:** add `allowFontScaling={false}` next to the existing `maxFontSizeMultiplier={1}`.

**Why it helps:** documented RN performance guidance — with `allowFontScaling` off, RN skips the
per-node font-scale lookup. On a page with ~137 text nodes this is measurable.
**Risk:** users who raise the system font size no longer scale the mushaf — they already cannot,
because `maxFontSizeMultiplier={1}` clamps it. Visual output is byte-identical.
**Verify:** screenshot comparison at the same page/theme.

---

### S6 — Stop re-running the layout preload on every mount

**Priority:** P1 · **Effort:** 30 min · **Risk:** low

**Where:** `src/database/localDB.ts:805-819` (A9), `src/components/quran/MushafPageView.tsx:664-667`
(A8).

**The change (a)** — early-out when the whole range is already in memory:

```ts
export const preloadPageLayoutCacheRange = async (first, last, textStyle, headerVisible, sparse, screenW) => {
  for (let p = first; p <= last; p++) {
    if (layoutCacheMem.get(memKey(p, textStyle, headerVisible, sparse, screenW)) === undefined) {
      // at least one key missing → fall through to the SQL read
      try {
        const r = await getDB().executeSql(/* unchanged query */);
        for (let i = 0; i < r[0].rows.length; i++) { /* unchanged memStore */ }
      } catch {}
      return;
    }
  }
  // every key already warm — zero DB traffic
};
```

**The change (b)** — narrow the per-mount range from ±4 to ±2 at `MushafPageView.tsx:666`, and skip
the call entirely if this instance already warmed a range covering `pageNum` (a per-instance
`` `started|end|keyW|headerVisible|sparse|textStyle` `` stamp guard).

**Why it helps:** today every mounted page issues a 9-row range query, on every reader open and page
change (M5). The layout rows for the ±2 window are already warmed by the reader's own paths, so most
of these queries return rows that were already in memory.
**Risk:** low. If a row is genuinely missing, the page falls back to the async
`getPageLayoutCache` read it uses today (A11) — the same latency you currently have, never worse.
**Verify:** perf HUD `executeSql` count on reader open should drop by roughly the number of mounted
pages (5–7 queries).

---

### S7 — Read the memo you are already writing

**Priority:** P1 · **Effort:** 10 min · **Risk:** none

**Where:** `src/database/quranData.ts:642-674` (A13) — specifically the uthmani branch at `:664-673`.

**The change:** at the top of the uthmani branch, before the SELECT:

```ts
const memoKey = `uthmani:${pageNum}`;
const memoHit = versesByPageMemo.get(memoKey);
if (memoHit) return memoHit;
```

(The write at `:672-673` already uses exactly that key.)

**Why it helps:** `versesByPageMemo` is currently **write-only** — every uthmani call re-queries
SQLite. IndoPak users hit the in-memory path; uthmani users (and every warm/cold path that touches
both) pay a real query each time, including from the 60 Hz `onScroll` loop (A1).
**Risk:** none — the memo is only populated from a completed read of the same data.
**Verify:** uthmani mode: `executeSql` count during a fling drops; pages still show correct verses.

---

### S8 — Retune virtualization for feel, not throughput

**Priority:** P1 · **Effort:** 20 min · **Risk:** low (one-line reverts)

**Where:** `src/screens/QuranViewScreen.tsx:2398-2399` (A2).

**The change:** `initialNumToRender` 5 → **2**, `maxToRenderPerBatch` 5 → **3**,
`updateCellsBatchingPeriod` 16 → **40**, keep `windowSize={7}` and
`removeClippedSubviews={false}`.

**Why it helps:** today the first commit can render up to 5 whole pages (~1600 views) while the reader
is still opening, and subsequent batches are scheduled every 16 ms — i.e. inside the swipe animation.
Fewer initial cells = faster reader first paint; slower batching = batches land between gestures.
**Risk:** with the inverted list, page 1 is index 0, so an `initialNumToRender` of 2 still covers the
visible cell on a normal mount; with `initialScrollIndex` (go-to-page) RN renders from that index. If
a very fast first fling shows a skeleton, raise `initialNumToRender` back to 3.
**Verify:** reader-open time to first painted page; swipe 10 pages fast and look for skeleton flashes.

---

### S9 — A global "gesture in flight" gate

**Priority:** P1 · **Effort:** 1–2 h · **Risk:** low (must not gate user-facing loads)

**Where:** new tiny module `src/utils/readerGesture.ts`; consumers:

* `MushafPageView.tsx:664` (layout preload),
* `QuranViewScreen.tsx:1130` (canvas chunk merge),
* `QuranViewScreen.tsx:1157` (post-sync refresh),
* `QuranViewScreen.tsx:1066` `refreshCloudDrawings` (cloud pull),
* the sync watcher at `:1140-1190`.

```ts
// src/utils/readerGesture.ts
let scrolling = false;
export const setReaderScrolling = (v: boolean) => { scrolling = v; };
export const isReaderScrolling = () => scrolling;
```

Set it `true` in a new `onScrollBeginDrag` on the page FlatList (`:2387` region), and `false` in
`onMomentumScrollEnd` (and in `onScrollEndDrag` for the no-momentum case, with a small timeout).

**Why it helps:** background SQLite/JS work currently interleaves with the frame that mounts the page
you are looking at (M5). This is the direct fix for "fine when I swipe slowly, bad when I flick".
**Risk:** the gated work must still run — each consumer should *defer* (set a flag / retry after the
gesture) rather than drop. **Never** gate `ensurePageLoaded`, `ensurePageVersesLoaded`,
`getMushafPageData` or `getPageLayoutCache` — a gate there would show a spinner forever.
**Verify:** swipe continuously for 10 s; the deferred merge/refresh work must still complete once you
stop (check a note/highlight you added just before).

---

### S10 — Coalesce the `runAfterInteractions` queue

**Priority:** P2 · **Effort:** 1 h · **Risk:** low

**Where:** `QuranViewScreen.tsx:1130`, `:1157`, `:2285`; `MushafPageView.tsx:664` (A17).

**The change:** a tiny module-level job runner with last-write-wins semantics per job key
(`layout-preload`, `canvas-merge`, `sync-refresh`), so five queued merges collapse into one run of the
latest. `InteractionManager.runAfterInteractions` alone does not coalesce.

**Why it helps:** during a fling these callbacks stack up and then all execute at momentum end —
exactly when the landing page mounts (M5).
**Risk:** low; make sure a cancelled job that *must* run (the final canvas merge for the settled page)
is re-queued rather than dropped.

---

### S11 — Persist `textStyle`

**Priority:** P2 · **Effort:** 30 min · **Risk:** small, intentional behaviour change

**Where:** `src/store/index.ts:26` (A19) — add `'quran'` to the persist whitelist; then, in
`src/store/quranSlice.ts`, decide which quran fields are safe to persist (at minimum `textStyle`,
`fontSize`, `showTranslation`, `readingMode`; explicitly **not** `currentSurahId`, `verses`,
`flashingVerse`, `surahNames` — those are rebuilt from SQLite).

**Why it helps:** every cold start currently resets the font to `'alqalam'`. A user who prefers
`lateef` gets a whole-book cache flush + full re-derivation on their first action. It also makes the
layout-cache key stable across launches (rows are per-textStyle, so the right rows get used
immediately).
**Risk:** persisting redux state means a bad value survives a reinstall-free update — clamp
`textStyle` against the known list on rehydrate, and never persist the transient fields above.
**Verify:** pick `lateef`, kill the app, reopen — the reader must open in `lateef` with no visible
re-measure.

---

### S12 — Hoist per-word work out of the render loop

**Priority:** P2 · **Effort:** 1–2 h · **Risk:** low (step 1), medium (step 2)

**Where:** `src/components/quran/MushafPageView.tsx:1094` (A7).

**Step 1 (safe, do this):** precompute the expected word count per line once:

```ts
const expectedPerLine = useMemo(
  () => (pageData?.lines || []).map((l: any) =>
    ((l.words || []) as any[]).filter((w: any) => hasArabicLetters(stripPua(w.word))).length),
  [pageData],
);
// …
onMeasured={cacheState === 'miss' ? (w) => handleWordMeasured(lineIdx, wordIdx, w, expectedPerLine[lineIdx]) : undefined}
```

This removes the per-fire `filter` + `stripPua` + regex sweep over the line's words — today's callback
does O(words × line length) regex work during the whole measure pass.

**Step 2 (only if step 1 is not enough):** cache the per-word handler in a ref map instead of
allocating an arrow per word per render. **Prerequisite:** `handleWordMeasured` currently reads
`normFontSize`, `innerH`, `headerVisible`, `pitchScale`, `fontScale` from the render closure
(`:695-710`). Before caching handlers you must mirror those into refs (the file already uses this
pattern — `textStyleRef`, `drawingGestureActiveRef`) and read the refs inside
`handleWordMeasured`, otherwise a cached handler will capture a stale fit and a page will render at
the wrong scale. Clear the handler map in the reset `useLayoutEffect` (`:606`).

**Why it helps:** removes ~137 closure allocations + O(words²) regex work per page render (M4).
**Verify:** a cache-miss page (`cacheState === 'miss'`) must still settle with the same single scaling
snap, and the persisted layout row must be identical (compare the row's `lines` array before/after).

---

### S13 — Experiment: hardware layer on non-current pages

**Priority:** P3 (opt-in experiment) · **Effort:** 30 min · **Risk:** GPU memory

**Where:** the page cell container in `QuranViewScreen.tsx` (`PageCell`, ~`:264-268`) — apply
`renderToHardwareTextureAndroid={!isCurrentPage}`.

**Why it might help:** the cell is rasterised to one texture instead of ~330 views being composited
during the scroll.
**Risk:** 6 mounted neighbour pages × one screen-sized layer is a lot of GPU memory on a cheap phone;
it can backfire. Measure, and keep it only on the *preceding* page, or drop it.
**Verify:** perf HUD long-task count + a visual check for blurry/black frames after long swiping
sessions.

---

### S14 — Ship a dev-only performance HUD (do this first)

**Priority:** P0 · **Effort:** 2–3 h · **Risk:** none (dev only)

**Where:** new `src/utils/perfProbe.ts` + a small overlay rendered by `QuranViewScreen` when
`__DEV__` or `settings.showPerfHud`.

**Record, per page swipe:**

| Metric | How |
|---|---|
| `settle → page painted` ms | `performance.now()` at `onMomentumScrollEnd`, again in a `requestAnimationFrame` after the target `PageCell` commits |
| page mount ms | `performance.now()` in `MushafPageView`'s mount effect → next frame |
| layout cache verdict | `hit` / `miss` for the landed page (you already have `cacheState`) |
| `executeSql` calls per gesture | wrap/count in `localDB.getDB()` behind `__DEV__` |
| JS long tasks | `InteractionManager` is not enough — use a simple loop-timer that logs when a frame exceeds 50 ms |

**Why:** the next round of optimisation must be measured. Every item above has an expected effect;
this is how you confirm it on the *worst* phone you own, not the best.
**Output format:** on-screen text like `p254 hit · mount 41ms · settle→paint 63ms · sql 6 · long×1`.

---

### S15 — Consider dropping `armeabi-v7a`

**Priority:** P3 (business decision) · **Effort:** 5 min · **Risk:** excludes 32-bit-only devices

**Where:** `android/gradle.properties:38` → `reactNativeArchitectures=armeabi-v7a,arm64-v8a`.

**Why:** Play serves the 32-bit split to 32-bit-only devices, and those are the slowest phones in your
install base. If you cannot make 32-bit feel good, the honest options are to drop it (Play requires
64-bit support anyway) or to accept that segment will always feel worse.
**Verify:** Play Console → device breakdown, before deciding.

---

## 5. CHANGE CATALOGUE — BIG (projects, not patches)

Each has a design sketch, the mechanism it attacks, effort, feature risk, and acceptance criteria.

---

### B0 — Ring buffer: never mount a page while a gesture is active

**Attacks:** M1 (the mount cost moves off the critical path) · **Effort:** 2–4 days · **Feature risk:** medium
**This is the highest benefit ÷ effort of the big items — do this one first.**

**Design.** Replace virtualization for `readingMode === 'page'` with a **3-slot ring** (5 slots when
`splitOn`, since a spread occupies one slot per side):

```
slots = [
  { id: 'a', page: current - 1 },
  { id: 'b', page: current },        // visible, centred
  { id: 'c', page: current + 1 },    // pre-built, off-screen
]
```

* Mount all three slots once. Keep them mounted for the life of the reader.
* A swipe shifts the container's translateX (the existing `snapToInterval` gesture feel can be kept
  by driving a `PanGestureHandler` + `Animated` value, or by keeping the FlatList but with
  `windowSize` covering only 3 items — see the note below).
* On settle: shift the ring by one, and **repopulate the slot that fell off the far side** with
  `current ± 2`. That repopulation is the expensive step (new page JSON → new views), and it happens
  only when `!isReaderScrolling()` (S9) or after a short idle (e.g. 250 ms after momentum end).
* Deep links / go-to-page / surah change: reset the ring around the target instead of animating a
  shift (that is `landOnPage`'s job today).
* `initialScrollIndex`, `anchorFromIndex`, `pairIndexForPage` stay as pure helpers — only the
  container changes.

**Why it works:** today the destination page is *created* during the gesture (M1). Here the page you
are moving towards is already fully built and painted off-screen, so the swipe only moves pixels.
The cost is paid during idle reading time, when the user is not interacting.

**Minimum viable version (if the full rewrite is too much now):** keep the FlatList, but make
repopulation explicit — on settle, immediately warm (data + layout row) for `current ± 2` **and**
pause all other background work (S9), while raising `windowSize` so the neighbour stays mounted.
That is 20% of the work and captures part of the benefit. Do the full ring only if the MVP is not
enough.

**Feature risk & mitigation:** the paging feel (snap, overscroll, RTL direction, inverted semantics)
must be re-verified frame by frame against today's build. Keep the FlatList path behind a flag
(`settings.readerPager = 'list' | 'ring'`) so you can compare on the same device and roll back
instantly.

**Acceptance:** a 10-page fast fling in IndoPak page mode shows no skeleton on any page after the
first; settle→paint for ±1 pages **< 50 ms** on the worst test device.

---

### B1 — Native pager instead of the paging FlatList

**Attacks:** M1 + M5 (no JS scroll events at all) · **Effort:** 3–5 days · **Feature risk:** medium

**Design.** Replace the page-mode `FlatList` with `react-native-pager-view` (Android ViewPager2):

* items = pages (or spread pairs in split mode), `initialPage` from the deep-link page,
  `offscreenPageLimit={1}` (2 in split mode),
* `onPageSelected` replaces the whole `onScroll` + `onMomentumScrollEnd` offset reconstruction,
* paging happens on the **native UI thread**, so a fling cannot be starved by JS work,
* **deletes** a whole class of code: `lastScrollOffsetRef` self-validation, the stale-offset
  "randomly went to Al-Fatiha" guard, `snapToInterval`, `decelerationRate`,
  `disableIntervalMomentum`, `onScrollToIndexFailed`, `programmaticScrollRef`.

**Why it works:** the scroll/paging animation no longer depends on the JS thread keeping up. Keep the
existing page components unchanged — only the container changes.

**Risks:** verify the library version supports RN 0.72 with the old architecture before starting;
`offscreenPageLimit` semantics differ from `windowSize` (it controls *mounted* pages — pair it with
B0's idle-repopulation discipline, otherwise you mount a page synchronously on the JS thread during
`onPageSelected`, which is the same problem in a new costume); edge-tap Pressables and the header
toggle must still receive touches; split mode needs spreads as single items.

**Acceptance:** identical smoke list, zero scroll-position bugs, page turn fully smooth on the worst
device.

---

### B2 — Ship precomputed per-page word geometry *(the prerequisite for B3)*

**Attacks:** M1's measure pass and the 150 ms font gate — a **first-ever** visit becomes as fast as a
re-visit · **Effort:** 3–6 days · **Feature risk:** low-medium

**Insight.** The layout cache already stores **normalised, font-size-independent** sums
(`MushafPageView.tsx` header comment + `localDB.ts:759-786`). Word advance widths expressed in **em**
are effectively device-independent for a fixed font file, so the measurement your device performs can
instead be computed **once, offline**.

**Design.**

1. Offline generator (`scripts/build_page_geometry.mjs`, mirroring `scripts/build_indopak_db.mjs`):
   for each of the 611 IndoPak pages and each supported font (`lateef`, `alqalam`, `saleem`), compute
   per line: the ordered word advance widths in em, plus per-line maxima.
2. Store in a table shipped with the asset DB (or a packed binary):
   `page_geometry(pageNumber, textStyle, sparse, geometry BLOB)`.
3. Loader: a single-flight, deferred read that fills an in-memory map (same pattern as
   `getIndopakPageIndex`).
4. In `MushafPageView`, extend the cache-load effect: if the geometry row is present, enter the
   existing **cache-hit path** (`cacheState='hit'`, `frozenRef=true`, arithmetic `scaleForLine`)
   **without ever rendering the measure pass**. No `onLayout` storm, no 150 ms gate, no `miss`.
5. Keep the on-device measure path as the fallback when geometry is missing (unknown font, new width
   class, corrupt asset). Nothing is lost if the generator is wrong — you simply fall back to today's
   behaviour.

**Why it works:** removes the last per-page cold cost that is not view creation (M1's measurement
half), so the **first** time a user opens page 400 it renders in one pass like a re-visit.

**Risks:** metric drift between the generation environment and the device. Mitigation: the existing
per-line clamp (`scaleForLine`, `(lineW-12)/total`) already absorbs small overflow, and the generated
row is only a *starting point* — you can validate on first use and persist a corrected row exactly as
today (`savePageLayoutCache`), so any drift self-heals after one visit per device.

**Acceptance:** first-ever visit to a never-opened page in IndoPak page mode: `cacheState` is `hit`,
no `miss` pass occurs, settle→paint equal to a warm page (within 20%).

---

### B3 — Rasterize pages, overlay the interactions *(the "AAA instant" path)*

**Attacks:** M1 completely — one texture per page instead of ~330 views · **Effort:** 1–3 weeks · **Feature risk:** high

**Design.**

* Generate one image per page at device DPI — either **build-time** (bake into the asset DB; ~611
  WebP at ~40–80 KB ≈ 25–50 MB) or **on first visit** via the `react-native-view-shot` you already
  ship, cached to the documents directory, indexed in SQLite.
* Cache key must include everything that changes the pixels:
  `page | textStyle | pageWidth | dpi | colourTheme | nightMode | layoutVer`. Bump on font update.
* Render the page as **one `Image`** (plus the existing `OrnamentalFrame` or a baked-in frame), then
  draw everything interactive on top from B2's geometry:
  * **word taps** — one full-page `Pressable`, hit-test the touch against per-word rectangles
    (kept in JS, warm, O(words) scan or a per-line binary search),
  * **mistake highlights** — underline/stroke rects drawn via `react-native-svg` or the existing
    `StaticDrawingOverlay` pattern, not per-word text styling,
  * **verse badges** — small `View`s (only ~10–20 per page, cheap),
  * **bookmark ribbon / note badges / reading mark** — already separate overlay elements today,
  * **share capture** — compose the image + overlays in `viewShotRef` exactly as today,
  * **drawings** — unchanged (they already render as an overlay, not as text styling).
* `page_layout_cache` keeps existing; geometry gains x-offsets per word.

**Why it works:** a flip becomes a decode of one cached texture. This is how the "instant" Quran apps
feel instant.

**Feature risk:** the word-tap experience is the core of the product (tap a word → it is a mistake).
Replacing 137 `Pressable`s with JS hit-testing means you must preserve: the dead-band behaviour
(`WORD_TAP_FRACTION` centre-band maths), long-press → verse menu with `pageY`, and the flash
animation. Mitigate by first implementing and testing the hit-test path **alongside** the current
renderer behind a flag, with a debug mode that draws the computed word rectangles on screen.

**Acceptance:** with the raster path on, the full §9 smoke list passes; fling speed is at 60 fps with
no skeleton; images invalidate correctly on font/theme/width change.

---

### B4 — One `Text` per line, words as nested `Text`

**Attacks:** M1 partially (~330 views → ~40) · **Effort:** 1–2 weeks · **Feature risk:** medium-high

**Design.** Render each of the 15 lines as a single native text run; each word becomes a nested
`<Text onPress={…}>` inside it. RTL ordering is handled by the existing `row-reverse` container plus
`writingDirection`/`textAlign`.

**What you gain:** one Yoga node + one native text measurement per line instead of per word — the
single largest reduction in mount cost that keeps live, editable text.

**What you lose / must re-engineer:**
* `WordHitArea`'s measured-width centre-band maths (nested `Text` does not expose per-word layout) →
  use B2 geometry for hit-testing,
* per-word background styling (`backgroundColor` on nested `Text` behaves inconsistently on Android) →
  draw highlights in the overlay instead,
* Android nested-`Text` press accuracy and long-press position → verify on a real device before
  committing.

**Recommendation:** only after B2 (geometry) is in place — B2 makes this tractable, and B2 alone
already delivers most of the perceived speed-up for far less risk.

---

### B5 — Native mushaf renderer (long game)

**Attacks:** M1 permanently and removes the JS render pass from page display · **Effort:** 3–6 weeks · **Feature risk:** high

**Design.** An Android custom `View` that takes page JSON + a per-page layout row, lays the 15 lines
out with `StaticLayout` (the same font files you already bundle), draws to a `Canvas`, and reports
word rectangles to JS (`onWordRects`) for taps, highlights and hit-testing. Expose it to JS as a
`requireNativeComponent` with the props the current `MushafPageView` already receives. Keep the
existing JS component as the iOS/fallback implementation behind the same prop interface.

**Why:** 15 draw calls instead of 330 view mounts; page display cost becomes tens of milliseconds
regardless of device. This is the "AAA" endpoint.

**Risks:** duplicate layout logic (padding, sparse boost, fit) between the native view and the JS
renderer — keep the JS rules as the source of truth and validate the native output against them;
needs an Android developer; the measurement/geometry work of B2 is a prerequisite, not an
alternative.

---

### B6 — RN 0.7x + New Architecture (concurrent rendering), later

**Attacks:** M3/M5 architecturally · **Effort:** migration-sized · **Feature risk:** high

**Why:** with concurrent rendering you can mark the neighbour-page rebuild as a **transition** — the
swipe stays urgent, the next page prepares in the background. That is the platform-level version of
B0. It also unlocks `react-native-screens` freeze-inactive, cheaper view traversal, and a maintained
toolchain (Hermes improvements, bugfixes).

**Note:** do not do this *for* page speed alone; do it as a planned migration (RN 0.72 → current,
old arch → new arch, library-by-library), and only after the small items and B0 have been shipped so
you are not changing two variables at once.

---

## 6. EXECUTION ORDER (with gates)

| Phase | Items | Gate to pass before moving on |
|---|---|---|
| **0. Instrument** | S14 | HUD shows numbers for a 10-page IndoPak fling on the worst test device. Record the baseline here — everything else is compared to it. |
| **1. Cheap pure wins** | S1, S3, S7, S6, S3b (list plumbing) | Smoke list §9 green. HUD: fewer long tasks, fewer `executeSql`, identical visuals (screenshot diff). |
| **2. Attack the inconsistency** | S2, S4, S12 (step 1) | Fling `executeSql` count drops sharply; settle→paint variance (max − min) shrinks. Smoke list green. |
| **3. Feel + contention** | S8, S9, S10, S5, S11 | Swipe 10 pages fast on the worst device: no skeleton, no post-fling freeze. Reader opens in the user's font. |
| **4. Structural** | B0 (ring buffer, flagged) | ±1 page settle→paint < 50 ms; smoke list green with the flag on. |
| **5. Optional structural** | B1 (native pager) | Same smoke list, smoother than B0 or keep B0 only. |
| **6. Cold-page elimination** | B2 (shipped geometry) | A never-visited page lands as a `hit` with no measure pass. |
| **7. Ambition** | B3 (rasterize) → B5 (native view) → B6 (RN upgrade) | Each one behind a flag until the smoke list is green on real hardware. |

**Do not skip Phase 0.** The reason the last few rounds of optimisation "didn't help" is that there
was no measurement telling you which of M1–M5 was dominant on the target device. Phases 1–3 are cheap
and reversible; if they get you 60–70% of the way, B0 is the only big item you need.

---

## 7. MEASUREMENT PROTOCOL (so the next round is not guesswork)

1. **Devices:** one mid-tier Android phone (not an emulator, not a flagship) — this is the target.
   Optionally one low-end to see the floor.
2. **Scenario A — cold reader open:** app cold start → open a student → reader in IndoPak page mode at
   a random page. Record: time to first painted page, `cacheState`, mount ms.
3. **Scenario B — 10-page fast fling forward, then 10 back.** Record per landed page: settle→paint,
   mount ms, cache verdict, `executeSql` count for the whole gesture, long tasks (>50 ms).
4. **Scenario C — repeat B 5 times.** The metric that matters most is **variance**
   (`max − min` settle→paint): your complaint is inconsistency, so a change that lowers the max is
   worth more than one that lowers the average.
5. **Scenario D — first-ever visit to 10 never-opened pages** (jump to Juz 20, swipe around).
   This is the B2/B3 target metric.
6. Keep a small table in this file (or a sibling `PERF_RESULTS.md`) with one row per build and the
   numbers for A–D. That table is what tells you whether a change actually worked.

**Expected rough shape after Phases 1–3** (mid-tier, IndoPak page mode): a warm ±1 flip should land
comfortably under ~80 ms with no skeleton; ±2..±10 significantly better than today; a *cold* page
(first visit) remains the slow case until B2. If after Phase 3 a cold page is still >400 ms, go
straight to B2; if warm flips are still janky, the problem is M1 and only B0/B1 helps.

---

## 8. PIPELINE MAP (context for whoever implements this)

**Opening the reader (go-to-page / resume — already fast):**

```
StudentHub / Dashboard  →navigation→  QuranViewScreen { page }
  initialLandPage (QuranViewScreen.tsx:330)
  initialSeed: getMemoizedPageData + getMemoizedVersesByPage  →  pageCache/pageVersesCache (sync)
  initialScrollIndex (:2389) → FlatList starts at the target cell
  landOnPage (:747): stamp programmaticScroll → setSettledPage → scrollToIndex (sync, getItemLayout)
                     → await ensurePageLoaded → warmPageLayoutFor (layout row into layoutCacheMem)
  cancelStartupPrefetch() on mount (:350)
```

**A page mount (what actually happens per page):**

```
PageCell (memo) → MushafPageView
  reset useLayoutEffect (:606)            → cacheState='loading'
  cache-load useLayoutEffect (:631)
      getLayoutCacheSync  → hit  → frozenRef=true, cacheState='hit'  →  ⚡ single-pass arithmetic render
                          → miss → SQLite getPageLayoutCache → 'miss'
      runAfterInteractions → preloadPageLayoutCacheRange(±4)   ← A8/A9, every mount
  if 'miss': wait fontReady (150 ms once/process, A15) + innerH (onBoxLayout)
      render lines at scale 1 → ~137 WordHitArea onLayout callbacks → handleWordMeasured (:695)
      → all lines complete → persist row (savePageLayoutCache) → ONE scaling snap → frozen
  render: 15 lines × (1 Pressable + 1 Text per word) + badges + OrnamentalFrame (SVG) + pills
```

**Swipe (the slow path):**

```
onScroll (16 ms throttle, :2400)
   idx → targetP; direction from offset delta
   for 3–5 pages (+ partners): getMushafPageData, getVersesByPage, getPageLayoutCache   ← A1/M2
   (no dedupe, no in-flight guard → duplicate cold SELECTs)
   FlatList windows mounts new cells DURING the gesture                                    ← M1
onMomentumScrollEnd (:2436)
   self-validate offset → setCurrentPageNum/headerPage → 120 ms settle timer → setSettledPage
   ensurePageLoaded(target) + ensurePageVersesLoaded(target) + prefetchPartner
   canvas chunk merge (getChunk ×1–2) behind runAfterInteractions                          ← M5
   lastRead save flush
```

**Data sources (already fast — do not rework):**

```
IndoPak pages : android/app/src/main/assets/www/indopak_pages.db  (read-only asset DB, localDB:211-287)
                → quranData.getIndopakPageFromBundle → indopakPagesByNum (lazy per-page index)
IndoPak verses: src/assets/data/indopak_verse_pages.json (85 KB) → reverse map page → verse keys
Layout rows   : quran.db page_layout_cache (normalized sums + one-shot fit), mem-first
Student data  : quran.db student_data_cache chunks (page_N / surah_N) — sync pipeline, DO NOT TOUCH
```

---

## 9. SMOKE LIST — run after EVERY item, on a real phone, in IndoPak page mode

Visual/behavioural:

1. Reader opens at the right page (resume / go-to-page / deep link).
2. Swipe 10 pages forward and 10 back: no skeleton on warm pages, correct page numbers in the pills,
   header surah name updates.
3. Word **tap** toggles a mistake highlight — centre-band behaviour unchanged (tap a word margin: it
   must not highlight).
4. Word **long-press** → verse menu appears at the finger; every menu action works (bookmark, note,
   record, copy, reading mark).
5. Verse **badge tap** → same menu; bookmarked badge turns gold; note icon appears when a note exists.
6. Reading mark: ribbon appears on the correct page, filled state + date badge.
7. Highlight/note/bookmark made on page N appears **instantly** on the neighbouring pre-rendered page
   while swiping (this is the S4 regression test).
8. Drawings: open the toolbar, draw, close, reopen — strokes persist; split mode split-origin maths
   still correct.
9. Share capture: page image includes frame, mistakes, bookmarks, drawings per the toggles.
10. Split/spread mode toggle (tablet or wide window): pairs correct, spread pill works.
11. Uthmani ⇄ IndoPak switch: no blank pages, no wrong page numbers (604 vs 611).
12. Night mode + the three colour themes: no black-on-black, frame/badges correct.
13. Header hide/show: layout re-fits, no clipped bottom line.
14. Audio: play from a verse, page turns, player bar; audio still resumes after navigation.
15. Back button + edge tap + hardware back: no stuck modal, no double pop.
16. Rotation (if supported) and cold start after force-stop.

Performance gates per phase: see §7.

---

## 10. OPEN QUESTIONS FOR THE OWNER

1. **APK/AAB size budget** — B3 (rasterised pages) adds ~25–50 MB to the download if baked in. Is
   that acceptable, or should pages be downloaded on first run instead?
2. **32-bit devices** — can we drop `armeabi-v7a` (Play requires 64-bit anyway), or is that segment
   important enough that we must optimise for it?
3. **Worst-case device** — which physical phone should be the target for all measurements? "Feels
   fast on my phone" is how the current plateau happened.
4. **Big-item appetite** — is a flagged rewrite of the page container (B0) acceptable for the next
   release, or must this release ship only zero-risk items (Phases 0–3)?
5. **Font flexibility** — is the IndoPak mushaf font fixed (one font), or must every page work
   perfectly in all four fonts? B2's geometry table is per-font, so this decides the generator's
   scope.

---

## APPENDIX A — the analysis as delivered (original summary)

> **The actual bottleneck.** Your data layer is already fast. The page flip is slow because of the
> *renderer and the JS thread*:
>
> - I measured your shipped asset: **611 IndoPak pages, ~137 words each (max 176), 15 lines each**.
>   Each word is its own `Pressable` + its own `Text`, so **one page = ~300–350 native views and
>   ~137 text measurements**. The layout cache removes the *scaling* pass — it cannot remove view
>   creation. That's the plateau you hit: no caching change can move this number.
> - Your background prefetch is **deliberately disabled** (`prefetchAround` and `warmNearPages` are
>   empty stubs), so instead `onScroll` warms 3–5 pages **every 16 ms**, and `getMushafPageData` /
>   `getPageLayoutCache` have **no in-flight guard** → a cold page in the swipe direction queues the
>   *same* SQLite read 10–30 times on your single connection, ahead of the page you're actually
>   looking at.
> - Every page settle creates new identities for `pageCache` / `canvasData` / `notes` /
>   `highlights` → **all 7 mounted pages re-render** (MushafPageView's own comment admits its
>   `memo()` is "largely ineffective").
> - `styles(nightMode)` is a `StyleSheet.create` factory called **65 times, twice inside the
>   per-word map** → **~330 full stylesheet rebuilds per page render**, ~10k throwaway property
>   writes. That plus a fresh arrow closure per word is your GC stutter — the textbook
>   "fast fast fast SLOW".
>
> **Small changes (all cheap, all safe)**
>
> 1. **Freeze the stylesheets.** Replace `styles(nightMode)` with two module constants built once, in
>    `MushafPageView` first (2 calls × 137 words), then `QuranViewScreen`, `FlowingText`,
>    `VerseDisplay`, the list screens. *Removes ~330 allocations per page render; kills a big chunk
>    of GC hitches.* Zero visual risk.
> 2. **Single-flight + per-gesture dedupe the warm path.** In-flight maps around
>    `getMushafPageData` and `getPageLayoutCache`, plus a Set of already-requested pages reset on
>    `onScrollBeginDrag`. *Stops the duplicate-SQL storm during a fling — my top candidate for
>    "sometimes slow".*
> 3. **Memoize the FlatList plumbing.** `pagePairsFor(...)` builds a brand-new array every render and
>    `getItemLayout` is an inline arrow → VirtualizedList re-runs its render window on every parent
>    commit. `useMemo` both.
> 4. **Make `memo` work.** Memoize the merged `{highlights, notes, drawings}` object, the
>    `flashingVerseKey` string and `readingMarkDate` in the parent. *A settle then re-renders one
>    cell, not 7 full mushaf trees.*
> 5. **`allowFontScaling={false}`** on mushaf word `Text`s (you already clamp the multiplier to 1, so
>    nothing changes visually). Skips a per-node lookup on 137 nodes.
> 6. **Stop re-running the layout preload on every mount.** `preloadPageLayoutCacheRange` always
>    issues SQL even when every key is already in `layoutCacheMem`; add a mem-presence early-out and
>    narrow ±4 → ±2.
> 7. **Read the memo you're writing.** `getVersesByPage`'s uthmani branch never reads
>    `versesByPageMemo` — it re-queries SQLite every single call. One-line fix.
> 8. **Retune virtualization for feel:** `initialNumToRender` 5 → 2, `maxToRenderPerBatch` 5 → 3,
>    `updateCellsBatchingPeriod` 16 → 40. Today up to 5 whole pages (~1600 views) mount in the first
>    commit.
> 9. **A global "gesture in flight" gate** (set on `onScrollBeginDrag`, cleared on momentum end)
>    checked by the layout preload, chunk merge, cloud-drawing pull and sync watcher. *This is the
>    direct fix for "fine when I go slow, bad when I flick."*
> 10. **Coalesce your `runAfterInteractions` jobs** — several independent users queue during a fling
>     and all fire at once the instant it ends, exactly when the landing page mounts.
> 11. **Persist `textStyle`.** `quran` isn't in the persist whitelist, so every cold start resets the
>     font and a user who prefers `lateef` triggers a whole-book cache flush on their first action.
> 12. **Hoist per-word closures** and precompute the per-line expected word count (the `onMeasured`
>     arrow re-filters the line with `stripPua` + regex for every word).
> 13. **Experiment:** `renderToHardwareTextureAndroid` on non-current page cells (one texture instead
>     of 300 views) — measure, GPU memory is the risk.
> 14. **Ship a dev-only perf HUD:** settle→painted ms, mount ms, `executeSql` calls per gesture.
>     You've spent a lot of effort without a number to optimise against.
> 15. **Consider dropping `armeabi-v7a`** — 32-bit devices take the slower split and will always feel
>     worse than your test builds.
>
> **Big changes (ordered by benefit ÷ effort)**
>
> 1. **Ring buffer of 3 always-mounted page slots** instead of FlatList virtualization. A swipe only
>    *moves* slots; the off-screen one is re-targeted to `p+2` on settle/idle, never during the
>    gesture. Today the page you swipe to is *created* mid-animation — this deletes mount cost from
>    the critical path. Best ratio of the big ones; your paging math is already isolated in
>    `mushafLayout.ts`.
> 2. **Native pager** (`react-native-pager-view` / ViewPager2, `offscreenPageLimit={1}`). Paging on
>    the native UI thread, no JS scroll events, and it deletes the entire "randomly jumped to
>    Al-Fatiha" offset-reconstruction code class. Verify RN 0.72 compat.
> 3. **Ship precomputed per-page word geometry.** Your cache is already font-size-independent
>    (em-normalized sums), so word metrics are effectively device-independent — generate them at
>    build time and ship them. A first-ever visit then needs *zero* measurement: no `onLayout` pass,
>    no 150 ms font gate, no miss state. Your existing per-line clamp absorbs small drift.
> 4. **Rasterize pages + interaction overlay** — the "AAA instant" path. One image per page plus a
>    transparent overlay supplying word taps and highlight underlines from the geometry above. Flip
>    becomes a texture decode. All your features survive (word tap → mistake, badges, ribbon,
>    drawings, share), except live per-word text styling.
> 5. **One `Text` per line with nested word `Text`s** — views per page drop ~300 → ~40. Real win, but
>    you'd do word hit-testing against shipped geometry instead of `WordHitArea`, and per-word
>    highlight backgrounds get ragged on Android.
> 6. **A native mushaf view** (custom Android View + `StaticLayout` drawing to a Canvas, word rects
>    back to JS) — pages paint in tens of ms permanently. Weeks of work, and the eventual
>    RN-0.7x/New-Architecture upgrade is the architectural version of idea 1 (mark the neighbour
>    rebuild as a non-urgent transition so the swipe stays urgent).
>
> **Suggested order:** 14 → 1,2,3,4,6,7,12 → re-measure → 8,9,10,5 → re-measure on your worst device
> → big change 1 → then 2, and 3+4 if you want truly instant flips.
