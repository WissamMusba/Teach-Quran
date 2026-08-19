# LOAD IDEA 2 — Decouple decorations from text: "text first, decorations second"

Research-only document (no source edits). Root causes verified against the current working tree (v83 HEAD, uncommitted changes present). All line numbers are from these files as they exist today.

---

## 1. Root cause — why the page TEXT is slow while the frame/background renders instantly

### 1a. The gate: text is hostage to an async SQLite layout-cache read (the ~500ms spinner)

`MushafPageView` withholds ALL text behind a render gate (MushafPageView.tsx:738):

```ts
if (cacheState === 'loading' || (!replayFit && (!fontReady || innerH === 0))) {
  // renders ONLY: padded container + ActivityIndicator + overlayLayer (frame, juz/surah/page pills)
```

- `overlayLayer` (frame + badge pills) is rendered in BOTH the gate branch (MushafPageView.tsx:744) and the full branch (:871) — that is why the ornament/background appears instantly while the text does not.
- `cacheState` starts `'loading'` (MushafPageView.tsx:309) and is reset by the reset effect on every `[pageNum, textStyle, pageWidth, fixNonce]` change (MushafPageView.tsx:444-458).
- The cache-load effect (MushafPageView.tsx:469-507) resolves the layout row:
  - **(a)** synchronous `getLayoutCacheSync()` mem hit (localDB.ts:587-590) → `setCacheState('hit')` before paint → page paints text on the 2nd frame (1 onLayout round-trip for `innerH`, per the synchronous first-measure in `onBoxLayout`, MushafPageView.tsx:332-336). This is the fast path.
  - **(b)** mem miss → `getPageLayoutCache()` (localDB.ts:592-608) — an **async SQLite read** that resolves through `.then(applyHit)` (MushafPageView.tsx:496). The first frame paints the spinner, and text waits for the promise.
- The async read is not slow because of the query — the table's PRIMARY KEY IS the full 6-tuple (`pageNumber, textStyle, headerVisible, fs, sparse, screenW`, localDB.ts:26-30), so it is a rowid lookup. **It is slow because it queues on the single shared SQLite connection** behind the student-data chunk reads that the canvasData effect fires on every page change (`getChunk` → `mergeChunks` → `setCanvasData`, QuranViewScreen.tsx:985-1002, effect deps `[currentPageNum, currentSurahId, splitOn, currentStudent, readingMode, settledPage]`). During fast scroll every landed page fires 1-2 `getChunk` SELECTs + JSON.parse before the layout read even starts → hundreds of ms of queueing → the ~500ms spinner the user sees.
- Why it happens only after ~5 fast pages: warm-ahead works (preloadPageLayoutCacheRange ±2 in MushafPageView.tsx:502-505; `warmNearPages` 2 pages/150ms, QuranViewScreen.tsx:599-611; settle-warm drain 2 pages/120ms, QuranViewScreen.tsx:599-660 area, v79 diff). Flipping 5+ pages outruns both warmers, so the landed page mounts cold → path (b).

### 1b. The decoration re-render storm: every page turn re-renders ALL mounted pages' word trees

Even on a warm cache hit (text fast), each page turn causes 1-2 full-page re-render waves of every mounted page (~400 words each):

1. `stagePageData` commits a NEW `pageCache` object per landing (QuranViewScreen.tsx:434-452) → `PageCell`/`SpreadItem` are `React.memo` but receive `pageCache={pageCache}` (QuranViewScreen.tsx:2033, 2024) — new identity → memo fails → every mounted cell re-renders.
2. The canvasData effect (QuranViewScreen.tsx:996-1002) re-runs on every `currentPageNum`/`settledPage` change, `getChunk`s the page chunk and calls `setCanvasData(await mergeChunks(keys))` — `mergeChunks` always builds fresh `{highlights, notes, drawings}` objects (QuranViewScreen.tsx:985-994) → **even when nothing changed**, a second commit replaces `captureHighlights`/`notes` identities.
3. `captureHighlights`/`captureBookmarks` are re-derived inline every render (QuranViewScreen.tsx:1650-1651) and passed to every `MushafPageView` (QuranViewScreen.tsx:2033-2036).
4. `MushafPageView`'s own `React.memo` export is explicitly documented as "largely ineffective … prop identity churn" (MushafPageView.tsx:916-918, 205-206).

