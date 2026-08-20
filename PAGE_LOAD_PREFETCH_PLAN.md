# PAGE_LOAD_PREFETCH_PLAN — Instant Resume, Zero Spinners

**Goal:** after app start, opening a student's RESUME page or DAILY RECITATION page (band
**+6 ahead / −4 behind** each) shows full page content instantly — the user never sees a
loading spinner except on true cold start (first install) and on a page that has never
been rendered on this device (fixed later by Tier 2).

**Scope decision (confirmed):** anchors are the StudentHub **RESUME** target and the
**DAILY RECITATION** reading mark (manifest `lastRead`) ONLY — no bookmarks. MD first,
review before implementing.

---

## 1. Diagnosis — where the ~2 seconds actually goes

Data reads are already milliseconds (not Redux, not SQLite latency, not network):

- Page JSON: in-memory memo + indopak pages from the shipped read-only asset DB
  (`quranData.ts` getMushafPageData); verses: indexed SQLite + per-page memo.
- Redux does NOT carry page data — the reader pipeline is local caches only.

The 2 s is the **first-time layout measurement pass**:

- `MushafPageView` needs per-line width sums to fit ~400 Arabic words. A page never
  rendered on this device has no `page_layout_cache` row → the component mounts, renders
  at scale 1, measures every word via `onLayout` on the JS thread, snaps scale once and
  persists the row (`MushafPageView.tsx:533` handleWordMeasured; miss path `:486`).
- On low-end devices that measure-then-snap cycle is ~1–2 s per never-seen page.
- A page seen before on this device already has its row → mount resolves SYNCHRONOUSLY
  from memory (`getLayoutCacheSync`, `MushafPageView.tsx:492`) → **no spinner**. Key
  fact: **resume pages are almost always previously-seen pages — their rows exist, they
  just aren't pre-warmed into memory before the reader mounts.** Tier 1 closes that gap.

Existing warming (all run ONLY after the reader opened): settle-window ±20 drain
(2 pages/120 ms, `QuranViewScreen.tsx:567`), warmNearPages ±6 on explicit jumps (`:655`),
idle prefetch after 30 s (`:606`), ±2 row preload at mount (`MushafPageView.tsx:502`).
**Gap: nothing warms the pages a student is about to resume between app start and the
first reader open.**

---

## 2. Cross-student caching — current state (already working, keep it)

| Layer | Location | Scope | Student switch | App restart |
|---|---|---|---|---|
| Page JSON + verses | module memos `quranData.ts` (`mushafPageMemo` 300, `versesByPageMemo` 400, `indopakPageVerseCache`) | global, keyed by page | ✅ shared | ❌ (memory) |
| Layout rows | SQLite `page_layout_cache` + `layoutCacheMem` 900 | global, keyed textStyle+width+sparse+screenW | ✅ shared | ✅ persisted |
| Reader display state | `pageCache` / `pageVersesCache` component state (`QuranViewScreen.tsx:250`, wiped `:1245`) | per reader session | ❌ empty on each open | ❌ |

**Answer to "student 1 views 50-70, student 2 views 30-50, is 30-70 ready for student 3?":**
**YES — already.** Pages are keyed by page number, not student; student 3 gets 30-70 from
the global memos with no reload and no re-measure. Memory cost ~41 pages ≈ <1 MB — safe
on any device. **Do not add a bigger cache; the existing caps are right.**

Only remaining gap: layer 3 resets per session, so returning pages can flash a brief
spinner while the (instant) memo hit lands. Fix = seed the reader's initial `pageCache`
state from the global memos on mount (Tier 3-A micro-win below).

---

## 3. TIER 1 — Startup anchor prefetcher (recommended, low risk)

### Trigger (once per process)
- Fire from `DashboardScreen` mount, guarded by a module-level `started` flag (pattern:
  `indopakWarmStarted` in `SplashScreen.tsx:100`), wrapped in
  `InteractionManager.runAfterInteractions(() => setTimeout(start, 1500))` so the
  Dashboard paints first.
- Skip entirely when unauthenticated or if the reader is already open.

### Per student (cap first 5 students to bound work)
1. `getLastPageSeenLocal(sid)` → resume `{surah, verse}`; fallback: manifest `lastRead`;
   fallback: page 1.
