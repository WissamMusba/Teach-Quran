# LOAD IDEA #1 — Instant Text Layer

**Scope note (verified against the CURRENT tree):** HEAD is `da91839` "Release v83". The v81 machinery described in
`PERFORMANCE-v62-vs-v81.md` (queued verse loader, hidden pre-measure worker, touch-drain) is **absent** — commit
`22b3829` (v82) removed the hidden pre-measure worker, restored eager verse loading and slimmed the drain. There is
no background text pre-render of any kind in the current tree. All line numbers below are from the current files.

---

## 1. Root cause: why text lags ~500ms under fast scroll (frame is instant, text is late)

The page **frame** is instant because it is not gated by the text: `overlayLayer` (OrnamentalFrame + badges) renders
in every state, including the loading state — MushafPageView.tsx:685-687 and :742-744. Only the **text layer** is
gated:

- MushafPageView.tsx:738 — `if (cacheState === 'loading' || (!replayFit && (!fontReady || innerH === 0)))` →
  ActivityIndicator (:742) + overlayLayer (:744). `cacheState` starts `'loading'` on every mount and is reset back to
  `'loading'` on every page/context change — MushafPageView.tsx:309, :457.
- The gate opens only after the layout row is resolved, and resolution has three branches (the cache-load effect,
  MushafPageView.tsx:460-507):
  1. **Sync mem hit** — `getLayoutCacheSync` (:492-494): instant, no spinner. This is the "warm page" path.
  2. **Async SQLite read** — `getPageLayoutCache(...).then(applyHit)` (:496): the page shows the spinner for the
     whole read latency, because `cacheState` stays `'loading'` until it resolves (`applyHit` → `'hit'` :482 or
     `'miss'` :487).
  3. **Measure pass** on `'miss'` (:487): ~450 `WordHitArea` `onLayout` → `handleWordMeasured` callbacks
     (MushafPageView.tsx:848, :533), each gated on `fontReady` (:535), with a single `setLineScale({})` commit at
     the end (:575). This is the ~500ms JS-thread burst.

Why the async read is slow in practice — the SQLite wall. react-native-sqlite-storage serializes every statement on
one connection. Every settle fires Tier-0 loads + warms synchronously (QuranViewScreen.tsx:552-554), each `warmLayout`
runs `getMushafPageData` (page-JSON read) then `warmPageLayoutFor` (MushafPageView.tsx:109-119) — plus
`saveLastPageSeenLocal` (QuranViewScreen.tsx:842), canvas `getChunk` merges and student-data saves. A freshly mounted
page's `getPageLayoutCache` read lands at the **end** of that queue, so even an existing DB row can take hundreds of
ms → spinner, then text.

Why the warm-ahead fails to prevent this — it marks pages "warmed" **before** the query completes:

- `warmLayout` (QuranViewScreen.tsx:530-536): `layoutWarmByPageRef.current.add(warmKey(p))` runs at :533, the async
  `getMushafPageData(...).then(pd => warmPageLayoutFor(...))` at :534-536. A page scrolled into view while its warm
  query is still in flight mounts with its row **not yet** in `layoutCacheMem` → falls into branch 2 (spinner) or 3
  (measure).
- The drain is 2 pages per 120ms (QuranViewScreen.tsx:545-547) and the whole settle effect is gated on the 120ms
  swipe-settle debounce (:520, :2010-2011) and `hiddenFocus` (:517). A fast fling lands ahead of the drain; that page
  is cold.
- The per-page ±2 preload (`InteractionManager.runAfterInteractions` → `preloadPageLayoutCacheRange`, MushafPageView
  .tsx:502-505) only covers ±2 pages — far short of a fling.

Root cause in one paragraph: the text layer cannot start until the layout row is available; for every page that is
not already in the in-memory `layoutCacheMem`, that means an async SQLite read queued behind a wall of other reads
and writes (spinner), and if the row does not exist yet (first visit under that textStyle/sparse/screenW key), a full
per-word measure pass (~500ms of JS work). The warm-ahead pipeline is throttled to 2 pages/120ms, only runs after a
120ms settle, and marks pages warm before their query finishes — so fast scrolling reliably lands on cold pages.

---

## 2. Root cause: why SETTINGS / MISTAKES header buttons "don't respond" while BACK / surah picker work

Hypotheses from the brief, tested in the current code:

**(a) Overlay covering part of the header — FALSE.** The header wrap is `zIndex: 100` with `overflow: 'hidden'`
(AnimatedHeader.tsx:216). The only near-header elements are below it in stacking order: the edge-tap strips
`edgeTapLeft { top: 0, ... zIndex: 1 }` / `edgeTapRight { top: 64, ... zIndex: 1 }` (QuranViewScreen.tsx:2227-2228,
rendered :1938-1939); `capturingOverlay` exists only while `isCapturing`; `headerToggleWrap` is bottom-left. Nothing
sits above the header. A hidden header also sets `pointerEvents: 'none'` (AnimatedHeader.tsx:170), so it never
intercepts when hidden.