Each such re-render walks the whole page's word tree with DECORATION LOOKUPS INTERLEAVED INTO THE TEXT RENDER (MushafPageView.tsx:795-803, inside the per-word IIFE at :777-866):

- `hlMap` rebuilt per render: `new Map(Object.entries(highlights || {}))` (MushafPageView.tsx:421);
- per word: `hlMap.get(vKey)?.highlights?.find(hl => hl.wordIndex === wordPos - 1)` — an O(n) scan over the verse's highlight array (:799), plus `bookmarks?.[vKey]`, `flashingVerseKey === vKey`, `notes?.[vKey]`, `readingMarkVerse === verseNum` (:800-803), `stripPua` (:795, memo-cached), and a per-word `isVerseBoundary` re-derivation (:808-822, a second copy of the `computeLineExtra` boundary rule :143-161, executed per line at :778).

Net: ~400 words × ~6 lookups × 3-5 mounted pages per commit, several commits per page turn. The JS thread saturates → slow text on cold pages, laggy turns, and (see §2) dropped header presses.

### 1c. Why this app's structure makes text depend on decorations at all

- Text and decorations are ONE render path: a word's `backgroundColor` (mistake highlight, QuranViewScreen drawing-layer `MISTAKE_HIGHLIGHT`, flash tint) and a verse badge's fill/icon (`isBookmarked`, `isReadingMark`, `hasNote` 📝) are computed inline in the word/badge element (MushafPageView.tsx:832-837, 849, 855-861). There is no "plain text" first commit that skips decoration lookups — although `highlights`/`bookmarks`/`notes` are optional props, every render still evaluates all the lookups.
- The decorations data itself arrives asynchronously from SQLite (`student_data_cache`, keyed `page_N`, localDB.ts:93-97) — so text COULD render before decorations, but the current code neither defers decoration application nor prevents the re-render when they arrive.

---

## 2. Root cause — why "SETTINGS"/"MISTAKES" header buttons die during page load while BACK / surah picker work

### 2a. The buttons unmount/remount on every header render

`AnimatedHeader` defines its per-action button component INSIDE its own body (AnimatedHeader.tsx:160-165):

```ts
const Btn = ({ icon, label, onPress }: ...) => (
  <TouchableOpacity ...>...</TouchableOpacity>   // used 5x at :187-191
);
```

`Btn` is a NEW function reference on every render of `AnimatedHeader`. React reconciliation compares element types by reference, so the five `<Btn/>` instances (SHARE/MISTAKES/NOTES/BOOKMARKS/SETTINGS, :187-191) are treated as a NEW component type every render → **the whole button subtree (TouchableOpacity + icon + label) is unmounted and remounted on every AnimatedHeader render** (the "defining components inside components" anti-pattern — the new instances lose all state and native responder state).

### 2b. `React.memo(AnimatedHeader)` never blocks those re-renders

`export default React.memo(AnimatedHeader)` (AnimatedHeader.tsx:229) is defeated because the parent passes fresh inline arrow callbacks every render (QuranViewScreen.tsx:1931-1933):

```ts
onBack={() => navigation.goBack()} onOpenList={() => { setSearchMode('surah'); setShowList(true); }}
onMistakes={() => navigation.navigate('Mistakes')} ... onSettings={() => navigation.navigate('Settings')}
```

New references each time → memo always fails → `AnimatedHeader` re-renders (and thus remounts the 5 buttons) on EVERY `QuranViewScreen` render.

### 2c. The re-render storm during page load = a storm of button remounts

During fast scroll / page load the parent commits state many times per second: `setPageCache` per landing (QuranViewScreen.tsx:434-452), `setCanvasData` per page turn (QuranViewScreen.tsx:996-1002), `currentPageNum`/`settledPage` updates (QuranViewScreen.tsx:2006-2011), surah-change dispatches, plus audio ticks (`flashingVerseKey`). Each commit re-renders the screen → `AnimatedHeader` re-renders → all 5 icon buttons remount.

