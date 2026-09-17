# CompleteRedesign.md — target architecture for a rebuild-grade redesign of Teach Quran

**Audience:** the app owner, and any coding agent implementing this.
**Scope:** a full architectural redesign that keeps **every** existing feature and makes the app
smooth on **low-end, mid-range and high-end** Android devices.
**Relationship to other docs:** `PageLoad.md` = incremental fixes to the *current* code. **This
document is the "if I were the architect, here is how I would build it" plan** — it supersedes
`PageLoad.md` only where explicitly stated (§0.3). The two are compatible: Waves 0–2 below ship
things `PageLoad.md` also wants, and Wave 3+ replaces the renderer that `PageLoad.md` mitigates.
**Status:** design proposal. No source file has been changed by this document.

---

## 0. How to read this

### 0.1 One-paragraph summary

The current app is a good *product* running on an architecture that is wrong for a **mushaf**. It
renders each page as ~137 individually-measured Arabic text widgets, derives the page layout on the
user's device at first visit, downloads its own content on first run, stores annotations as
whole-student JSON blobs, and mounts pages *during* the swipe gesture. Every one of those is a
structural choice, not a bug, and together they set a floor on how fast the app can ever feel — which
is why incremental caching stopped helping (`PageLoad.md` §3, mechanism M1). The redesign keeps the
product and replaces four layers: **rendering, paging, content, and data/sync**, on a
threading discipline that forbids work during gestures. The screens, theming, tutorial, navigation
and feature set stay recognisably the same app.

### 0.2 The 5 decisions that matter

Ranked. If you read nothing else, read this table.

| # | Decision | Replaces | Why it decides everything |
|---|---|---|---|
| 1 | **One native page canvas instead of per-word views** | 137 `Pressable` + 137 `Text` per page | Page paint drops from ~200–500 ms of view mounting to ~10–20 ms of canvas drawing. This is the only way to get "instant" on a low-end phone. |
| 2 | **Content compiled at build time, shipped in the app** | runtime JSON parse + GitHub/alquran.cloud downloads + on-device measurement | Cold start needs zero network; no page ever needs a measure pass; geometry becomes exact and font-independent. |
| 3 | **Paging that never does JS work during a gesture** | FlatList mounting cells mid-swipe | The gesture must be pure native. Content is prepared during idle, never while the thumb moves. |
| 4 | **Normalised records instead of student blobs** | `student_data_cache` JSON per canvas key + whole-blob pushes | Makes annotations O(1) per page, makes sync per-record and idempotent, removes the re-render and conflict classes. |
| 5 | **JSI SQLite + an explicit threading model** | `react-native-sqlite-storage` over the bridge | Removes bridge round-trips from every page/annotation read, and gives you a place to *enforce* "no heavy work on the JS thread". |

### 0.3 What to keep from `PageLoad.md`

Everything in `PageLoad.md` Phases 0–3 is still worth doing **now**, tonight, on the live app:
instrumentation (S14), the stylesheet freeze (S1), the warm-path dedupe (S2), prop-identity hygiene
(S3/S4), and the gesture gate (S9). They are cheap, they ship this week, and they buy you the time to
build this redesign properly. Waves 0–2 below re-do some of it properly (content, DB, sync); Wave 3+
makes the rest obsolete.

### 0.4 What this document is not

It is not a wish list. §20 lists things I would **deliberately not do** (including the two most
common "just rewrite it" moves that would cost you months and gain you nothing). §21 gives a
sequencing plan where **every wave ships a better app to the Play Store** — there is no big-bang
rewrite, because you already have users and their data.

---

## 1. The feature contract

Everything in this table must work, unchanged, in the redesigned app. This is the acceptance contract
— §19 maps each row to its new implementation.

| # | Feature | Notes / constraints |
|---|---|---|
| 1 | Username + password auth (mapped to Firebase email), register, logout | Existing accounts must keep working — the email mapping is permanent |
| 2 | Multiple students per teacher, create / delete / edit, avatar ("face") | Student list cached offline |
| 3 | Student hub: resume card, daily recitation card, go-to-page box, juz/surah/page entry points | |
| 4 | Reader modes: **page (mushaf)**, **ayah**, **continuous** | All three share annotations and hit-testing |
| 5 | Two mushaf scripts: Uthmani (604 pp) and IndoPak (611 pp), **4 fonts** (`uthmani`, `saleem`, `alqalam`, `lateef`) | Must be pixel-faithful to today's output |
| 6 | Mushaf decorations: ornamental frame, juz pill, surah pill, "Page N / N pages left in Juz" pills, bismillah line, surah headers, ta'awwud line, sparse-page enlargement | |
| 7 | Appearance: night mode, 3 colour themes (classic/emerald/obsidian), text brightness, background brightness, mushaf font size, translation size | |
| 8 | Tablet spread mode (two pages side by side) + landscape font/line-height scaling | |
| 9 | **Word tap → mistake highlight** (centre-band only, margins are "dead taps" that toggle the header) | The product's signature feature — precision is non-negotiable |
| 10 | Verse long-press / badge tap → action menu (bookmark, note, record, copy, reading mark, play) | Menu positions relative to the finger |
| 11 | Bookmarks (student-level) | |
| 12 | Reading mark / lastRead with ribbon + date badge | Drives RESUME |
| 13 | Text notes per verse | |
| 14 | Voice notes per verse: record, play, delete, registry, cloud sync | |
| 15 | Drawing canvas: pen, eraser, underline, undo/redo, split-mode origin maths, lazy cloud sync, "hide drawing tool" | Strokes are per-page / per-surah canvases |
| 16 | Share: capture the page as an image with drawing / mistakes / bookmarks layer toggles, system share sheet, copy verse | |
| 17 | Audio: multiple qaris, play from verse, per-verse advance, loop settings (verse/range/repeat), page turns, basmala pre-play, per-surah download + delete, resume after navigation, player bar | |
| 18 | Sync: automatic (interval + foreground) and manual, pending-changes badge, offline state, multi-device | |
| 19 | Interactive tutorial: chapters, spotlight anchors, action steps, hand overlay, "done" flag | |
| 20 | Ads: collapsible banner | Must not affect first paint |
| 21 | Index screens: surah index, juz index, bookmarks, mistakes, notes, reading history — all deep-linking into the reader at a verse/page | |
| 22 | Settings: all current settings + script/theme/font/downloads/sync/student management | |
| 23 | Haptics (with a disable switch) | |
| 24 | Offline-first: reader, annotations and audio downloads all work with no network | |
| 25 | Error boundary + graceful degradation (never a blank screen) | |

**Two features carry real re-implementation risk** and are called out everywhere they matter:
**#9 word-tap precision** and **#16 share capture fidelity**. Both are protected by an explicit test
harness (§25).

---

## 2. What is structurally wrong today (F1–F6)

These are architecture faults, not bugs. Naming them is what makes the redesign non-arbitrary.

### F1 — Text is modelled as a widget tree
`MushafPageView` renders one `Pressable` + one `Text` per word, plus a badge `View`+`Text` per verse
boundary (~137 words, ~15 lines, ~10–20 badges → **~300–350 native views per page**). The layout
engine must create, measure and composite every one of them on every mount, and the app's fit maths
is derived from `onLayout` callbacks of those widgets (measured 136.9 words/page avg, max 176 —
`PageLoad.md` §2.1). **Consequence:** the mount cost is irreducible without changing this, and the
"measured widths" are a side effect of the view tree rather than a first-class datum.

### F2 — Pages are mounted during the gesture
The paging `FlatList` (`windowSize={7}`, `maxToRenderPerBatch={5}`) mounts the destination cell while
the user is swiping. Go-to-page feels fast precisely because `initialScrollIndex` + memo seeding +
`warmPageLayoutFor` prepare the page *before* the scroll (`QuranViewScreen.tsx:747-780`). **The swipe
path never gets that preparation.** **Consequence:** the one gesture users repeat hundreds of times
per session is the one path where heavy work is allowed to run.

