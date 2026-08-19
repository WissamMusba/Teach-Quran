# QuranMasterApp — Why v62 Loaded Fast, and What v81 Changed

Goal of this report: keep v81's UI (frames, bookmark look, header design) but restore v62's fast page
loading and responsive header. Only load-speed-related differences are covered here — cosmetic changes
(smaller bookmarks, different frame shapes, etc.) are intentionally excluded.

## Sources compared

- v62 source: recovered from the git history of this repo (there is no `v62` tag; the commit from ~Aug 8
  was checked out and extracted). Extracted copy: `C:\Users\wissa\AppData\Local\Temp\opencode\qma_v62`.
- v81 source: current working tree (`git checkout v81`, HEAD `f8428fc`).
- File diff: same file set, 61 files differ, 3 new files in v81 (`full source files.txt`,
  `src\components\ads\CollapsibleBannerAd.tsx`, `src\utils\surahMeta.ts`).

## Bottom line

v62 was fast because its page-load pipeline was **simple and eager**: the moment a page rendered or was
navigated to, both its page data AND its verses were fetched immediately (shared guard/promise/LRU), and it
was surrounded by small eager prefetchers (`prefetchAround`, `prefetchPartner`, sequential `prefetchNext`).
Layout measurement happened **once per key** (width-based), was cached, and was replayed synchronously —
no per-mount re-measure.

v81 added a large, heavyweight "performance" layer on top of the same base: a **queued verse loader**
(3 loads per 80 ms drain tick, so verses can arrive ~1–2 s late after a page turn), a **hidden off-screen
pre-measure worker** (an extra full `MushafPageView` rendered in the background on 8 s ticks), **vertical-fit
re-measure machinery** on every page mount, **touch-drain / pause coordination** on the JS thread, and a
**layout-cache version bump (2 → 3) that wiped every cached layout row** — so the first run after updating
re-measured every page from scratch.

## What made v62 fast (the mechanisms to restore)

Source used for these line numbers: `...\Temp\opencode\qma_v62\src`.

### 1. Eager, direct verse loading — no queue
- `screens\QuranViewScreen.tsx` L83–87 (`SpreadItem`): on mount calls both `ensurePageLoaded(even)` +
  `ensurePageVersesLoaded(even)` and the same for `odd` — immediately, every render path.
- L1566–1570 (renderItem): also calls `ensurePageLoaded(item)` + `ensurePageVersesLoaded(item)` directly.
- L293 (`ensurePageVersesLoaded`): direct guard/promise/LRU load. Verses are on screen the same frame the
  page is — no artificial pacing.

### 2. Small, eager prefetchers around every navigation
- L366–373 (`prefetchAround`): page ±1, ±2 in single mode; the full visible range in split mode.
- L379–383 (`prefetchPartner`): the facing page of a spread, fetched together with the turned page.
- L328–354 (`prefetchNext`): background stepping prefetch (450/700 ms cadence).
- Every navigation path (L412–413, L467, L475, L554, L868) calls `ensurePageLoaded(pg)` +
  `prefetchPartner(pg)` immediately — no grace periods, no drain cooldowns.

### 3. One-shot layout measurement, replayed forever
- `database\localDB.ts`: `preloadPageLayoutCacheRange` (L462) warms a range with one SQLite query into an
  in-memory LRU (`layoutCacheMem`), and `getPageLayoutCache` / `savePageLayoutCache` (L476–503) resolve
  from that map synchronously with zero DB traffic on the hot path. Pages mount with cached layouts and
  do NOT re-measure.
- `components\quran\MushafPageView.tsx` (692 lines in v62): width-based measure keyed by font size, stored,
  replayed. `WordHitArea.tsx` is byte-identical between v62 and v81 (not part of the speed change).

### 4. The virtualization tuning is the SAME in v81 — not a difference
Main page FlatList: `initialNumToRender=3, maxToRenderPerBatch=3, windowSize=3,
scrollEventThrottle=16, removeClippedSubviews, getItemLayout` (v62 L1539–1544; v81 L2302–2311 — identical).
So don't waste time adjusting these — the slowdown is not here.

## What v81 changed that slows it down (candidate causes, ranked)

Current-tree line numbers below (v81).

### P0 — Queued, paced verse loading replaces eager loading
`src\screens\QuranViewScreen.tsx`: `SpreadItem` now fires `ensurePageLoaded` + `queueVerseLoad` instead of
`ensurePageVersesLoaded`. The queue drains 3 loads per 80 ms tick and keep-visible loads are deferred
"~1–2 s after a page turn" behind touch cooldowns (header comment L421–422). Result: after a page turn,
versed/highlighted content can arrive late and taps feel dead while the JS thread paces the drain.
**v62 behavior to restore:** load verses for a mounted page immediately, no pacing.

