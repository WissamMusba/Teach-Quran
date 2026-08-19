# LOAD-IDEA-3 — Page-Data-First Pipeline (v83)

Scope: research + proposal only. No source code was modified. All line numbers verified against current tree (HEAD `da91839`, Release v83).

---

## 1. Root cause — why the text lags ~0.5s behind the frame after the first ~5 pages

### 1.1 The spinner the user sees is the MushafPageView gate, not the PageCell spinner

`MushafPageView.tsx:738-748` gates on `cacheState === 'loading' || (!replayFit && (!fontReady || innerH === 0))` and renders the frame + a large `ActivityIndicator` while loading. The `overlayLayer` frame (ornaments, border) paints **with** the gate, which is why the frame appears instantly while the text waits. The spinner inside the PageCell (`QuranViewScreen.tsx:189`) renders *without* a frame — the user's symptom (frame + spinner + late text) is unambiguously the MushafPageView gate.

`cacheState` starts as `'loading'` (`MushafPageView.tsx:309`) and stays there until `getPageLayoutCache()` resolves (effect `:469-507`, mem first `:492-497`, SQLite fallback `:496`).

### 1.2 The visible page's tiny layout SELECT queues behind a flood of large reads on ONE serialized connection

- All SQLite I/O runs on a **single connection** (`localDB.ts:14`, WAL/busy_timeout `:16-18`). Reads are serialized.
- Every settle (120ms after momentum end, `QuranViewScreen.tsx:2009-2011` → `settledPage` `:485`) re-runs the warm effect `:512-563`:
  - TIER 0 burst `:552-554`: `loadPage(current)` + `warmLayout(current±1)` — 3 × `getMushafPageData` (~60–100KB JSON each, read + `JSON.parse`, `quranData.ts:220-244`) + `getVersesByPage` (uthmani path re-queries SQLite every call, `quranData.ts:602-630`) + `warmPageLayoutFor` saves.
  - Drain queue `:555-556`: built **behind-arm first** (`current-20..current-2`), then ahead (`current+2..current+20`), draining 2 pages per 120ms tick (`:543-548`).
- `warmLayout` marks a page warm **immediately** (`layoutWarmByPageRef.current.add(warmKey(p))`, `:531-533`) before its preload completes, so an aborted/replaced preload is never retried, and the warm-skip only covers `warmLayout`, not `loadPage`.
- Under continuous forward scroll (≈1 page/s), the user lands on page N while it is **cold**: page N's own `getPageLayoutCache` runs at mount during the fling, and queues on the single connection **behind the previous settle's TIER 0 burst** (≈3 large reads ≈ 100–250ms each with bridge serialization + `JSON.parse`). Result: the tiny layout SELECT waits 300–500ms → the 0.5s spinner. This matches the symptom: first ~5 pages are warmed by the idle drain on page 1 and are instant; from then on every settle re-floods the connection just as the next page mounts.

Contributing amplifiers (same root cause):
- The ahead arm of the queue is **starved**: each new settle replaces the queue, and the behind arm (pages mostly already warm) drains first, so pages beyond `current+2` are never layout-warmed before the user reaches them.
- `versesByPageMemo` is declared (`quranData.ts:72-73`) but **never used** — every uthmani `getVersesByPage` re-queries SQLite and re-parses.
- The first ~5 pages render instantly because `warmedPagesRef`/layout rows were populated by idle settle on page 1; every subsequent page arrives cold.

### 1.3 Why the frame/ornaments are instant while text waits

Ornaments/decorations (`canvasData`, local state; highlights/bookmarks) and `pageData` (text words) come from the page caches which are staged eagerly by `SpreadItem`/`PageCell` render-time loads (`QuranViewScreen.tsx:108-152`, `:168-193`) and `ensurePageLoaded`/`ensurePageVersesLoaded` (`:349-370`, `:387-394`). Those reads win because they run on the mounted cell; the **layout row** (which gates the text) lives in a separate cache (`layoutCacheMem`, 900 entries, `localDB.ts:534`) that the settle drain fills — and the drain is what saturates the connection. So the frame paints, the gate waits, the text waits.

---

## 2. Root cause — why SHARE/MISTAKES/NOTES/BOOKMARKS/SETTINGS die during page loads while BACK and the surah picker keep working

### 2.1 The five action buttons are REMOUNTED on every header re-render

`Btn` is defined **inside** the AnimatedHeader render body (`AnimatedHeader.tsx:160-165`). Every header render creates a *new* component type, so React unmounts and remounts the five `Btn` instances (`:187-191`) on **every** re-render. An in-flight touch (press started, finger still down) belongs to a React element tree that is destroyed mid-gesture → the responder is lost → the tap dies. This is exactly "buttons die during page load, work again after".

### 2.2 BACK and the title/picker survive because their types are stable