2. `resumePage = await getVersePage(surah, verse, textStyle)`.
3. `dailyPage = await getVersePage(lastRead…, textStyle)` from `getManifest(sid)`
   (skip if same as resumePage).
4. Bands: resumePage **−4 … +6** (clamped 1..604); dailyPage **−1 … +1**; dedupe.

### Warm actions per page — ONE shared paced queue (3 pages / 100 ms)
1. `getMushafPageData(pg, textStyle)` → fills page-JSON memo.
2. `getVersesByPage(pg, textStyle)` → fills verses memo.
3. With fetched pageData compute `sparse` → `preloadPageLayoutCacheRange(pg, pg,
   textStyle, false, sparse, round(pageW))` → loads the layout row into `layoutCacheMem`.

All targets are memoized/single-flight internally — the reader's own loads dedupe against
the same caches; nothing loads twice.

### Abort rules
- Cancel remaining queue when QuranView mounts (its hot-path takes over).
- Cancellation token re-checked every tick; all errors swallowed (best-effort).

### Expected result
- RESUME / DAILY RECITATION into any previously-seen page: **instant, zero spinner**.
- Never-seen pages in-band: data preloaded → shorter spinner (Tier 2 removes the rest).
- Cost: ~50-90 tiny local SQLite reads spread over ~4 s, idle-gated. No Firestore, no
  new tables, no Redux change.

### Files to touch (implementation phase)
- NEW `src/utils/startupPrefetch.ts` (~150 lines).
- `src/utils/mushafLayout.ts` — export `pageWFor(winW, splitOn)` so the prefetcher and
  QuranViewScreen share ONE width computation (cache keys must match exactly).
- `src/screens/DashboardScreen.tsx` — one-line trigger.

---

## 4. TIER 2 — no spinner even on never-seen pages (later, optional)

### 2-A — Idle-only hidden pre-measure worker (tamed re-introduction)
v81 had this; removed in v84/85 because it competed with swipes. Re-introduce ONLY with
strict gates: reader focused + untouched ≥2 s + settled; 1 page at a time to completion;
max 10 pages per settle; prefer pages in Tier-1 bands ahead; abort on any touch/scroll.
Effect: calmly-reading students get upcoming never-seen pages measured in the background,
so later swipes never spin.

### 2-B — Build-time width seeds (experimental — only if explicitly requested)
Build script precomputes line-width sums from font glyph metrics → shipped seed table →
cache misses replay the seed instantly; first real measurement overwrites it. Risks:
Arabic shaping is context-dependent and per-device rasterizers differ → visible
overshoot/snap until overwritten. Ship disabled behind a flag. Only path to "instant on
fresh install".

### 2-C — Micro-wins (cheap, safe)
- Mount-time row preload ±2 → ±4 (one query instead of one, same path).

---

## 5. TIER 3 — display-layer micro-wins (cheap, safe)

### 3-A — Seed reader initial state from global memos (fixes the per-session flicker)
On reader mount, initialize `pageCache`/`pageVersesCache` with `useState(() =>
seedFromGlobalMemos(textStyle, splitOn, winW, lastKnownPage))` — copy whatever the
global memos already hold for the anchor window (lastPosition ±3). Returning pages paint
with zero spinner flicker. Eviction stays with the memo caps; no new memory.

### 3-B — Keep page-JSON memo after reader unmount
Already true (module-level). No change needed — documented so nobody "optimizes" it away.

---

## 6. Success metrics

- Resume page fully visible after page-turn: ≤300 ms (currently ~2 s when cold-navigated).
- In-band pages: ≤600 ms today → ≤300 ms after Tier 2-A.
- Zero spinner sightings on RESUME / DAILY RECITATION on any warm-DB launch.
- No dropped frames during the prefetch window (idle-gated).
- Cross-student: 3rd student opening 30-70 after students 1+2 touched it → instant.

## 7. Rollout order

1. **Tier 1 + Tier 3-A** → release → feel it on a real low-end device.
2. Tier 2-A only if spinners still appear on in-band never-seen pages.
3. Tier 2-B only ever if explicitly requested.