**(b) Per-button busy-guard — FALSE.** All five icon buttons are the same `Btn` component — identical
`TouchableOpacity`, `activeOpacity`, `hitSlop` (AnimatedHeader.tsx:160-164). Wiring is bare and identical in shape:
`onBack={() => navigation.goBack()}`, `onOpenList={() => { setSearchMode('surah'); setShowList(true); }}`,
`onMistakes/onNotes/onBookmarks/onSettings = navigation.navigate(...)`, `onShare = handleSharePage`
(QuranViewScreen.tsx:1930-1932). No `pageLoading`/`drainPaused`/busy-guard refs exist anywhere in the current tree.

**(c) Header re-mount or stale closures — FALSE.** Callbacks are inline arrows closing over the stable `navigation`
prop; `headerInfo` is memoized (QuranViewScreen.tsx:310); a page change only changes props; `git diff` shows the
header wiring byte-identical from v79 (`624eeb3`) to HEAD.

**(d) JS-thread saturation with push-vs-pop asymmetry — TRUE** (shared root cause with §1). TouchableOpacity's
responder negotiation, pressed-state render and `onPress` dispatch all run on the JS thread. While the page-load
pipeline is running (SQLite wall + measure pass bursts, §1), frames exceed 16ms; taps are dispatched late, and under
sustained saturation the press can be dropped outright (the delayed touch stream is superseded/cancelled before
`onPress` fires). The asymmetry the user observed is exactly the callback cost:

- `goBack()` pops the native-stack — the screen below is **already mounted** in the native hierarchy
  (react-native-screens keeps it); the pop only needs the small nav-state update, and reveals existing pixels.
- `setShowList(true)` opens a local RN `Modal` (a native component painted from already-committed JS).
- `navigate('Mistakes'/'Settings')` must push **and mount a brand-new native screen** whose first React render
  (MistakesScreen's per-card `getVersePage` effect, MistakesScreen.tsx:112-126; SettingsScreen's full settings tree)
  is queued behind the saturated JS thread. The reader stays frozen underneath for hundreds of ms → exactly "the
  button does not respond".

So all buttons are equally starved; only pushes have a long, visible tail, which is why only SETTINGS/MISTAKES (and
by the same mechanism NOTES/BOOKMARKS) read as dead. Fixing §1 removes this class of failure.

---

## 3. What other Quran apps do (with sources)