### F3 — Layout and content are derived at runtime, on the render path
Page JSON is `JSON.parse`d per visit; line-fit scales are computed from measured widths on first view
of every page; the mushaf is downloaded from GitHub and the verse text from alquran.cloud on first
run; a per-device `page_layout_cache` exists only because the layout cannot be known ahead of time.
**Consequence:** every device independently re-derives facts that are identical for all devices, and
a first visit is always slower than a re-visit. The cache treats the symptom.

### F4 — State is blobby, identities churn, memos are one-directional
Annotations live in whole-student JSON blobs split by 10-page "canvas" chunks; `getVersesByPage`'s
uthmani path writes a memo it never reads (`quranData.ts:642-674`); page/verse/canvas objects are
re-created on every cache fill and page settle, so `React.memo` fails and all mounted pages re-render
(`PageLoad.md` §2.2 A18, A22). **Consequence:** unrelated work invalidates unrelated UI, and the
renderer pays for it during animation.

### F5 — One thread does everything, and nothing enforces the rule
Scrolling, state, `JSON.parse`, SQLite warm calls at 60 Hz (`QuranViewScreen.tsx:2400-2435`), canvas
merges, sync and share capture all compete for the JS thread; several of them are deferred through
`InteractionManager`, which **accumulates** work during a fling and releases it in a burst at
momentum end. **Consequence:** "sometimes fast, sometimes slow" — the outcome depends on what else
was in flight, which is exactly what makes it feel un-AAA.

### F6 — The data model is shaped for transport, not for use
`student_data_cache(studentId, canvasKey)` with a JSON `data` column and a `v` counter, plus an
`audio_notes_cache` per 10-page range, plus lazy per-range drawings. That shape exists because the
*sync* needed chunks. **Consequence:** every local read must aggregate, parse and merge several JSON
documents to answer "what annotations exist on page 254?", and sync has to negotiate versions of
documents rather than records.

---

## 3. Design principles (the rules the redesign obeys)

**P1 — Measure before optimising.** An architecture with no instrumentation produces "I tried a lot
of things" (your words) instead of progress. Budgets in §16 are acceptance criteria.

**P2 — Nothing heavy happens during a gesture.** Between finger-down and finger-up, the only code that
runs is native gesture handling and pre-existing content display. Anything else is deferred and
coalesced.

**P3 — Content is compiled, not derived.** Every fact that is identical for all devices (page
geometry, verse text, surah metadata, indices) is computed **once, at build time**, and shipped. A
device only renders.

**P4 — One source of truth per datum, in the shape you need to read it.** A word's rectangle belongs
to the layout engine, not to a view's `onLayout`. An annotation is a row, not a member of a blob.

**P5 — Text is not a widget tree.** Text is drawn; widgets are for interaction.

**P6 — Pay at install, not at swipe.** Download size and install time are cheap; per-swipe latency is
expensive. Prefer shipping bytes over fetching or computing them.

**P7 — Every cache is bounded, explicit and observable.** No memo that is written and never read, no
unbounded map, no cache whose key omits a real input. Cache keys are versioned so a content or
geometry change invalidates cleanly instead of corrupting silently.

**P8 — Every layer is versioned and independently reversible.** `contentVersion`, `geometryVersion`,
`rendererVersion`, `schemaVersion`, `syncProtocolVersion`. A mismatch degrades or upgrades
gracefully; it never blanks the app.

**P9 — Same features on every device tier; different rendering strategy.** A 2016 phone and a 2024
flagship run the same app with the same features. The tier decides *how* pages are rasterised (§14),
not what the user can do.

**P10 — Fail soft.** Every new subsystem has a defined fallback (native renderer → JS renderer;
geometry pack → on-device measurement; oplog sync → read-only until it can sync). Users never see a
blank page or a lost note.

---

## 4. Target architecture at a glance

### 4.1 Layer diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APP SHELL (unchanged screens, navigation, theming, tutorial, ads)            │
│  Dashboard · StudentHub · Reader · Bookmarks · Mistakes · Notes · Settings    │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │ selectors (granular, stable identities)      │ commands
┌───────────────▼──────────────────────────────┐  ┌────────────▼───────────────┐
│ READER STORE  (page-scoped, O(1) lookups)    │  │ APP STORES (Redux/Zustand) │
│  currentPage · layout{width,dpi,font,scale}  │  │  auth · students · settings│
│  pageSlots[] (ring)                          │  │  audio · sync status       │
│  annotationsByPage: Map<page, AnnotationSet>  │  └────────────┬───────────────┘
│  selection · drawing session                 │               │
└───────────┬───────────────────┬──────────────┘               │
            │                   │                              │
┌───────────▼─────────┐ ┌───────▼──────────────┐   ┌───────────▼───────────────┐
│ PAGING ENGINE       │ │ ANNOTATION SERVICE   │   │ SYNC ENGINE v2 (oplog)    │
│  native pager +     │ │  optimistic apply    │   │  push batches · pull      │
│  UI-thread gesture  │ │  write-behind queue  │   │  cursors · LWW + tombs    │
│  3-slot ring        │ │  undo/redo           │   │  backoff · idempotent     │
└───────────┬─────────┘ └───────┬──────────────┘   └───────────┬───────────────┘
            │                   │                              │
┌───────────▼───────────────────▼──────────────────────────────▼───────────────┐
│ REPOSITORY LAYER  (single write path, JSI SQLite, prepared statements)       │
│  content.db (read-only asset)  ·  user.db (annotations, sync state, cache)   │
└───────────┬──────────────────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────────────────────┐
│ MEDIA CACHE  (page bitmaps · audio files · voice notes · exports)            │
└──────────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────────────────────┐
        │ NATIVE RENDERER  (Android, JSI/TurboModule)              │
        │  one view per page slot · StaticLayout/Canvas draw        │
        │  word rects authoritative · highlight layers · export     │
        └──────────────────────────────────────────────────────────┘
```

### 4.2 Thread model (the discipline that makes it smooth)

| Thread | Owns | Never does |
|---|---|---|
| **UI (main)** | gesture, native page draw, native overlay draw | JS calls, file I/O, text measurement in JS |
| **JS** | app state, commands, selectors, sync orchestration | `JSON.parse` of content-sized payloads, per-frame work, file I/O |
| **JSI/SQLite pool** | all DB reads/writes, prepared statements | touching UI |
| **Background (native)** | audio playback, image encode/decode, downloads, prefetch decode | |
| **Worklet (UI-thread JS)** | gesture-driven paging math (spring, snap, ring offsets) | allocation, DB, state dispatch |

Enforcement: a dev-mode guard that logs when a JS function runs >8 ms inside a gesture window, and a
lint rule banning `JSON.parse` on values above a size budget outside the content pipeline.

### 4.3 Module map (new repo layout)

```
packages/
  mushaf-renderer/          native Android view + JS fallback + geometry types
  quran-content/            build-time generator, content pack format, loaders
  reader-core/              reader store, paging engine, annotation service, hit-testing
  sync-engine/              oplog protocol, transports, conflict resolution
  data/                     repository layer, SQLite schema + migrations, prepared stmts
  design/                   theme tokens, typography scale, RTL helpers
apps/
  teach-quran/              the app: screens, navigation, tutorial, ads, settings
  content-tools/            CLI: build content pack · visual diff · grade new pages