They are plain inline `TouchableOpacity`s (`AnimatedHeader.tsx:177`, `:180`) — same component type every render, no unmount/remount, so the responder survives.

### 2.3 The header re-renders constantly during page loads

- All 7 `onPress` props are inline arrow functions (`QuranViewScreen.tsx:1930-1933`) — new identities every render — defeating `React.memo(AnimatedHeader)` (`AnimatedHeader.tsx:229`).
- During fast scroll there are ~4–6 QuranViewScreen re-renders per page (setCurrentPageNum, setSettledPage ±120ms, setPageCache, setPageVersesCache, setSurah on surah crossing, setCanvasData) → 4–6 header re-renders → 4–6 `Btn` remount cycles per page → presses landing in that window die.
- JS-thread saturation from the SQLite flood (§1.2) delays touch delivery, widening the window.

Note: the `Btn`-in-render pattern already exists in v62 (`qma_v62\src\components\common\AnimatedHeader.tsx:154`). It is not a v75+ regression — the v75-v83 changes raised the header re-render *rate* (drain flood, eager cell loads), exposing the latent bug. Overlay theories were ruled out: `edgeTapLeft`/`edgeTapRight` sit at `zIndex:1` below the header (`zIndex:100`, `AnimatedHeader.tsx:216`), and `edgeTapRight` starts at `top:64`, below the buttons' hit areas. There are no busy-guards in the callbacks — they are plain `navigation.navigate`/`setState`.

---

## 3. What other Quran apps / paginated readers do (with sources)

| App / system | Technique | Source |
|---|---|---|
| AndroidX **PdfViewerFragment** (Jetpack PDF viewer) | **Two-pass pipeline**: a cheap *layout pass* (page dimensions) runs *progressively* — starts with the first pages, `peekAhead = current+2` up to 100, pushed continuously "as the user scrolls down" — while the expensive *render pass* is "tightly limited to the currently visible pages" with `prefetchRadius = 1`. During fast-scroll it explicitly *skips asset fetch* but "keep[s] pushing layout bounds far enough". Ready state announced as soon as the visible page's bitmap loads. | developer.android.com/develop/ui/views/layout/pdf/implement-pdf-viewer; googlesource.com PdfViewer.java; PageLayoutManager.kt |
| Android **PrintSpooler** `PageContentRepository` | Preload window around the visible range (symmetric ± half-cache), cache-check before render, **dedupe by attaching the waiting callback to the in-progress task** instead of starting a second read, cancel stale preload tasks when the window moves. | googlesource.com frameworks/base, `PageContentRepository.java` |
| **QCF Quran engine** (qcf_quran_plus, Flutter, Hafs/QCF font) | 60fps offline mushaf rendering: **font preloading at startup**, per-item list rendering with internal caching (`getAyaNoQCFLite`), `RepaintBoundary` so only the changed layer repaints. | github.com/hussein12347/qcf_quran_plus; pub.dev docs |
| **Muslim Day** Quran reader (Medium) | Pivoted from heavy third-party PDF to native `PdfRenderer`: pages rendered **on demand**, no eager bitmap cache of the whole book. | medium.com/@shakircam/technical-challenges-in-quran-reading-feature |
| **QuranEngine** (Android port) | Separates *content loading orchestration* (`quran-content` module) from *paging* (`quran-pages`) and *rendering* (`quran-image`) — data loading is its own orchestrated stage. | github.com/Digital-Tools/quran-android-engine |
| **Quran.com** (web, ~50M users) | Pages fully pre-rendered at build time (Next.js ISR) + CDN stale-while-revalidate; content is served before any client work runs. | dev.to engineering post on Quran.com |
| React Native `FlatList` (the framework this app uses) | Offscreen cells render asynchronously; "if you scroll faster than the fill rate, you'll see blank content" — mitigated by `getItemLayout`, `initialNumToRender`, `maxToRenderPerBatch`. All reads are serialized over the JS bridge. | reactnative.dev FlatList docs |
| react-native-sqlite-storage | Large strings across the bridge are the dominant cost; `JSON.parse` of a big JSON column is faster than `WritableNativeArray` conversion. | react-native-sqlite-storage issue #133 |

Pattern distilled: **separate the cheap "layout/geometry" stage from the expensive "content" stage; keep the expensive stage tightly scoped to visible pages; push the cheap stage far ahead, nearest-first; dedupe and cancel stale work; never let background work sit in front of the visible page's request.**

The v62 pipeline (baseline this report compares against) already did the ahead-first part: near window `[c-3, c+7]` warmed immediately + a creeping 8-page frontier every 450ms (`qma_v62\src\screens\QuranViewScreen.tsx:315-330+`).

---

## 4. Concrete idea — page-data-first pipeline (ahead-first warm, visible-page priority, stable header)

Goal (user constraint): text renders instantly under fast scroll; bookmarks/mistakes/highlights may land up to ~1s late; v81 UI preserved.