A tap on SETTINGS/MISTAKES lands on a `TouchableOpacity` that is **destroyed and recreated mid-press** — the press-in is registered on a native view that is then removed, so the press-out is dropped and `onPress` never fires. The button "does not respond" for the duration of the storm (~the page-load window).

BACK (AnimatedHeader.tsx:177) and the surah title block (:180) are DIRECT `TouchableOpacity` host elements — their element type is stable, they never remount, and they keep their responder state → they always work. This exactly matches the reported symptom (back + surah picker fine; settings/mistakes dead during page load).

Note: SHARE/NOTES/BOOKMARKS are inside `Btn` too and are equally affected — the user happened to try settings and mistakes. The bug predates v79 (identical inline `Btn` in the v62 baseline, qma_v62 AnimatedHeader.tsx:154); v79-v83's denser per-page re-render cadence (stagePageData/canvasData commits) made it visible.

---

## 3. What other Quran apps / ecosystems do (text and decorations are separate layers)

1. **Quran.com Android (`quran_android`) — decorations are a separate overlay, structurally**:
   Pages are PRERENDERED bitmaps; verse positions live in a database of ayah bounding boxes; highlights (audio playback, selection, bookmarks) are drawn as shaded rectangles ON TOP of the page image, scaled to the display size; taps are mapped by coordinates. The text render never depends on the decoration state — decorations are a second, independent layer.
   Source: `quran/quran_android` issue #888, maintainer ahmedre: "we have a database that says where each ayah is in the image (x,y coordinates … a set of bounding boxes …) … to highlight the ayah, we just draw a shaded rectangle above the page at those coordinates."
   https://github.com/quran/quran_android/issues/888
2. **Quran.com web — font-display swap / two-tier fonts**: the official font-rendering tutorial ships per-page QCF glyph fonts loaded lazily with `font-display: swap` (and a Unicode fallback), and the reference page renderer first mounts word spans with a `loading` class, then swaps in the glyph codes once the page font is ready — text appears before the "correct" typography, upgrade deferred.
   Source: https://api-docs.quran.com/docs/tutorials/fonts/font-rendering/
3. **The same principle in the platform docs — RN FlatList**: the official optimization guide (and many derived guides) prescribe: `React.memo` with a COMPARATOR, stable (useCallback) renderItem/callbacks, never inline objects in list props, `getItemLayout`. This is exactly the discipline the QuranViewScreen/PageCell/MushafPageView chain violates today.
   Source: https://reactnative.dev/docs/optimizing-flatlist-configuration
4. **Text-first rendering as a general pattern**: `font-display: swap`/FOUT (CSS-Tricks) is the same idea — render content with whatever is available immediately, upgrade appearance in a later pass instead of blocking first paint (FOIT).

Common thread: the decoration state is either (a) a separate overlay layer, or (b) applied as a deferred upgrade after the text paints. This app's single interleaved render path is the anomaly.

---

## 4. The idea — "Text first, decorations second" (concrete plan)

### Goal
- Cold/warm page text paints the moment the layout row is available — decorations (mistake highlights, bookmark/reading-mark badge fills, 📝 note icons, flash tint) snap in afterwards, capped at ~1s worst case, typically 1-2 frames.
- No feature breaks: toggling a bookmark/highlight/note still updates instantly on the visible page; tapping still works; capture/share paths untouched.
- Fix the header bug as a by-product of stopping the remount storm (2 small, isolated changes).

### Step 1 — Stop the decoration identity churn (the storm source)
**File:** `src/screens/QuranViewScreen.tsx` — canvasData effect (lines 985-1002).

- Keep a `lastCanvasVerRef: Record<string, { v: number } | null>` per chunk key (`getChunk` already returns `{ data, v }`, localDB.ts:93-97).
- In `load()`: after `mergeChunks(keys)`, compare each chunk's `v` against `lastCanvasVerRef`; if all unchanged (the overwhelmingly common case — no user edits), **skip `setCanvasData` entirely**. Only `setCanvasData` when a chunk version actually changed.
- Effect: page turns no longer re-render any page on the decoration path; audio ticks (`flashingVerseKey`) and page landings no longer cascade.