```

If a monorepo is too much process, this can be four folders under `src/` with the same boundaries —
the point is that the renderer, the content format, the data layer and the sync protocol each have a
single owner module and a version number, and none of them imports a screen.

---

## 5. The mushaf engine (centerpiece)

### 5.1 What it is

A native Android view (Kotlin) that draws **one entire mushaf page** into a single view, and reports
the rectangle of every word so the app can hit-test taps and draw highlights — without a JS subtree
per word.

**Draw path per page:**
1. Receive (or read from `content.db`) a `PageSpec`: 15 lines, each a sequence of word records with
   `advance` (in font units), `kind`, and the verse/word coordinates.
2. Build, once per (page, width, fontScale, font): a `StaticLayout` per line (or one layout with
   per-word spans) using the bundled TTF — the exact same font files as today.
3. Measure every word's box from the layout (`LineMetrics` + `TextPaint.measureText` advances, or
   directly from the geometry advances — no `onLayout` needed).
4. Draw: text, verse badges, bismillah/surah-header/ta'awwud decorations, the frame (native draw or a
   cached texture), and the highlight layer (underline/stroke rects from annotation state).
5. Publish `wordRects` to JS via a single callback per page (`onPageReady(page, rects)`), used for
   hit-testing and for positioning the verse action menu.

**Cost:** ~15 text layouts + one canvas draw + a handful of overlay rects, versus ~350 native views.
Expected: **10–25 ms** page paint on a mid-tier phone, and page turns that are pure pixel movement.

### 5.2 Interface contract (frozen, so the JS side never depends on implementation)

```ts
// packages/mushaf-renderer/src/types.ts
export type WordKind = 'word' | 'verseEnd' | 'basmala' | 'surahHeader';
export interface WordSpec {
  id: string;            // stable: `${page}:${lineIdx}:${wordIdx}`
  text: string;          // PUA already stripped, waqf marks already nbsp-locked
  advance: number;       // font units; px = advance / unitsPerEm * fontSize
  kind: WordKind;
  surahId?: number; verseNum?: number; wordIndex?: number;   // wordIndex is 0-based, as today
  spaceAfter: number;    // inter-word advance (0 on tablets, as today)
}
export interface LineSpec {
  kind: 'text' | 'basmala' | 'surahHeader';
  words: WordSpec[];
  justify: 'start' | 'spaceBetween' | 'spaceAround' | 'center';
}
export interface PageSpec {
  page: number; script: 'uthmani' | 'indopak'; textStyle: string;
  lines: LineSpec[];
  sparse: boolean;                       // < 50 words
  decorations: { juz: number; surahId: number; pageLabel: string; pagesLeftInJuz: number };
}
export interface MushafTheme {
  textColor: string; lineColor?: 'none'; frameColor: string; frameBg: string; badgeBg: string;
  badgeBorder: string; cardBg: string; nightMode: boolean;
}
export interface MushafPageProps {
  spec: PageSpec; theme: MushafTheme;
  width: number; height: number; fontScale: number; headerVisible: boolean;
  highlightWordIds: string[];            // compact: only the ids on this page
  flashWordIds?: string[];
  showFrame: boolean; showBadges: boolean; showBottomChrome: boolean;
}
export interface MushafPageHandle {
  measure(spec: PageSpec): void;                     // rebuild layout for new spec/width/font
  setHighlights(ids: string[]): void;                // cheap invalidation only
  exportBitmap(): Promise<string>;                   // file:// PNG for share capture
  wordRect(id: string): { x: number; y: number; w: number; h: number } | null;
}
```

**The JS fallback** implements the same props/handle using today's `MushafPageView` internals. The app
targets the interface, so iOS parity and low-tier fallback are implementation details, not forks.

### 5.3 Rendering parity constants (must be reproduced exactly)

The redesign is only allowed to change *how fast* pages appear, never *how they look*. These are the
current rules, extracted from the code — the native renderer and the geometry generator must
implement them, and §25's visual diff is what proves it.

| Rule | Value | Source of truth |
|---|---|---|
| Horizontal text inset | `max(0.067 × pageWidth, frameInsetFor(pageWidth))` | `mushafLayout.ts` `textInsetFor` |
| Frame inset (h/v) | `po+go+band+gi` with `po=max(2, 0.010W)`, `go=max(1, 0.006W)`, `band=max(4, 0.027W)`, `bandV=max(5, 0.036W)`, `gi=max(1.5, 0.002W)` | `OrnamentalFrame.tsx` |
| Top/bottom pad | `max(1.0% × innerHeight, frameInsetVFor(pageWidth))` | `MushafPageView.tsx` |
| Sparse boost | total words `< 50` → font **and** lineHeight × `1.3`, lines justified `space-around` | `SPARSE_WORD_THRESHOLD`, `SPARSE_FONT_BOOST` |
| Per-font size adjust | `saleem +2`, `lateef +4`, `alqalam/uthmani +0` | `getFontAdj` |
| Word vertical lift | `adj.y + (headerVisible ? 2 : 0)` (today `adj.y` is 0 for all fonts) | `wordLiftY` |
| Line-fit scale | if `total > lineW + 2` → `max(0.5, (lineW − 12)/total)`; tablet: `clamp((lineW − 8)/total, 0.5, 1.28)` when ≥2 words | `scaleForLine` |
| Verse-boundary allowance | `+28px` per verse boundary inside a line, `+14px` more if that verse has a note | `computeLineExtra` |
| Vertical fit | `pitchScale = clamp(availH/needH, 0.5, 1)`; `fontScale = clamp(pitchScale × lineHeight/fontSize / 1.2, 0.5, 1)` | `PITCH_FLOOR_RATIO` |
| Tablet font scales | split `0.78`, landscape split `0.65` (+ lineHeight × 0.82), single-page tablet `0.88`; phones `1.0` | `mushafLayout.ts` |
| Word trailing space | appended for phones, omitted on tablets | `MushafPageView` word render |
| Ta'awwud placement | above each `surah-header` line (and above line 0 when the page starts at 1:1); font `max(12, round(fs × 0.55))` | `taawudLineSet` |
| Bismillah size | `clamp(fitLineH × 0.6, 13, 19)`; lineHeight `max(19, fitLineH × 0.9)` | `basmalaFontSize` |
| Spread gutter | `12px`; split pageWidth `(winW − 12)/2`; split requires `winW ≥ 768` | `GUTTER`, `SPLIT_MIN_WIDTH` |
| Word tap centre band | `WORD_TAP_FRACTION` of the word's width counts as a word tap; the rest is a dead tap | `constants.ts`, `WordHitArea` |

**Recommendation:** convert this table into a single shared module
(`mushaf-renderer/parity.ts`) that both implementations import, so the rules live in one place
instead of being duplicated in Kotlin and TS.

### 5.4 Algorithms to specify once (and unit-test)

**A. Geometry generation (build time).** For each page / script / font:
```
for each line:
  for each word:
     advance = textPaint.measureText(word.text) / fontSize          // in em
  lineTotal = Σ advance + verseBoundaryAllowance(line)             // no notes at build time