### P0 — Hidden off-screen pre-measure worker competes with real work
`src\screens\QuranViewScreen.tsx` L638–739 (warm-page state/effect), L701–732 (runs on 8 s tick timer),
L1474 (`hiddenBusyRef`), L2378–2382: an extra full `<MushafPageView hideFrame persistLayout={false}>` is
mounted off-screen and re-mounted with every warm tick to pre-measure layout into the cache. This is real
text measurement on the **JS thread — the same thread that serves page turns and header taps**. During
fast paging it is paused (touch drain) but the machinery (grace timers, safety timers, `hiddenBusyRef`
state) adds churn and can still interleave badly with interactions. v62 had none of this — it measured
only the pages that actually rendered (eagerly, once) and prefetched data, not layout.
**v62 behavior to restore:** drop the hidden worker entirely; rely on `preloadPageLayoutCacheRange` + eager
measure-on-mount (v62's L462 prefetch kept).

### P1 — Vertical-fit re-measure on every mount
`src\components\quran\MushafPageView.tsx` (867 lines vs v62's 692): imports `SCREEN_HEIGHT`,
`useLayoutEffect`, `ActivityIndicator`, `InteractionManager`, `getLayoutCacheSync`,
`savePageLayoutCacheMemOnly`, `frameInsetVFor`, `textInsetFor`. Pages now do a vertical-fit pass
(frame inset + text inset math) with `useLayoutEffect` — a synchronous re-measure during mount that v62's
width-only cached path skipped. This is the per-turn latency cost inside the page component itself, and
it invalidates the "one-shot measure" property that made v62 fast. The page also shows an
`ActivityIndicator` while fitting, which reads as "slow" even when it isn't the dominant cost.
**Recommendation:** keep the new frame geometry (looks) but make vertical fit a *cached, one-shot*
computation keyed the same way v62 keys width, so a fully cached page mount skips the fit pass entirely.
**Do NOT revert the frame shapes** — only the per-mount re-measure loop.

### P1 — Layout cache version bump wipes all cached layouts (looks like a huge regression after update)
`src\database\localDB.ts` L33–37: `layoutVer` was bumped `'2'` → `'3'`. On upgrade every cached page layout
row is invalid and every page re-measures from scratch on first run. Combined with the vertical-fit change
above, that first run is at its worst — and the user's comparison runs on a fresh install/cache make v81
look permanently slow.
**Recommendation:** after any fit/key change lands, bump the version ONCE and accept one slow first run, OR
keep the version stable if the measurement keys didn't actually change. Don't bump it casually.

### P2 — Touch-drain coordination layer
`src\screens\QuranViewScreen.tsx` L421–422, L512, L2234–2241 (`onTouchStart`/`onTouchEnd` drain pauses),
L725–732 (deferred page-data landings while touching), L616 (momentum-scroll self-validation). v62 had
plain `scrollToIndex(animated:false)` + eager loads; v81 added a whole state machine (`drainPausedRef`,
hidden/visible cooldowns, deferred landings). Each layer adds JS-thread work exactly when the user is
interacting; the 1.5 s interaction grace makes the first 1.5 s after touching behave like "paused app".
**Recommendation:** remove or drastically simplify; keep `onScrollToIndexFailed` → `scrollToOffset` (both
versions have it, it's fine).

### P3 — Layout persistence split (mem-only writes)
`src\database\localDB.ts` L519–527 (`getLayoutCacheSync`) and L558–564 (`savePageLayoutCacheMemOnly`,
comment: DB INSERT skipped, "re-warmed after app restart"): v81 defers disk persistence of measured
layouts. That part is fine and off the hot path — keep it — but be aware it means cold starts after relaunch
re-lose cache unless a background write/scan covers it.

### Not the culprit (don't change these chasing speed)
- FlatList virtualization props — identical between versions (see above).
- `WordHitArea.tsx` — byte-identical.
- `AnimatedHeader.tsx` — only 20 insertions/14 deletions: durations tightened 110/90 ms → 70/60 ms
  (both JS-driven, `useNativeDriver:false` in both), hitSlop ENLARGED 6/6/4/4 → 10/10/8/8 (buttons are
  actually easier to hit in v81). Header "dead" feel is a symptom of JS-thread saturation (P0 items
  above), not the header itself.
- `app.json` / theme / fonts / images — no speed-relevant findings.
- `quranData.ts` v75 removal of the SQLite indopak bulk import — this actually REDUCED DB contention;
  not a cause of slowness.

## Recommended change list for this repo (v81 working tree)

Apply in this order; each is independent and revertible. This preserves v81's visuals.

1. **Restore eager verse loading** — in `SpreadItem` and renderItem, call `ensurePageVersesLoaded(pg)`
   directly again instead of `queueVerseLoad(pg)`; delete (or leave dormant) the queue/drain code paths.
   Expected: verses render with the page again; biggest perceived win.
2. **Remove the hidden warm-page worker** — delete the `hiddenWarmPage` render (L2378–2382), its effect
   (L638–739) and tick/safety timers; keep `preloadPageLayoutCacheRange` warming on navigation instead.
   Expected: no background measure racing page turns; measurable JS-thread headroom for header.
3. **Make vertical fit one-shot** — if a cached layout exists for the exact key, skip the fit pass and
   `useLayoutEffect` re-measure entirely (measure only on cache miss, exactly like v62's width path).
   Keep the v81 frame geometry.
4. **Bump `layoutVer` to `4` exactly once** when the fit-cache landing ships, then leave it alone.
   Warn the user the first run after the update re-measures everything (one-time).
5. **Slim the touch-drain layer** — remove the 1.5 s grace/deferred landings; restore plain
   `scrollToIndex` + eager `ensurePageLoaded`/`ensurePageVersesLoaded` (v62's L868 pattern).
6. **A/B sanity check after 1–2:** time "page turn → fully rendered verses" on the same device for v62
   binary vs rebuilt v81. Expect the queue (P0-1) and the hidden worker (P0-2) to be the dominant wins.

## Verification notes

- v62 source extraction: `git --work-tree=... checkout v62 -- .` (exit 0) — byte level; file sets matched.
- 149 source files in `The Fix v76\current` already verified byte-identical to this v81 working tree, so
  any fix verified here can be copied to that folder the same way (16 file copy last time).