**File:** `src/screens/QuranViewScreen.tsx` — `PageCell`/`SpreadItem` memo (lines 168, 108).

- Add a custom comparator to `React.memo` that bails when the only changed props are `pageCache`/`pageVersesCache` identities with the cell's own entry reference-equal: `prev.pageCache[prev.item] === next.pageCache[next.item]` (and the same for verses, highlights, notes, bookmarks, flashingVerseKey, headerVisible, readingMode, isCapturing). This is exactly the "memo with custom comparator" pattern from the RN docs (§3.3).
- Effect: a neighbour-page cache fill re-renders only the affected cell.

**File:** `src/components/quran/MushafPageView.tsx` — per-word lookups (lines 795-866).

- Precompute ONE per-page decoration index in a `useMemo` keyed on `[pageNum, highlights, bookmarks, notes, flashingVerseKey, readingMarkVerse]`:
  `{ hlWordKeys: Set<string> ("surah_verse:wordPos"), bookmarkedVerses: Set<string>, notedVerses: Set<string>, readingMarkVerse: number|null, flashingVerseKey: string|null }`.
- Per-word render then does a single O(1) `hlWordKeys.has(...)` (and the flash/reading-mark checks are a 2-way compare, not lookups) instead of the `hlMap.get().find()` scan + 4 object lookups (:799-803). The `isVerseBoundary` double-implementation (render copy :808-822 vs `computeLineExtra` :143-161) can stay or be unified — no perf impact.
- Effect: the remaining (rare) decoration-driven re-renders are ~1/6 the per-word cost.

### Step 2 — Make the layout row available BEFORE the page mounts (kill the ~500ms spinner)
**File:** `src/screens/QuranViewScreen.tsx`.

- `onMomentumScrollEnd` (lines 2006-2021): when `pageCache[p]` is already present (the usual case after `prefetchAround`), call `warmPageLayoutFor(p, pData, textStyleRef.current, Math.round(pageW))` IMMEDIATELY (it is exported from MushafPageView.tsx:109 and does `preloadPageLayoutCacheRange` into `layoutCacheMem`, localDB.ts:566-579) — before the cell mounts, so `getLayoutCacheSync` (localDB.ts:587-590) resolves synchronously in the cache-load effect and text paints on the second frame with no SQLite queue.
- `handleSelectPage` (lines 714-730) already has `pData` at line 718 — warm the layout row BEFORE `landOnPage` scrolls (which is "scroll-first", line 644-652, so the cell mounts immediately). Move the `warmPageLayoutFor` call in `landOnPage` (:662) up into `handleSelectPage` when `pageCache[pg]` exists (keep the `landOnPage` call for the deep-link path where data loads behind).
- Pages that mount genuinely cold (page data itself still loading) keep today's single async read — acceptable, and now much faster because Step 1 removed the competing `getChunk` reads from the connection queue.

### Step 3 — The actual "decorations second" pass (belt-and-suspenders)
**File:** `src/components/quran/MushafPageView.tsx` — after Step 1 the text no longer waits for decorations (they are optional props; the gate at :738 only depends on layout state). To make decoration UPDATES not re-render the text tree:

- Keep the single render path (no architectural split) but gate the DECORATION branch of the per-word render on a `decorActive` state: first commit after a decoration identity change renders the word tree with plain styling (skip `MISTAKE_HIGHLIGHT`/flash background, plain badge fill, 📝 hidden), then `useEffect` on the decorations identity applies `requestAnimationFrame`/`InteractionManager.runAfterInteractions(() => setDecorActive(true))` with a `setTimeout` cap (~500ms) → second commit re-renders with decorations. Text paints first; decorations snap in ≤1 frame later (or on the cap timer if the thread is busy).
- Zero layout shift: the 📝 note icon must not appear/disappear in flow — render it in a **fixed-width wrapper** (opacity 0/1 toggle) or reserve its slot, so the decorations pass never reflows lines or invalidates the measured layout (the cached row's sums stay valid).
- Live-edit UX: a bookmark toggle on the visible page should apply immediately — the deferred pass keyed on decorations identity still commits on the next frame; that is "immediate" from the user's perspective. If a truly synchronous update is wanted for the edited verse only, apply the version bump with `flushSync` for that one commit — not required for correctness.

### Step 4 — Fix the header (independent of Steps 1-3)
**File:** `src/components/common/AnimatedHeader.tsx`.

- Hoist `Btn` to module scope (move lines 160-165 out of the component body, pass `nightMode`/`subColor` as props or read colors from the passed accent). The five buttons then have a STABLE element type and never remount → presses can no longer be dropped mid-storm. This is the whole fix (2-3 lines of movement).
- Optional hardening: wrap the 7 callbacks in `useCallback` in `QuranViewScreen` (lines 1931-1933) so `React.memo(AnimatedHeader)` at :229 starts skipping entirely — less header render work per commit.

### Order of work & tradeoffs
1. Step 4 first (tiny, zero risk, fixes the reported header bug immediately).
2. Step 1 (small, high value, removes the storm that slows text on warm pages).
3. Step 2 (small, kills the cold-page spinner for jumps and normal swipes).
4. Step 3 only if profiling still shows decoration re-render cost (the decoration index alone may suffice).
5. Re-test: fast-flip 10 pages (text appears immediately after the layout row, decorations ≤1s later); toggle bookmark on visible page (applies next frame); audio playback verse flash (only the flashing page re-renders, and only its index); share capture + drawing with decorations (unchanged paths); header buttons during a 5-page flip (presses register).

### Risks
- Skipping `setCanvasData` when chunk `v` is unchanged must key on the exact chunk key set the effect uses (drawingKey/spreadEvenKey/spreadOddKey) — a missed key change would hide a local edit until the next page turn. Use the returned chunk `v` plus presence (`null` vs `{data}`) so "chunk deleted" is also detected.
- The decorations-second pass must not re-run `handleWordMeasured`/persist the layout row (guarded by `frozenRef`/`cacheWrittenRef`, MushafPageView.tsx:534, 585-586 — unchanged).
- `preloadPageLayoutCacheRange` is mem+SQLite read-only (localDB.ts:566-579) — calling it earlier only moves the read; no write contention.
- The `Btn` hoist changes no behavior other than stopping remounts; keep `hitSlop`/styles identical.

### Keep-it-simple fallback (if Step 3 proves unnecessary)
Steps 1+2+4 alone: layout row warmed pre-mount, decoration commits skipped when nothing changed, PageCell comparator, `Btn` hoisted. Expected result: text paints on the second frame for every page whose layout row exists in `layoutCacheMem` (all warm pages and every jump), no full-page decoration re-render storms, header buttons responsive during page load, and decorations lag only by the (now rare) decoration commit. If a page's row is missing entirely, keep the current spinner gate — it is correct, just slower once.

---

### Appendix — key locations
- `src/screens/QuranViewScreen.tsx`: PageCell :168-193, SpreadItem :108-152, stagePageData :434-452, landOnPage :633-663, warmNearPages :582-612, handleSelectPage :714-730, canvasData effect :985-1002, capture derivations :1650-1652, momentum-end :1991-2022, renderItem :2023-2042, AnimatedHeader wiring :1930-1933.
- `src/components/quran/MushafPageView.tsx`: gate :738, cache-load effect :469-507, reset effect :444-458, replayFit :387-391, hlMap :421, per-word decoration lookups :795-866, computeLineExtra :143-161, warmPageLayoutFor :109-119, memo export :916-918.
- `src/components/common/AnimatedHeader.tsx`: inline Btn :160-165, button usage :187-191, direct back/title TouchableOpacity :177/180, memo export :229.
- `src/database/localDB.ts`: layoutVer 4 wipe :33-42, layout row type :534-536, layoutCacheMem :547, preloadPageLayoutCacheRange :566-579, getLayoutCacheSync :587-590, getPageLayoutCache :592-608, getChunk :93-97.
- `src/database/quranData.ts`: getMushafPageData (memoized page JSON) :220-240, ensureMushafPageData :258-282, getVersesByPage :602-630.