```
*Verse-boundary allowance is note-dependent at runtime (`+14` when a note exists).* Solution:
generate the boundary allowance **without** the note term, and add the note term at render time (it is
a constant per (page, line, verse) and cheap to recompute). Store `boundaryByLine: number[]` in the
pack, and keep the runtime `+14 × hasNote` term in the renderer.

**B. Line fitting (render time).** Identical maths to today, but from exact advances instead of
measured widths:
```
lineW = pageWidth − 2 × textInset   (or measured box width when it differs by > 16px, as today)
rawWordsTotal = lineTotal(em) × baseFontPx
total = rawWordsTotal + boundaryAllowance + (noteTerm) + tabletWordSpacing
scale = total > lineW + 2 ? max(0.5, (lineW − 12)/total) : 1
```
Because the advances are now exact and identical across devices, **the layout cache stops being a
per-device cache** — it becomes a pure function. Keep the cache as a *fast path* (it is already
written and works), but it is no longer load-bearing.

**C. Word hit-testing (render time).** Native view hit-tests the touch point against its `wordRects`
(in page coordinates), returns the word id; JS maps word id → (surah, verse, wordIndex) and applies
the annotation. Dead-tap rule preserved by shrinking each rect horizontally by
`(1 − WORD_TAP_FRACTION)/2` before testing, exactly like `WordHitArea`.

**D. Vertical fit.** Unchanged (pitchScale/fontScale above), but recomputed natively on `onLayout`
with the same 70 ms coalescing discipline for resizes and a synchronous first application.

### 5.5 What the engine deliberately keeps

* The `page_layout_cache` concept (now an optional acceleration, not a correctness dependency).
* The single-flight load discipline, but at the page-slot level.
* The full decoration set and the three themes.
* The ability to render a page in **any** of the 4 fonts and in either script.

### 5.6 What the engine deletes

* ~350 views per page, `WordHitArea` per word, per-word `onLayout` measurement, the 150 ms font gate
  (the font is loaded natively, once), the `cacheState: loading|miss|hit` state machine, the
  `fontLoadedOnce` hack, `InteractionManager` preloads, and the whole class of "measure-then-scale
  jank" bugs. All of that exists only because the layout was derived from a view tree.

---

## 6. Paging and interaction

### 6.1 Paging engine

* **Container:** native horizontal pager (RecyclerView/ViewPager2) or a `Reanimated`-driven worklet
  scroller. Page offset lives in a native/worklet value; JS never sees per-frame offsets.
* **Ring:** 3 slots (single) / 5 slots (spread). Slots are permanent for the reader's lifetime.
  A settle shifts the ring by one and re-targets the far slot.
* **Repopulation rule:** the far slot is re-targeted to `p ± 2` **only** when no gesture is active and
  no scroll momentum is running; otherwise it waits for the next idle tick (250 ms after momentum).
* **Direction awareness:** on drag start, the engine reads the direction and gives the *incoming* slot
  priority in the prefetch queue (data → layout → bitmap), so `p+1` is always ready before `p+2`.
* **Split mode:** a slot is a spread (two page renderers). Ring shifts by one spread.
* **Landings (go-to-page, deep link, surah change):** reset the ring around the target and paint it
  before animating (this is today's successful go-to-page behaviour made the *only* path).

### 6.2 The prefetch scheduler

One scheduler for the whole app, priority-ordered, coalescing by key, and paused during gestures and
audio-critical moments:

| Priority | Work |
|---|---|
| P0 | the visible page's own data (never speculated) |
| P1 | the incoming slot's data + layout |
| P2 | the outgoing slot's data |
| P3 | ±3..±6 page data (direction-biased), then bitmaps |
| P4 | bitmap pre-render for the *next* N pages (idle only, battery-aware) |
| P5 | sync work, cloud pulls, audio downloads |

Rules: 2 concurrent DB jobs max; one coalesced job per key; a new gesture cancels P3–P5 and keeps P1;
every job checks `isGestureActive()` before running and after each await.

### 6.3 Reader modes

* **Page:** the engine above.
* **Ayah / continuous:** virtualized lists with the same rules (no mounting during gesture: pre-mount
  the next screenful behind an `Animated` offset, or use a prefetch window that only grows while idle).
* All three modes read annotations from the same page-scoped store and use the same verse action menu.

### 6.4 Gesture inventory (unchanged for users, retargeted for the architecture)

Edge taps → header toggle · vertical swipe in ayah/continuous → surah change · long-press word →
verse menu with `pageY` · tap verse badge → same menu · tap word → mistake toggle · drag in drawing
mode → stroke · pinch (if ever) → font size. Each is handled on the UI thread where it is a gesture,
with a JS callback only on *completion*.

---

## 7. Content pipeline (build time)

### 7.1 What gets built

One artefact, versioned, reproducible from source-of-truth inputs:

```
content-pack/
  manifest.json          { contentVersion, geometryVersion, fonts:[...], scripts:[...], builtAt, sha256 }
  mushaf.db              read-only SQLite (or a packed binary; see 7.3)
    pages(pageNumber, script, textStyle, sparse, lineCount, wordCount, spec BLOB)
    page_geometry(pageNumber, textStyle, geometry BLOB)     ← em advances + boundary allowances
    verses(surahId, verseNumber, uthmani, indopak, translation, pageUthmani, pageIndopak)
    surahs(id, name, englishName, revelationPlace, verseCount, startPage{script}…)
    juz(juz, surahId, verseNumber, startPage{script})
    words(pageNumber, lineIdx, wordIdx, surahId, verseNumber, wordIndex, text, kind)  ← optional,
                                                                       enables FTS + tap fallback
  indices/               FTS5 index over translation + normalised Arabic (search)
  audio/manifest.json    per-qari, per-surah URL + byte size + duration + sha256 (for resumable DL)
```

### 7.2 How geometry is generated

A headless generator (Node or a Kotlin JVM tool; the Kotlin route is preferable because it uses the
**same** `StaticLayout`/`TextPaint` that the native renderer uses, eliminating metric drift):

```
for each script, for each font file in the pack:
  for each page:
    parse the page JSON (current asset) → lines/words (PUA rules already applied)
    for each word: advance_em = TextPaint.measureText(text) / fontSize
    lineBoundary[lineIdx] = 28 × (number of verse boundaries in the line)   // note term added at runtime
    store { words:[{text, advance_em, kind, coords}], boundary }
```
Run it as a CI job; commit the pack as a release artefact and (optionally) host it for OTA updates of
content without a Play release.

### 7.3 Pack format

* **SQLite + BLOBs** is the pragmatic choice: it reuses the reader you already trust, is indexable,
  and gives you FTS5 for free. Page `spec` BLOBs should be **binary-packed, not JSON** (a compact
  varint/typed array layout), because parsing 611 JSON documents at runtime is exactly the class of
  work P3/P5 forbid.
* Optional upgrade: a single memory-mappable binary blob with an offset table — instant random page
  access with zero parsing. Only if profiling shows SQLite BLOB reads are a bottleneck (they should
  not be).

### 7.4 What the app no longer does at runtime

`fetchMushafPages` (604 GitHub downloads), `downloadAndCacheQuran`'s verse download, the first-run
"usable at 6000 verses" heuristic, `importIndopakPages`, the asset-DB copy-on-first-open dance, and
every per-device layout derivation. **Cold start becomes fully offline.**

*(Keep a content-update path: if `contentVersion` in the app is older than the manifest on your CDN,
download the delta pack in the background and swap it atomically on next launch.)*

---

## 8. Persistence layer

### 8.1 Driver

Replace `react-native-sqlite-storage` (bridge, string SQL, per-call round trip) with a **JSI SQLite**
driver (e.g. `op-sqlite`, or a thin TurboModule over the C API). Why:

* page/annotation reads become synchronous-or-near, with no bridge payload serialisation;
* prepared statements remove per-call compilation (the app currently re-parses the same SELECTs
  thousands of times per session);
* it runs on a dedicated thread pool with an explicit API for "read on the DB thread, hand me a
  plain object";
* combined with §4.2 it gives you a place to *enforce* the threading rule.

### 8.2 Two databases

| DB | Contents | Lifecycle |
|---|---|---|
| `content.db` | the read-only content pack (§7) | shipped in the AAB, replaced atomically on content update |
| `user.db` | annotations, students, sync state, local caches | user data, migrated with `schemaVersion` |

Splitting them means a content update can never corrupt (or be blocked by) user data, and
"delete cache" vs "delete data" become unambiguous operations.

### 8.3 Normalised user schema (replaces the blob model)

```sql
-- students
CREATE TABLE students (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, faceUri TEXT, createdAt INTEGER, updatedAt INTEGER,
  deleted INTEGER DEFAULT 0
);