### Step 1 — Flip the drain to ahead-first and make it skip warm pages (`QuranViewScreen.tsx:512-563`)

- Swap the two queue-build loops `:555-556`: build the **ahead arm nearest-first** (`current+1..current+20`) then the behind arm. Under forward scroll the drain now pre-loads exactly the pages the user will land on.
- In `layoutStep` (`:543-548`), skip `loadPage(p)` for pages already staged (pageCache/pageVersesCache hits) and skip `warmLayout(p)` for pages already warm (already covered by `:531`). The behind arm then costs ~nothing instead of re-reading big JSONs.
- Move the "mark warm" in `warmLayout` from `:531-533` (immediate) to the `.then` at `:534-536` (after `warmPageLayoutFor` actually saved), so an aborted/replaced preload is retried on the next settle instead of leaving a phantom "warm" marker.

### Step 2 — Guarantee the visible page's layout SELECT never queues behind the drain (kill the 0.5s spinner)

- Shrink TIER 0 (`:552-554`) to `current` only; queue `current±1` at the head of the drain (they're the next landing targets, not this tick's).
- Add a tiny priority gate in `localDB.ts`: wrap the single `dbInstance` in a promise queue where **reads for the visible page (layout-cache reads from `MushafPageView`'s effect) take priority 0**, drain reads priority 1 (same-size FIFO inside a priority). This is the one structural guarantee that "the visible page always gets data first" — nothing else needs to know about it. Writes (`savePageLayoutCache`) stay priority 0; they are rare and small.
- Net effect: `getPageLayoutCache` for the mounted page (`MushafPageView.tsx:496`) resolves in the time of one small SELECT (~10ms), not 0.3–0.5s of queued 100KB reads. The `cacheState === 'loading'` gate (`:738-748`) then almost never shows.

### Step 3 — Cut redundant large reads (`quranData.ts`)

- Wire the already-declared `versesByPageMemo` (`:72-73`) into the uthmani `getVersesByPage` path (`:602-630`), mirroring the existing `indopakPageVerseCache`; cap ~50 entries. Removes one large SQLite query + parse per page per settle with zero API change.

### Step 4 — Fix the header remount bug (independent of the pipeline)

- Hoist `Btn` (`AnimatedHeader.tsx:160-165`) to **module scope** (like the back button) so its type is stable across renders → the five action buttons stop unmounting/remounting → in-flight presses survive.
- Wrap the 7 header `onPress` callbacks in `useCallback` (`QuranViewScreen.tsx:1930-1933`) so `React.memo(AnimatedHeader)` (`AnimatedHeader.tsx:229`) actually holds and the header stops re-rendering on page-data landings entirely.

### Why no feature breaks

- Step 1–3 change only ordering, dedup, and scheduling of existing reads; the data written to `layoutCacheMem`/SQLite (`layoutVer` 4 rows) is unchanged. Steps 4 only hoists a component definition and stabilizes callback identities. Bookmarks/mistakes/notes/highlights still ride the same caches and still land ≤1s. v81 UI untouched.
- `warmPageLayoutFor`/`savePageLayoutCache` (`localDB.ts:615-625`) and `preloadPageLayoutCacheRange` (`:566-579`) stay as-is.

### Perf tradeoffs

- Ahead-first + warm-skip does **strictly less DB/bridge work** during scroll (behind pages already staged are no longer re-read), which also reduces JS-thread saturation → faster touch delivery → further shrinks the header-tap window (§2.3).
- Priority queue adds ~O(1) bookkeeping per query vs. 100KB+ JSON parse/bridge costs — negligible.
- Ahead-first costs warm lag when scrolling **backward**; mitigated because the behind arm is still drained after the ahead arm, and the existing 120ms settle cadence re-queues it.

### Risks

- Priority reordering must never invert a read against its dependent write; keep all writes priority 0 and all reads per-priority FIFO.
- The warm-marker move (Step 1) increases `warmLayout` call frequency for abortive settles; cheap because of the in-settle `warmLayoutByPage` Set and O(1) warm-key checks.
- `useCallback` churn risk (stale closures) in Step 4 — wrap with current values or `useRef`-based handlers.

### Keep-it-simple fallback (~90% of the win, ~40 lines)

1. Ahead-arm-first queue order + warm-skip in the drain (`QuranViewScreen.tsx:543-556`).
2. Mark-warm-after-save (`:531-536`).
3. Hoist `Btn` (`AnimatedHeader.tsx:160-165`) + `useCallback` the 7 header props (`QuranViewScreen.tsx:1930-1933`).
4. Skip the priority queue and `versesByPageMemo` wiring; accept that TIER 0 still does 3 reads per settle.

Expected: first-paint text gap drops from ~0.5s to near zero under 10 pages/10s, and header taps stop dying during loads — with zero risk to v81 features.