1. **Tarteel** — separates data / fonts / presentation: word→page→line allocation is **pre-determined and bundled
   with the app**, custom fonts with kashida dynamic justification, rendered on a Skia canvas. No layout computation
   at read time → instant pages. Source: https://tarteel.ai/blog/from-page-to-screen-rethinking-quran-rendering-for-the-digital-age/
   (also https://qul.tarteel.ai/resources/mushaf-layout for the open-sourced allocation data).
2. **Quran.com** — per-page glyph font files (`p{PAGE}.woff2` for all 604 pages, QCF V2) so each page is a single
   glyph run with no layout math; Unicode `text_uthmani`/`text_indopak` as the light alternative. Web app pre-renders
   surah pages (Next.js ISR) and edge-caches them (`stale-while-revalidate`) so text arrives before any computation.
   Sources: https://api-docs.quran.com/docs/tutorials/fonts/font-rendering/ ;
   https://dev.to/mzunain/how-we-scaled-qurancom-to-50m-monthly-users-architecture-lessons-from-the-inside-i33 ;
   https://softwareherald.com/next-js-and-isr-at-scale-how-quran-com-reached-50m-monthly-users/
3. **alheekmahlib/quran_library** (Flutter) — three modes: bundled Hafs font with `FittedBox fitWidth` + line
   heights computed from page geometry; per-page downloaded fonts; text-scale mode. Perf: `RepaintBoundary` per
   page/line (repaint isolation), selective rebuilds, one range query for all words of a page (no N+1), set-based
   bookmark lookups. Source: https://deepwiki.com/alheekmahlib/quran_library/4-page-rendering-system
4. **QuranPortal** — per-page fonts (604 woff2 files); **caches entire page renders** keyed
   `mushaf:mushafId:page:pageNumber:v1`; DB indexes for page-line lookups; single word query per page. Source:
   https://quranportal.io/blog/rendering-the-quran-mushaf-digitally
5. **PDF-based readers** — Android `PdfRenderer` for PDF mushafs: native, instant, but non-interactive. Source:
   https://medium.com/@shakircam/technical-challenges-in-quran-reading-feature-cc7a7f645e3b
6. **Muslim Pro** — proprietary (190M+ downloads); no public architecture docs; mushaf is glyph/image-based per
   platform. No source to cite; noted for completeness.

Pattern: every serious reader pre-packages the page allocation (per-page fonts or bundled layout data) so rendering
is "place pre-known text at pre-known positions" — never measure-then-scale at read time. This app already has the
equivalent of that data: the `page_layout_cache` rows ARE a pre-computed per-key allocation
(localDB.ts:26, :547, :566-590, :615-622), replayed synchronously on a mem hit (MushafPageView.tsx:492). The gap is
entirely in **how and when** the cache is populated relative to the swipe.

---

## 4. The idea: instant text layer

Make the text layer render on the **first painted frame** for every page after the first, and move all SQLite +
measure work behind the paint. The app already contains the pieces; this plan mostly reorders them.

### Step 1 — Fix warm-ahead ordering (QuranViewScreen.tsx:530-536)

Move the "warmed" mark from before the query to after it: keep a `layoutInflightByPageRef` Set; check both sets at
:531; on `warmPageLayoutFor` completion, move the key from in-flight to `layoutWarmByPageRef`. Consequence: a page
scrolled to while its warm query runs now correctly falls through to the read path — but by then its row is already
in `layoutCacheMem`, so MushafPageView's sync mem hit (:492-494) resolves it on frame 1. No other behavior change.

### Step 2 — Warm the whole fling window with one query (QuranViewScreen.tsx settle effect, ~:549-558)

After the settle drain, fire a single `preloadPageLayoutCacheRange(max(1, current-20), min(604, current+20),
textStyleRef.current, false, sparse, Math.round(pageW))` (localDB.ts:566). `warmPageLayoutFor` already does exactly
this per page (MushafPageView.tsx:117) — the per-page calls in the ±20 window become one indexed SELECT, and the
whole reachable band lands in `layoutCacheMem` long before the user can fling there. Keep `warmPageLayoutFor` only
for Tier 0 (±1) where a row may not exist yet (the function also derives `sparse` from the page data).

### Step 3 — No spinner on residual cold cases (MushafPageView.tsx:738-744)

Once `innerH` and `fontReady` are known (i.e. any page after the first paint of the session), the vertical fit is a
**pure function** of (innerH, headerVisible, pitchScale, fontScale) — MushafPageView.tsx:375-389 — and `innerH` is
constant across pages. So:
- When a page mounts with `cacheState === 'loading'` but `innerH`/`fontReady` known, open the gate immediately and
  paint the text layer: sync mem lookup first (`getLayoutCacheSync`, :492); if present → exact lines; if absent →
  default line scale.
- Reconcile behind the paint: keep the async `getPageLayoutCache` read (:496); on `'hit'` re-render with exact lines
  (existing `applyHit` path); on `'miss'` run the measure pass inside `InteractionManager.runAfterInteractions`
  (already imported, :14; already used for the ±2 preload, :502) and commit with the existing single `setLineScale({})`
  (:575).
- The very first page of a session (innerH unknown, font not ready) keeps the current gate — a one-time cost.

### Why the features and current UI won't break

- Highlights / bookmarks / notes / mistakes are per-word overlays layered on the same (line, wordIndex) layout
  (MushafPageView.tsx:778-803) — positions never change, only the commit timing; they may appear one frame after the
  text, which was already accepted.
- The measure pass still runs for genuinely uncached keys, so textStyle / sparse / screenW correctness is preserved;
  only the *when* of the final commit changes.
- Night mode, spread mode, indopak/uthmani, page/ayah/continuous modes all consume the same line/scale data; nothing
  in the render contract changes.
- Step 3 reuses the existing single-commit reconciliation (refs → one `setLineScale({})`), so the correction is one
  frame, not a cascade.
- Bonus: removing the JS-thread saturation fixes the §2 header buttons — taps are processed promptly and pushes no
  longer queue behind measure passes (the app already stops its warm drain when a screen is pushed, QuranViewScreen
  .tsx:514-517; it just never gets the chance to be idle during page swiping).

### Tradeoffs

- Step 3 paints at default line scale for at most one frame on truly cold pages (no mem row, read in flight) → a
  line can clip/overflow briefly. Acceptable vs a 500ms spinner; Step 2 makes this case rare (only pages never
  visited under the current textStyle/sparse/screenW key).
- SQLite traffic: Step 2 is one range read per settle (~1-5ms indexed) replacing ~40 per-page warm queries — net
  cheaper.

### Risks

- Regression to v81/v82's hidden-worker failure mode. That worker's cost was its own measure passes and state
  updates on the JS thread; this plan adds **no** hidden render harness — it only reorders existing reads and
  commits behind the first paint. Step 2's read is off-thread SQLite, Step 3's reconcile is gated by
  `runAfterInteractions`.
- Memory: `layoutCacheMem` is already LRU-bounded (localDB.ts:552-554).
- Behavior change on truly first-time pages (brief default-scale frame instead of spinner) — the user explicitly
  prefers instant text over the spinner.

### Keep-it-simple fallback

Ship **Step 1 + Step 2 only** (~15 lines): the ±20 fling window then lands via the synchronous mem hit with zero
spinner in the common case; residual cold pages keep today's spinner until Step 3 is revisited. This is the
recommended first milestone — measurable with the existing layout-cache hit behavior before any render-path changes.