-- one row per annotation: the whole point of the redesign
CREATE TABLE annotations (
  id TEXT PRIMARY KEY,                -- uuid, generated on device
  studentId TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- 'highlight' | 'note' | 'bookmark' | 'readingMark' | 'voiceNote' | 'drawing'
  pageNumber INTEGER,                 -- for O(1) page lookup (script-normalised page of the annotation)
  surahId INTEGER, verseNumber INTEGER, wordIndex INTEGER,
  canvasKey TEXT,                     -- for drawing/voiceNote ranges (kept for parity with today's keys)
  payload TEXT,                       -- small JSON: text, ranges, local file path, etc.
  createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
  deviceId TEXT NOT NULL,
  deleted INTEGER DEFAULT 0,          -- tombstone
  dirty INTEGER DEFAULT 0,            -- needs push
  v INTEGER DEFAULT 0, serverTs INTEGER DEFAULT 0
);
CREATE INDEX idx_ann_student_page ON annotations(studentId, pageNumber) WHERE deleted = 0;
CREATE INDEX idx_ann_student_kind ON annotations(studentId, kind)        WHERE deleted = 0;
CREATE INDEX idx_ann_dirty        ON annotations(dirty)                  WHERE deleted = 0;
CREATE INDEX idx_ann_canvas       ON annotations(studentId, canvasKey)   WHERE deleted = 0;

-- strokes: binary, not JSON-in-JSON
CREATE TABLE drawings (
  id TEXT PRIMARY KEY, studentId TEXT NOT NULL, canvasKey TEXT NOT NULL,
  strokes BLOB NOT NULL,              -- compacted binary (Float32Array layout)
  updatedAt INTEGER, deviceId TEXT, deleted INTEGER DEFAULT 0, dirty INTEGER DEFAULT 0,
  v INTEGER DEFAULT 0, serverTs INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX idx_draw_canvas ON drawings(studentId, canvasKey);

-- local reading positions (device-local memory, as today)
CREATE TABLE reading_positions (
  studentId TEXT PRIMARY KEY, pageNumber INTEGER, surahId INTEGER, verseNumber INTEGER,
  pageUthmani INTEGER, pageIndopak INTEGER, updatedAt INTEGER
);

-- sync protocol state
CREATE TABLE sync_state     (k TEXT PRIMARY KEY, v TEXT);       -- cursors per collection, deviceId, protocolVersion
CREATE TABLE sync_oplog     (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT, entityId TEXT,
                             op TEXT, payload TEXT, createdAt INTEGER, attempts INTEGER, sentAt INTEGER);
CREATE TABLE media_cache    (k TEXT PRIMARY KEY, kind TEXT, path TEXT, bytes INTEGER, sha TEXT, lastUsedAt INTEGER);
CREATE TABLE page_bitmaps   (k TEXT PRIMARY KEY, page INTEGER, textStyle TEXT, width INTEGER, dpi INTEGER,
                             theme TEXT, path TEXT, bytes INTEGER, lastUsedAt INTEGER);
```

**Key wins:** "annotations on page 254" is one indexed query (and one map lookup once cached);
a highlight change touches one row; nothing needs a whole-student read; drawings are binary.

### 8.4 Migration from today's tables

One migration (`schemaVersion` 1 → 2) that **reads the existing blobs once** and explodes them into
rows:

```
student_data_cache(studentId, canvasKey, data, v) →
  data.bookmarks    → annotations(kind='bookmark')
  data.sel        → annotations(kind='highlight')
  data.notes        → annotations(kind='note')
  data.lastRead     → annotations(kind='readingMark') + reading_positions
  data.strokes      → drawings
student_manifest_cache → students + reading_positions
audio_notes_cache      → annotations(kind='voiceNote')
```
Run it in a transaction with a `schemaVersion` guard, keep the old tables read-only for one release
(dual-write is **not** needed if the migration is atomic and verified — see §18 Wave 2), and never
delete them until the new path has shipped for a full release cycle.

---

## 9. State layer

### 9.1 Split the state by lifetime

| Store | Contents | Update frequency |
|---|---|---|
| **Auth** | session, uid | rare |
| **Students** (normalised: `byId`, `allIds`, `activeId`) | list, faces, metadata | rare |
| **Settings** | appearance + reader prefs (**persisted**, incl. `textStyle`, `fontSize`, `readingMode`, `showTranslation`) | on user action |
| **Reader** | current page, layout, slots, per-page annotation sets, selection, drawing session | per interaction — **never in Redux** |
| **Audio** | qari, playing, verse, position (`position` lives in the native player, JS mirrors only what the UI needs) | per audio tick |

### 9.2 The reader store rules (this is what kills the re-render class)

1. Page data is held per page: `pages: Map<page, PageRecord>`; a page's arrival updates only that
   slot's subscription.
2. Annotations are held per page: `annotationsByPage: Map<page, AnnotationSet>`. Applying one
   highlight creates a **new set for one page** and leaves every other page's identity untouched.
3. Slots subscribe to `(slotPage, layoutKey, themeKey)`, not to the whole store.
4. Layout inputs are primitives (`width`, `dpi`, `fontScale`, `headerVisible`) so a change is a
   compare, not a deep diff.
5. No per-frame values in the store: offsets live in worklets/native values.

### 9.3 Persistence policy

Persist only what is (a) user intent or (b) expensive to recompute. Everything else is derived — a
class of bugs disappears with the `PersistGate` blanking the app on a corrupt payload.

---

## 10. Sync engine v2 (oplog + last-write-wins)

### 10.1 Why the current design cannot be made reliable

Today: whole-student (later per-canvas) JSON documents with a `v` counter, pushed with
`Firestore.set(merge)`, pulled by comparing versions, with a `sync_queue` row per key and a badge that
counts keys. It has known issues recorded in the codebase itself: 1 MB document limits, doc-level
last-write-wins with version skew, ping-pong re-queueing, drawings that never enter the queue, and
no way to answer "which device wrote this".

### 10.2 Target design

**Model:** every mutation is an immutable op referencing an entity.

```ts
type Op = { id: string; entity: 'annotation'|'drawing'|'student'|'readingPosition';
            entityId: string; op: 'upsert'|'delete'; payload: unknown;
            updatedAt: number; deviceId: string };
```

* **Push:** batch up to N ops (size-capped, e.g. 200 KB) to a callable Cloud Function
  `applyOps({ studentId, ops })` carrying an idempotency key. The function validates, applies each op
  to Firestore records (`users/{uid}/students/{sid}/annotations/{id}`), and returns an accepted
  watermark. Successful ops are marked sent and removed from the local oplog.
* **Pull:** per collection, `where updatedAt > cursor orderBy updatedAt limit 500`, page until
  drained. Apply with LWW and tombstone handling; store the new cursor.
* **Conflict rule:** per *entity*, `(updatedAt, deviceId)` — deterministic, no negotiation. Notes text
  is the only entity where silent LWW could lose meaningful work, so keep both versions in a
  `conflicts` table and surface a small "resolve" affordance in the notes screen (optional, phase 2).
* **Deletes:** tombstone (`deleted=1`) locally and remotely; garbage-collect tombstones older than
  90 days in the Function.
* **Media (voice notes, drawing exports):** bytes go to Firebase Storage; only the path/metadata op
  syncs.
* **Backoff & reliability:** exponential backoff with jitter on the oplog, `attempts` counter,
  foreground/interval/manual triggers, and an explicit "N changes pending / last synced" surface.
  Idempotent by construction, so retries can never double-apply.
* **Testing:** a spec-driven harness that runs two simulated devices against an in-memory transport,
  with adversarial interleavings (both edit the same word, delete-then-edit, offline for 200 ops,
  clock skew). This is the single highest-value test suite in the app.

### 10.3 Security rules

Firestore rules must be rewritten around the new paths: a user may touch only
`users/{uid}/**`, ops must carry a valid `deviceId`, `updatedAt` must be server-clamped to prevent
clock-skew poisoning, and writes are rejected if the payload exceeds a size budget. Storage rules
mirror the ownership path. Add a rules unit test suite to CI.

---

## 11. Audio and media

* **Player:** a real media player with a media session (`react-native-track-player` or a small
  ExoPlayer TurboModule). Position and verse advancement come from the player, not JS timers —
  background playback, lock-screen controls and gapless verse transitions become free rather than
  fragile.
* **Sources:** keep the current CDN patterns (everyayah + cdn.islamic.network fallbacks); ship a
  manifest with byte sizes so downloads are resumable and progress is accurate.
* **Downloads:** one queue manager (priority: current surah > next surah > bulk), resumable ranges,
  integrity check by `sha256`, LRU eviction under a user-visible size budget.
* **Voice notes:** record natively to compressed audio, store metadata as an annotation, sync the
  file to Storage, play via the same player.
* **Never on the JS thread:** file existence checks, directory scans (`getDownloadedSurahs` currently
  scans the filesystem), and size accounting. Keep an index table instead of scanning.

---

## 12. Search and indices

* **Surah / juz / page** entry points come from the content pack (no computation, no downloads).
* **Text search:** SQLite FTS5 over translation + normalised Arabic (diacritic-stripped, alef/hamza
  normalised) built at build time. Turns "find this ayah" into a sub-100 ms query — a feature the app
  cannot afford to build on the runtime-download model.
* **In-page search highlighting** uses the same `wordRects` the renderer already publishes.

---

## 13. App shell, startup, navigation

### 13.1 Cold start target: interactive in < 1.2 s, offline, no spinner of doom

Sequence: native splash → open `content.db` (read-only, no copy step) → rehydrate a **small**
persisted state (auth + settings + active student id) → render the Dashboard/StudentHub with cached
student list → fire-and-forget: sync, prefetch, content-update check. **No network is required for
anything above the fold.**

Concretely, remove from the critical path: the "download 6234 verses" bootstrap, the "usable at 6000"
heuristic, the mushaf page download, the indopak asset-DB first-open copy, and `PersistGate
loading={null}` blanking.

### 13.2 Navigation

Keep React Navigation (it is not the problem) but: `freezeOnBlur` for inactive screens, lazy-mount
list/index screens, and ensure the reader is the only screen that owns a pager. Deep links
(`{ studentId, surahId, scrollToVerse, page }`) become a single typed contract
(`RootStackParamList`) instead of `as any` params — this alone removes a class of "the reader opened
at the wrong place" bugs that the current code defends against with timers and refs.

---

## 14. Device tiers and graceful degradation

| Tier | Detection | Page rendering | Ring | Extras |
|---|---|---|---|---|
| **A — high** | 64-bit, ≥4 GB RAM, API ≥ 29 | native text canvas, live highlights | 3 (5 spread) | bitmap pre-render ahead, animations on |
| **B — mid** | 64-bit, 2–4 GB RAM | native text canvas; disk-cached page bitmaps reused when theme/width unchanged | 3 | pre-render only next page |
| **C — low** | 32-bit or <2 GB RAM or API < 26 | **bitmap-only mode**: pre-rendered page bitmaps (from the pack or generated once on a charge/idle) + geometry overlay | 3, no pre-render | reduced effects, no shadow/elevation, smaller cache |

**Same features everywhere.** Tier C users still tap words, highlight, bookmark, draw and sync — they
simply see a cached raster of the page instead of a live canvas. Tier detection is advisory and
overridable in Settings (some users on bad hardware will still want text).

This is the answer to "smooth on all types of slow devices": the low tier stops asking the device to
do *any* text layout at swipe time.

---

## 15. Design system, RTL, accessibility

* **One tokens module** (`design/`): colour themes (classic/emerald/obsidian × night), spacing,
  radius, typography scale, and the mushaf-specific constants of §5.3. Today's 9 copies of the
  `styles(nightMode)` factory pattern (`PageLoad.md` S1) disappear because styles are built from
  tokens once.
* **RTL is a first-class mode**, not a `row-reverse` trick in one file: layout direction set at the
  root, `I18nManager` configured, and text drawing handled by the native engine where direction is
  explicit.
* **Accessibility:** mushaf text is not a `Text` node in the native renderer, so expose
  accessibility actions (`increment`/`decrement` for word/verse navigation, a labelled `contentDescription`
  for the page) and keep tap targets ≥ 44 dp. Note this as a real regression risk of the redesign and
  handle it deliberately, not accidentally.
* **Font scale:** the mushaf has its own scale (parity table); the chrome follows the system scale
  within clamp limits.

---

## 16. Observability, budgets, CI

### 16.1 Performance budgets (acceptance criteria, per tier)

| Metric | Tier A | Tier B | Tier C |
|---|---|---|---|
| Cold start → interactive (no network) | < 900 ms | < 1.2 s | < 1.6 s |
| Student hub → first page painted | < 180 ms | < 250 ms | < 350 ms |
| Page turn (finger-up → fully painted) | < 40 ms | < 70 ms | < 110 ms |
| Steady swipe frame time | 16.6 ms | < 18 ms | < 25 ms |
| Worst frame during a 100-page fling | < 60 ms | < 100 ms | < 150 ms |
| Word tap → highlight visible | < 32 ms | < 50 ms | < 50 ms |
| Memory (reader, steady state) | < 220 MB | < 200 MB | < 160 MB |
| AAB download size | budget set by whoever owns Play size risk (see §20) | | |

### 16.2 Instrumentation to build in from day one

Systrace/Perfetto markers around: page paint, layout build, DB read, bitmap decode, ring shift,
annotation apply. A dev HUD (as in `PageLoad.md` S14, but native-aware) showing the same four numbers
per gesture. A CI job that runs the **headless render benchmark** (render 50 representative pages
natively, report ms/page per tier profile) so regressions are caught before a device is involved.

### 16.3 CI gates

typecheck · unit tests (geometry, fit maths, hit-testing, oplog merge, migration) · golden-image
visual diff (§25) · rules tests · bundle-size delta · benchmark delta. Nothing about this app is hard
to test except *visual* rendering — which is exactly why the golden-image harness must exist.

---

## 17. Security and privacy

* Auth stays username→email, but the mapping must be documented as permanent and non-reversible.
* Firestore rules rewritten per §10.3 with tests; Firestore rejects oversized payloads.
* Local DB is app-private; exported/shared images contain only what the user chose to share.
* No analytics that leak student/annotation content; if you add telemetry, keep it to perf counters.
* Voice notes and drawings live under the user's own storage path with rules that mirror ownership.

---

## 18. Migration plan (strangler fig — every wave ships)

**Do not do a big-bang rewrite.** You have users, data and a Play listing. Each wave below is
independently shippable, independently revertible, and leaves you with a better app if you stop after
it.

| Wave | Deliverable | Why it's safe | Time | Value at the end |
|---|---|---|---|---|
| **0** | Instrumentation + frozen contracts: perf budgets, dev HUD, typed navigation params, `schemaVersion`/`contentVersion`/`rendererVersion` plumbed but unused | pure addition | 1–2 wk | You can finally measure; no behaviour change |
| **1** | **Content pack**: build `content.db` (pages + geometry + verses + indices + surah/juz maps), ship it in the AAB, flip the reader to read it, delete the first-run download paths (keep a CDN delta-update path) | falls back to today's tables if the pack is missing/corrupt | 2–3 wk | Fully offline first run; no JSON parsing; no on-device measurement for pages with geometry |
| **2** | **JSI SQLite + normalised annotations** + one-shot migration from the blobs; annotation reads become per-page queries; write-behind queue introduced | migration is transactional and verified; old tables kept read-only | 3 wk | O(1) annotation reads; the re-render class (F4) disappears |
| **3** | **Native mushaf renderer** (Android) behind `settings.renderer = 'native' \| 'legacy'`, auto-enabled by tier in a later point release; JS renderer stays as the fallback and iOS path | flag + fallback + golden-image diff | 4–6 wk | Page paint 10–25 ms; the feature you actually want |
| **4** | **Paging engine**: native pager + 3-slot ring + priority prefetch scheduler; delete the FlatList page path and its offset self-validation | behind the same flag; go-to-page path reused as the reset case | 2 wk | Swipes never mount anything; no mid-gesture work |
| **5** | **Sync v2** (oplog + LWW + tombstones + Functions), dual-*verify* (compute v2 result and compare with v1 without writing) for one release, then flip | dual-verify then flip; v1 keeps working until the comparison is clean | 3–4 wk | Reliable multi-device sync, no blob conflicts, no ping-pong |
| **6** | **Cleanup + platform**: delete legacy paths, upgrade RN to a current line, adopt Fabric/TurboModules for the renderer (JSI already gives most of it), add media session, FTS search, tier detection | the app is already on the new architecture inside each layer | 2–3 wk | Maintainable, current, and room to grow |

**Total ≈ 4–5 months for one strong dev + AI agents; ≈ 2.5–3 months for two.** Waves 0–1 alone are
worth shipping to the Play Store within a month and already transform cold start and first-visit
pages.

### 18.1 Sequencing for a solo developer with AI agents

1. Wave 0 (2 weeks) — and in parallel, land `PageLoad.md` Phases 1–2 (cheap wins, same week).
2. Wave 1 content generator: this is the most AI-agent-friendly work in the whole plan (pure
   build-time code + tests + golden output). Review the *outputs* (page renders), not the codec.
3. Wave 2 migration: write the migration test first (feed it the old blobs, assert the row set).
4. Wave 3 native renderer: treat the parity table (§5.3) as the spec and the golden images (§25) as
   the oracle. Expect 60% of the effort here and plan for iteration on spacing/kerning.
5. Waves 4–6 after the renderer is proven on real devices, in that order.

---

## 19. Feature parity matrix (nothing may be lost)

| # | Feature | Today | Redesigned | Risk |
|---|---|---|---|---|
| 1 | Username auth / register / logout | Firebase Auth + email mapping | unchanged (rules rewritten) | low |
| 2 | Multi-student CRUD + faces | Firestore + `student_list_cache` | Firestore + `students` table, normalised | low |
| 3 | Student hub (resume, daily, go-to-page, indices) | per-student reads + manifest | same UI, data from `reading_positions` + annotations | low |
| 4 | 3 reading modes | FlatList / ScrollView / page FlatList | pager (page) + idle-prefetched lists (ayah/continuous) | medium |
| 5 | 2 scripts, 4 fonts, 604/611 pages | asset DB + runtime JSON + per-device layout | content pack + shipped geometry + native render | **high (visual parity)** |
| 6 | Frames, pills, bismillah, surah headers, ta'awwud, sparse pages | JSX + SVG frame | native draw using §5.3 constants | medium |
| 7 | Themes, night mode, brightness, font size | Redux settings + style factories | design tokens, persisted settings | low |
| 8 | Tablet spread + landscape scaling | 2 `MushafPageView`s per spread item | spread slot = 2 renderers; same constants | medium |
| 9 | **Word tap → mistake highlight** (centre band) | `WordHitArea` measured width | native `wordRects` hit-test with the same fraction rule | **high (must be exact)** |
| 10 | Verse menu via long-press / badge | `pageY` from the press event | `pageY` from native rects/menu anchor | medium |
| 11 | Bookmarks | manifest blob | `annotations(kind='bookmark')` | low |
| 12 | Reading mark + ribbon + date | `lastRead` + per-page derivation | `annotations(kind='readingMark')` + `reading_positions` | low |
| 13 | Text notes | chunk JSON | `annotations(kind='note')` | low |
| 14 | Voice notes (record/play/delete/sync/registry) | `audio_notes_cache` ranges + Storage | `annotations(kind='voiceNote')` + binary drawings/files | medium |
| 15 | Drawing canvas (pen/eraser/underline, undo, split origins, lazy sync) | JSON strokes in chunks | `drawings` BLOB + ops | medium |
| 16 | Share capture with layer toggles | `view-shot` of the reader tree | native `exportBitmap()` (higher fidelity, faster) | medium |
| 17 | Audio (qaris, verse play, loops, page turns, basmala, downloads, resume) | `AudioRecorderPlayer` + JS timers | media session player + download queue + manifest | medium |
| 18 | Sync (auto/manual, badge, offline) | blob push/pull + queue rows | oplog push/pull + cursors | **high (data)** |
| 19 | Tutorial (chapters, anchors, actions, hand) | overlay + runtime events | unchanged; anchors become native-view-backed | low |
| 20 | Ads (collapsible banner) | AdMob banner | unchanged, loaded after first paint | low |
| 21 | Index screens + reading history | SQL + Redux slices | SQL over content pack + annotations | low |
| 22 | Settings (full inventory) | `settingsSlice` + screen | tokens + persisted settings store | low |
| 23 | Haptics + disable switch | `react-native-haptic-feedback` | unchanged | low |
| 24 | Offline-first | partially (network bootstrap) | fully (content pack + oplog) | — |
| 25 | Error boundary / degradation | `ErrorBoundary` | + per-subsystem fallbacks (P10) | low |

**Two rows are marked high risk and both are covered by §25.** Everything else is either unchanged or
a mechanical port.

---

## 20. Risk register and explicit non-goals

### 20.1 Risks (with mitigations)

| Risk | Mitigation |
|---|---|
| Visual drift between the JS renderer and the native renderer | golden-image diff on representative pages × fonts × themes × widths, in CI, with a tolerance of 0 on geometry and ≤1 px on anti-aliasing |
| Word-tap precision regressions | the tap fraction rule is a shared constant, unit-tested; a debug overlay drawing computed rects on screen; a device test with a stylus and a fat finger |
| Data loss during the sync migration | migration is local & transactional; sync v2 runs in dual-*verify* for a release; tombstones + `conflicts` table; export/import a full JSON backup feature added in Wave 2 as a safety net |
| Native renderer drains battery on old devices | tier C is bitmap-only; bitmap pre-render is charge/idle-aware and capped |
| AAB size growth (content pack + bitmaps) | byte budget in CI; bitmaps optional/downloaded; content pack compressed; measure Play size impact in Wave 1 |
| Solo-dev velocity | every wave ships; no wave is a prerequisite for the *previous* wave's value; the renderer is behind a flag |
| Scope creep into a UI rewrite | screens stay; the redesign touches renderer, content, data, sync, threads only |

### 20.2 What I would deliberately NOT do

1. **Not a rewrite in Flutter/Kotlin/Compose.** You would lose the Redux/navigation/tutorial/ads
   ecosystem and re-learn 18,000 lines of product logic to gain — at best — the same native renderer
   you can add *inside* React Native in 4–6 weeks. The only winning move a rewrite offers is a native
   text view, and you can have that without leaving RN.
2. **Not raster-only mushaf.** Pre-rendered images with no geometry would kill word-level mistakes,
   which is the product. Images are a *tier-C fallback*, never the primary.
3. **Not "load all pages into memory".** 611 pages of geometry is fine; 611 pages of decoded
   bitmaps/views is not. Bounded caches only.
4. **Not a state-library migration for its own sake.** Keep Redux (or swap to Zustand) — the win
   comes from *granular subscriptions and stable identities*, which either can do.
5. **Not a JSON-free everything rewrite of the sync protocol in one release.** Ship it behind
   dual-verify (§18 Wave 5) so a mistake cannot lose a teacher's annotations.
6. **Not a "new architecture first" project.** Do the renderer and content pipeline first; adopt
   Fabric/TurboModules where the renderer needs them, and let the full upgrade happen in Wave 6 when
   the app is already lean.
7. **Not shipping optimisation without instrumentation.** No change lands without a before/after
   number from §16.1.

---

## 21. Timeline, staffing, and the next two weeks

### 21.1 Effort summary

| Wave | Scope | One dev + agents | Two devs |
|---|---|---|---|
| 0 | Instrumentation + contracts | 1–2 wk | 1 wk |
| 1 | Content pack + offline startup | 2–3 wk | 1.5 wk |
| 2 | JSI SQLite + normalised annotations + migration | 3 wk | 2 wk |
| 3 | Native mushaf renderer + parity harness | 4–6 wk | 3 wk |
| 4 | Paging engine (native pager + ring + scheduler) | 2 wk | 1.5 wk |
| 5 | Sync v2 | 3–4 wk | 2 wk |
| 6 | Cleanup, platform, media session, search, tiers | 2–3 wk | 2 wk |
| | **Total** | **≈ 17–23 wk** | **≈ 13 wk** |

### 21.2 The next two weeks (concrete)

1. Land `PageLoad.md` Phase 1 items (stylesheet freeze, list plumbing memo, verse-memo read, layout
   preload early-out, `allowFontScaling={false}`) — days 1–2.
2. Build the dev HUD + Perfetto markers (Wave 0) and record the baseline table for your worst device
   — days 2–4.
3. Prototype the native renderer on **one page** in a scratch app: same TTF, same 15 lines, draw with
   `StaticLayout`, print the ms/page and print every word's rect. This is the single highest-value
   experiment in the whole plan — it either validates decision #1 or changes it, for ~2 days of work
   — days 5–7.
4. Write the geometry generator for 10 pages and compare its em advances against today's measured
   widths on one device. If they agree within a pixel, the content-pack approach is proven — days 8–10.
5. Start the migration test for Wave 2 (feed the current blob format, assert the row set) — days 11–14.

If step 3 shows a page painting in ~15 ms on a low-end phone, commit to the plan. If it does not,
stop before Wave 3, ship Waves 0–2, and rely on tier-C bitmaps for the low end.

---

## 22. Appendix A — data contracts

### 22.1 Firestore layout (v2)

```
users/{uid}
  profile                       { username, createdAt }
  students/{sid}                { name, faceUri, createdAt, updatedAt, deleted, v }
  students/{sid}/annotations/{id} { kind, pageNumber, surahId, verseNumber, wordIndex,
                                    payload, updatedAt, deviceId, deleted, v }
  students/{sid}/drawings/{canvasKey} { strokes (base64 or Storage ref), updatedAt, deviceId, v }
  students/{sid}/sync/state     { cursorMarker, protocolVersion, lastWriterDeviceId }
  media/{sid}/{kind}/{id}       { path, bytes, sha, mime, createdAt }
```

### 22.2 Local ↔ remote mapping

| Local | Remote | Notes |
|---|---|---|
| `annotations` row | `students/{sid}/annotations/{id}` | 1:1, `dirty` drives push, `updatedAt`+`deviceId` drive LWW |
| `drawings` row | `students/{sid}/drawings/{canvasKey}` | strokes as BLOB locally, Storage-backed remotely |
| `reading_positions` | `students/{sid}.readingPosition` | device-local also kept for RESUME |
| `students` | `students/{sid}` | normal, not blobbed |
| oplog | — | local only |
| `sync_state` | — | local only |

### 22.3 Op envelope

```json
{ "protocol": 2, "deviceId": "a1b2…", "batchId": "uuid", "ops": [
  { "opId": "uuid", "entity": "annotation", "entityId": "uuid", "op": "upsert",
    "updatedAt": 1737052800123, "payload": { "kind": "highlight", "pageNumber": 254,
    "surahId": 2, "verseNumber": 255, "wordIndex": 3, "payload": "{\"range\":[3,4]}" } }
]}
```

---

## 23. Appendix B — native renderer sketch (Kotlin)

```kotlin
class MushafPageView(context: Context) : View(context) {
    private var spec: PageSpec? = null
    private var layouts: List<Layout> = emptyList()          // one per line
    private var rects: MutableMap<String, RectF> = mutableMapOf()
    private var highlights: Set<String> = emptySet()
    private var theme: MushafTheme = MushafTheme.light()

    fun measure(spec: PageSpec, width: Int, fontScale: Float, headerVisible: Boolean) {
        this.spec = spec
        val padH = textInsetFor(width)                       // parity: mushafLayout.textInsetFor
        val lineW = width - 2 * padH
        val basePx = mushafFontPx(width, headerVisible) * fontScale
        layouts = buildLayouts(spec, basePx, lineW)           // StaticLayout per line, fit-scaled
        rects = computeWordRects(layouts, padH, spec)          // authoritative word boxes
        invalidate()
        onPageReady?.invoke(spec.page, rects)                  // → JS hit-testing + menu anchors
    }

    override fun onDraw(canvas: Canvas) {
        drawFrame(canvas)                                      // parity: OrnamentalFrame geometry
        layouts.forEach { it.draw(canvas) }
        drawVerseBadges(canvas)
        drawHighlights(canvas, highlights)                     // rects/underlines only
        drawFlash(canvas)
    }

    fun hitTest(x: Float, y: Float): String? {                 // centre-band rule applied here
        rects.forEach { (id, r) ->
            val inset = r.width() * (1f - WORD_TAP_FRACTION) / 2f
            if (x >= r.left + inset && x <= r.right - inset && y >= r.top && y <= r.bottom) return id
        }
        return null
    }

    fun exportBitmap(): Bitmap { … }                           // for share capture
}
```

**JS side** wraps it with the `MushafPageProps`/`MushafPageHandle` contract of §5.2, so
`reader-core` never knows whether it is talking to Kotlin or to the JS fallback.

---

## 24. Appendix C — how the redesign answers the specific complaints

| Complaint (verbatim) | Root cause | Fix in this design |
|---|---|---|
| "pages load slowly on phones" | F1 view-tree mount + F3 runtime derivation | native canvas (§5) + content pack (§7) |
| "sometimes fast, sometimes slow" | F5 duplicate reads + bursts + GC churn | priority scheduler (§6.2) + thread discipline (§4.2) + normalised state (§9) |
| "not AAA quality" | the swipe is doing work | ring buffer + UI-thread gestures (§6.1) |
| "go-to-page is fast, I hooked everything up to it" | go-to-page pre-charges the target | that path becomes *the only* path (§6.1 landing rules) |
| "tried most things, no help" | caching cannot fix a mount cost | the floor moves from ~350 views to 1 canvas (§5.1) |
| "everyone uses IndoPak + page swipe" | the hot path | optimised first everywhere in this plan |
| "no feature breaking" | — | §1 contract + §19 parity matrix + §25 harness |
| "super smooth on slow devices" | tier C still lays out text | bitmap-only mode for tier C (§14) |

---

## 25. Appendix D — test plan (the oracle for "nothing broke")

1. **Golden-image harness.** Render a fixed sample (≈60 pages chosen to cover: sparse pages, single-
   line pages, multi-surah pages, ta'awwud, bismillah, dense verse boundaries, page 1/2/254/604/611,
   landscape spread, all 4 fonts, 3 themes, night mode, header on/off, font size min/default/max) with
   the **legacy renderer** and the **native renderer**, and diff byte-for-byte per pixel. Geometry
   (word rects) must match **exactly**; raster must match within a 1 px tolerance. This is CI.
2. **Unit tests:** geometry generation, line fit, vertical fit, hit-test centre band, oplog merge
   (including clock skew, delete-vs-edit, offline replay), migration from old blobs, page-number
   mapping uthmani↔indopak, juz/surah maps.
3. **Two-device sync simulation** (in-memory transport) with adversarial interleavings.
4. **Device matrix smoke:** tier A/B/C phones, the §19 feature list, plus force-stop/cold-start,
   rotation, low storage, offline, airplane-mode mid-sync, and audio background playback.
5. **Memory/stability soak:** swipe 600 pages continuously, draw, annotate, sync, play audio; assert
   memory ceiling and zero crashes; run on the oldest supported device.

---

## 26. Appendix E — what the first PR sequence looks like

Ordered, small, reviewable — the physical shape of Waves 0–1:

1. `feat(perf): dev HUD + perf marks` (Wave 0)
2. `chore: typed navigation params (RootStackParamList)` (Wave 0)
3. `feat(content): content-pack format + generator skeleton + 10-page fixture` (Wave 1)
4. `feat(content): generate geometry for all pages/fonts + golden fixture test` (Wave 1)
5. `feat(content): load pages from content.db behind a loader interface; legacy tables as fallback` (Wave 1)
6. `feat(startup): remove the first-run download path; fully offline cold start` (Wave 1)
7. `feat(content): CDN delta-update check (background, atomic swap)` (Wave 1)
8. `feat(data): JSI sqlite driver behind the existing repository interface` (Wave 2)
9. `feat(data): normalised annotation tables + transactional migration from blobs` (Wave 2)
10. `test(data): migration fixture suite from real v1 blob samples` (Wave 2)
11. `feat(reader): page-slot store with per-page annotation sets` (Wave 2/3 bridge)
12. `feat(renderer): native page canvas spike on one page (behind a flag)` (Wave 3 start)

Then Wave 3 proper, Wave 4, Wave 5, Wave 6 — each gated on the golden-image harness and the §16
budgets.

---

### Closing note

The app's problem is not that the code is badly written — it is unusually well documented and full of
carefully earned fixes. The problem is that five foundational choices (per-word widgets, mounting
during gestures, runtime-derived layout, blob-shaped data, unbounded threading) put a **hard floor** on
page latency that optimisation cannot cross. This design keeps every feature, keeps the screens, and
moves the floor by rebuilding four layers. `PageLoad.md` buys you weeks; this buys you the product you
want to ship.
