# CompleteRebuild.md — how I would build **Teach Quran** from zero

**What this is:** a green-field design. If I were the architect and CTO and could rebuild this app
from an empty repository — keeping every feature users have today, free to change anything else — this
is exactly what I would build, why, and in what order.
**Relationship to the other docs:**
`PageLoad.md` = fix the current app this week.
`CompleteRedesign.md` = evolve the current app's performance architecture without a rewrite.
**`CompleteRebuild.md` (this) = ignore the current code and design the app properly.**
Where this document disagrees with the other two, this one wins — because it designs the problem
correctly instead of working around it.
**Status:** proposed blueprint. No source file has been changed by this document.

---

# PART I — WHAT AND WHY

## 0. The one-paragraph version

Teach Quran is a **professional tool for Qur'an teachers**, not a reading app. The teacher sits beside
a student, the student recites from the mushaf on the phone, and every time the student makes a
mistake the teacher taps the word and it is marked — permanently, in the student's record, syncing to
the teacher's other devices, feeding a revision plan for the next lesson. Everything else (audio,
bookmarks, notes, drawings, sharing) exists to serve that loop. So the app has exactly two things it
must be brilliant at: **showing a mushaf page instantly, and marking a word in under 30 ms.** Every
architectural decision in this document follows from those two sentences. The current app was built
the other way round — a general React Native app that happens to render a mushaf — and that is why
pages load slowly and no amount of caching fixed it.

## 1. The product, in one page

**Who uses it**

| Role | Needs | Frequency |
|---|---|---|
| **Teacher** (primary user, our customer) | mark mistakes while listening, keep per-student records, plan the next lesson, share progress, work offline in a madrasah with bad wifi | daily, 2–6 h sessions |
| **Student** (present in the room, not yet a user) | see the same page, watch the marks appear, hear the reciter, later: revise at home | on the teacher's device today |
| **Parent** (secondary, later) | a simple report of progress | weekly |

**The core loop (design for this, everything else is support)**

```
open student → land on the exact page they stopped on → student recites →
teacher taps words that are wrong (categorised) → marks save instantly, offline-first →
"saved, 3 changes to sync" → next lesson opens with "12 unresolved mistakes on 4 pages"
```

**What must be world-class**

1. **Time to first readable page** after choosing a student: target **< 250 ms**, on a 4-year-old phone.
2. **Time from tapping a word to seeing the mark**: target **< 30 ms**, no spinner, offline, always.
3. **Never lose a mark.** A teacher's record is months of work. Losing it is unforgivable.

**What must merely be good**

Audio playback, sharing, reports, tutorial, settings, search. All of these matter, none of them justify
a risk.

**Deliberate product position**

This is a *teaching instrument*. It is not a general Quran app (there are many, and they are free). The
competition is a paper mushaf, a red pen, and a notebook — and we beat those on record-keeping,
revision planning, sharing, and never losing a page.

## 2. Product & engineering principles

| # | Principle | What it forbids |
|---|---|---|
| P1 | **The reader is the product.** If a change slows the reader, it is wrong regardless of what else it improves. | shipping features that add work to the swipe path |
| P2 | **Nothing heavy while a finger is down.** Between finger-down and finger-up, only native gesture handling and pre-drawn content may run. | per-frame JS, DB reads during scroll, mounting content mid-gesture |
| P3 | **Local first, cloud as backup and transport.** The app is fully usable in airplane mode forever. | network on any critical path; blocking UI on sync |
| P4 | **Canonical anchors, not page numbers.** A mark belongs to *a word in a verse*, never to "page 254 of this font". | annotations keyed by page/edition; drawings keyed by page number |
| P5 | **Derive, don't store.** Progress, counts and reports are computed from marks. | denormalised counters that drift |
| P6 | **Content is compiled, not computed.** Anything identical for every user is generated once at build time and shipped. | runtime downloads of scripture; on-device layout derivation |
| P7 | **Every mutation is an event.** Marks are appended as ops, applied locally, then synced. | blob overwrites, "last writer wins on a whole student" |
| P8 | **One engine per concern.** One text/drawing/export engine, one DB, one sync protocol, one navigation contract. | three ways to draw a page, two ways to save a note |
| P9 | **Fail soft, never blank.** Every subsystem has a fallback (renderer → raster → legacy; sync → queue; geometry → measure). | crashes-to-blank; silent data loss |
| P10 | **If it isn't measured, it isn't done.** Budgets are acceptance criteria and CI gates. | "feels faster" as evidence |
| P11 | **The data belongs to the user.** Export everything, delete everything, no content in analytics. | dark-pattern lock-in |
| P12 | **Small surface, deep quality.** Fewer features, each flawless on a 2018 phone. | feature-count marketing |

## 3. What I keep, and what I throw away

**Keep (this is the value that already exists):**

* **The product insight**: word-level mistake marking + per-student records + resume. That is the app.
* **The feature list** — every one of the 25 features in `CompleteRedesign.md` §1, plus what I add in
  Part III.
* **The hard-won domain details** in the current code: the page-layout parity rules (text inset 6.7%,
  frame insets, sparse ×1.3, per-font size adjustments, the `+28/+14` verse-boundary allowance,
  pitchScale/fontScale fit — `CompleteRedesign.md` §5.3), the PUA verse-marker handling, waqf-mark
  nbsp locking, the ta'awwud/bismillah rules, the centre-band tap rule, the split-mode origin maths,
  the 10-page audio-note registry idea, the drawing compaction rules. **That knowledge is the most
  expensive thing in the repository and it must be ported deliberately, one rule at a time, with
  tests.**
* The four bundled fonts, the IndoPak 15-line page data, the juz/surah maps.

**Throw away (the architectural mistakes, not the work):**

| Thrown away | Replaced by |
|---|---|
| Per-word `Pressable` + `Text` view tree | one Skia paragraph per page (§5) |
| Paging `FlatList` with `windowSize`, `snapToInterval`, offset self-validation | UI-thread pager + 3-slot ring (§5.4) |
| Runtime downloads of mushaf pages and verse text | build-time content pack (§6) |
| Per-device layout measurement stored in `page_layout_cache` | shipped geometry + deterministic fit, cache only as acceleration (§6.4 |
| `student_data_cache` JSON blobs + `sync_queue` + version counters | normalised record tables + oplog sync (§7, §8) |
| Whole-student document pushes to Firestore | per-op Cloud Function with idempotency (§8) |
| `react-native-sqlite-storage` over the bridge | JSI SQLite with prepared statements (§7.1) |
| Redux for hot reader state | reader store outside React + granular subscriptions (§9) |
| Multiple drawing/export paths (`react-native-svg`, `view-shot`, native canvas) | one Skia canvas for draw + export (§5.6) |
| 143 APK files committed to the git repo | release artefacts in object storage / GitHub Releases (§26.4) |
| `as any` navigation params | typed route contracts (§9.4) |

---

# PART II — THE TECHNICAL FOUNDATION

## 4. Platform and runtime

### 4.1 The decision

**React Native, current line, New Architecture (Fabric + TurboModules + JSI), Hermes, TypeScript
strict, built and shipped with Expo + EAS, rendering with Skia.**

### 4.2 Decision log (ADR)

| Decision | Chosen | Rejected because |
|---|---|---|
| Cross-platform framework | **React Native** (New Arch) | *Kotlin/Compose*: better raw perf, Android-only, throws away the team's velocity and every existing JS asset (tutorial, theming, screens, sync logic). *Flutter*: excellent rendering but a full rewrite of everything, plus a second ecosystem to learn; it does not win the mushaf problem either (still needs custom text layout). *Web/PWA*: cannot do this level of text control or offline media on iOS. |
| Build tooling | **Expo + EAS** (dev client, not Expo Go) | Bare RN + `gradlew`: what you have today — manual JDK/keystore/gradle dance, no OTA updates, no device farm, APKs in git. EAS gives: cloud builds, **OTA JS updates** (critical: you can ship a perf fix without a Play review), submit automation, and a dev-client that still allows any native module (Skia, Track Player, Firebase). |
| Rendering engine | **React Native Skia** (one canvas per page) | *Per-word `Text` views*: what you have — ~350 views/page, the root cause of the slowness. *Custom Kotlin `StaticLayout` view*: fastest possible and a great escape hatch, but Android-only, needs a Kotlin maintainer, and duplicates the layout rules twice. *Raster images only*: kills word-level marks. |
| State | **Zustand slices** for app state + a **plain-TS reader store** with `useSyncExternalStore` for hot state | *Redux Toolkit*: fine, but selector granularity and boilerplate cost more than they give here. *Context*: re-renders everything. |
| Database | **SQLite via JSI** (`expo-sqlite` new API, prepared statements) | bridge-based `react-native-sqlite-storage` (round-trips per call), WatermelonDB (opinionated, sync model we don't want), Realm (vendor risk). |
| Backend | **Firebase** Auth + Firestore + Storage + **Cloud Functions for all writes** | *Supabase/Postgres*: cleaner relational model and cheaper at scale, but you already have Firebase accounts, rules, and users. Design the client to never write Firestore documents directly, so a future migration is a transport swap, not a redesign. |
| Media | **react-native-track-player** (ExoPlayer/AVPlayer, media session) | `react-native-audio-recorder-player` as a player (today's setup): JS timers for position, no background/lock-screen control, fragile resume. |
| Images | **expo-image** (disk/memory cache, fast decode) | RN `Image` |
| Validation | **Zod** at every boundary (content, DB rows, sync ops, route params) | runtime hope |
| Navigation | **React Navigation native-stack** with a typed `RootStackParamList` | `as any` params |
| i18n | **i18next** + RTL-aware layout from the root | per-screen ad-hoc strings |
| Testing | Jest + Testing Library, **golden-image tests for rendering**, Vitest for build-time tools, Maestro for e2e, a sync simulator | manual testing only |
| Feature flags & tiers | **Firebase Remote Config** (renderer mode, tier overrides, kill switches) | shipping blind |

### 4.3 Version verification step (do not skip)

Before writing code, confirm the current versions of: React Native, Expo SDK, `@shopify/react-native-skia`,
`react-native-reanimated`, `react-native-gesture-handler`, `expo-sqlite`, `react-native-track-player`,
`@react-native-firebase/*`, and that all of them support the same RN/New-Arch line. Lock them in
`package.json` with exact versions. A rebuild is the one moment where you can afford to be on a
current, coherent stack — and the one moment where an incompatible native module costs you a week.

## 5. The rendering engine (the heart of the rebuild)

### 5.1 What it must do

Draw one mushaf page — 15 lines, ~137 words, decorations, frame, verse badges, highlights, flash —
**as fast as a photograph**, and tell the app the exact rectangle of every word so taps and marks are
pixel-accurate, in any of 4 fonts, 2 scripts, 3 themes, night mode, 2 orientations, 2 split modes and
any font size.

### 5.2 How Skia does it

| Need | Skia mechanism |
|---|---|
| Lay out and draw a whole page | **one `Paragraph` per page** (with `TextStyle` carrying the bundled TTF, RTL, justification) drawn into a `Canvas` — a single draw call |
| Exact word rectangles | `Paragraph.getRectsForRange(start, end, RectHeightStyle.Tight)` — give it the character range of a word and it returns the boxes. **These are the authoritative word rects**; no `onLayout`, no measuring widgets. |
| Tap → word | `Paragraph.getGlyphPositionAtCoordinate(x, y)` → character index → binary search the page's cumulative character offsets → word |
| Mistake underline | `getRectsForRange(wordStart, wordEnd)` → draw a rounded rect under it (colour by tajweed category) |
| Tapping a word's *centre band* only | shrink the rect horizontally by `(1 − WORD_TAP_FRACTION)/2` before testing — same rule as today, now computed instead of measured |
| Verse badges | draw them (rounded rect + number) at the boundary rect returned by the paragraph — or as inline spans; drawing is simpler and gives full control |
| Frame and decorations | `Path`/`Rect`/`RoundedRect` painting, with the exact geometry constants of the parity table |
| Font size, spread, orientation change | rebuild the paragraph (a few ms) — or use cached paragraphs keyed by `(page, width, fontScale, edition)` |
| Fast path for weak devices | `Canvas.makeImageSnapshot()` → encode → disk. Later mounts decode one image instead of laying out text (tier C) |
| Drawing canvas (pen/eraser/underline) | the **same** Skia canvas: strokes as `Path`s, hardware-accelerated, no `react-native-svg` |
| Export an image for sharing | the same snapshot → `encodeToBytes()` — no `view-shot`, no tree capture, higher fidelity |
| Word-by-word translation (future) | `getRectsForRange` again: draw the translation under each word |

**Why this is the right answer:** it collapses six subsystems (text layout, word hit-testing,
highlights, the decorative frame, the drawing canvas, image export) into **one engine**, and it turns
~350 native views into **one**. Page paint becomes "lay out 15 lines, draw, done" — measured in
milliseconds, not hundreds of milliseconds.

### 5.3 The spike that decides everything (2 days, before any other work)

I would not commit to Skia for Qur'anic Arabic on faith. The spike:

1. Take one page of the IndoPak pack (e.g. page 254, the densest: 176 words) and one Uthmani page.
2. Render it with Skia on the **worst** phone I own, at the real device size, with the real TTF.
3. Measure: ms to build the paragraph, ms to draw, ms to get word rects, and total frame time.
4. **Check the text visually against today's render**, line by line, at 2× zoom:
   * diacritics/Tashkeel placement, especially stacked marks and the small high marks,
   * letter joining and shaping (initial/medial/final forms) — this is where a shaping engine differs,
   * waqf marks and the `\u06D6-\u06ED` range,
   * PUA verse-end glyphs (we strip them today; confirm the same visual),
   * line width parity within ±1 px against the current renderer's boxes.
5. Also verify RTL justification: does Skia's `spaceBetween`/`spaceAround` behave like the current
   `space-between`/`space-around` flex rows? If not, position words manually from advances (always
   available) — the fallback is trivial because we already know every advance.

**Decision rule:** if shaping is visually correct and a page draws in ≤ 25 ms on a low-end phone, Skia
is the engine. If shaping is wrong, fall back to the **native Kotlin `StaticLayout` view** for Android
(the same interface, §5.5) and keep Skia for drawing/export; iOS gets the JS fallback for one release.
If both fail, the worst case is today's renderer behind the same interface — which is why the interface
matters more than the implementation.

### 5.4 Paging: the UI-thread pager

* **One horizontal pager built on Reanimated worklets + Gesture Handler** (or `react-native-pager-view`
  if a native pager proves smoother). The offset lives in a worklet/native value; **the JS thread never
  sees a scroll event**.
* **3 permanent slots** (5 in spread mode). A page is built in a slot during **idle time**, never while
  a gesture is active. A settle shifts the ring by one and re-targets the far slot.
* **Prefetch scheduler** with priorities: visible page → incoming slot → outgoing slot → ±3..±6 in the
  direction of travel → bitmap pre-render for weak devices → sync/downloads. Paused during gestures and
  during audio-critical work; coalesced by key; max 2 concurrent DB jobs.
* **Landings** (resume, go-to-page, deep link, index jump) reset the ring around the target and paint it
  before the move animates. This is today's *go-to-page* behaviour — in the rebuild it is the **only**
  path a page can appear by.
* **No offset reconstruction, ever.** The page index is the state; the transform is derived from it.

### 5.5 The renderer interface (frozen)

```ts
// packages/mushaf/src/types.ts — one interface, three possible implementations
export interface MushafPageHandle {
  setSpec(spec: PageSpec, layout: LayoutKey): void;      // build/replace the page layout
  setHighlights(ids: string[]): void;                    // cheap: redraw only the mark layer
  setFlash(ids: string[]): void;
  hitTest(x: number, y: number): WordHit | null;         // authoritative, from the layout engine
  measurePage(): { width: number; height: number; lines: number };
  exportImage(scale: number): Promise<string>;           // PNG path for share
}
export interface WordHit { wordId: string; surahId: number; verseNumber: number; wordIndex: number;
                           rect: Rect; centreBand: boolean }   // centreBand=false → dead tap
```
Implementations: `skia` (primary), `native` (Kotlin `StaticLayout`, Android escape hatch), `raster`
(disk-cached bitmaps + rect overlay for tier C), `legacy` (the current JS renderer, for parity testing
and iOS until parity). The app never knows which is in use — Remote Config decides per tier, and a
setting can override it (useful for support and for users who insist).

### 5.6 One engine for everything visual

Because the page, the drawing canvas, the highlights and the export all share Skia:

* strokes are `Path`s (the current compaction/thinning rules port directly, now hardware-drawn);
* the "static overlay" that redraws saved strokes during capture disappears — the strokes are simply
  the same layers as on screen;
* share capture is `makeImageSnapshot()` at 2–3× scale: crisper than `view-shot` and independent of
  layout timing;
* the tutorial's spotlight can be drawn in the same canvas instead of a separate overlay tree.

## 6. The content pipeline (build everything once)

### 6.1 What is generated at build time

```
content-pack/
  manifest.json         { packVersion, geometryVersion, rendererMin, builtAt, files[{path,bytes,sha256}] }
  content.db            SQLite, read-only, shipped in the app bundle
  audio.manifest.json   per-qari URL + bytes + sha256 + duration   (audio itself streams/downloads)
  search.db             FTS5 index over translation + normalised Arabic   (or a table inside content.db)
  bitmaps/              optional: pre-rendered page images for tier C, per (edition, size bucket, theme)
```

### 6.2 Tables in `content.db`

```sql
editions(id TEXT PRIMARY KEY, script TEXT, fontFamily TEXT, linesPerPage INT, pageCount INT,
         name TEXT, description TEXT, isDefault INT);
pages(editionId TEXT, pageNumber INT, sparse INT, lineCount INT, wordCount INT, spec BLOB,
      PRIMARY KEY (editionId, pageNumber));
page_words(editionId TEXT, pageNumber INT, lineIdx INT, wordIdx INT, text TEXT, kind TEXT,
           surahId INT, verseNumber INT, wordIndex INT, advance REAL,      -- em units, exact
           PRIMARY KEY (editionId, pageNumber, lineIdx, wordIdx));
page_boundaries(editionId TEXT, pageNumber INT, lineIdx INT, boundaryPx REAL,
                PRIMARY KEY (editionId, pageNumber, lineIdx));             -- the +28 per verse end
verses(surahId INT, verseNumber INT, uthmani TEXT, indopak TEXT, translation TEXT,
       transliteration TEXT, pageUthmani INT, pageIndopak INT,
       PRIMARY KEY (surahId, verseNumber));
surahs(id INT PRIMARY KEY, name TEXT, englishName TEXT, revelationPlace TEXT, verseCount INT,
       startPageIndopak INT, startPageUthmani INT);
juz(juz INT PRIMARY KEY, startSurah INT, startVerse INT, startPageIndopak INT, startPageUthmani INT);
word_translations(surahId INT, verseNumber INT, wordIndex INT, gloss TEXT);   -- future, per-word meaning
```
Notes: `spec BLOB` is a compact binary page record (varints + UTF-8 strings), not JSON — nothing in the
app should `JSON.parse` a page. `advance` in **em units** is device-independent, which is what makes
shipped geometry possible at all. `page_words` is denormalised for search, hit-test fallback and
future word-by-word features.

### 6.3 The generator

A Node/TypeScript CLI (`tools/content`) with these stages, each testable independently:

```
1. fetch/normalise sources      IndoPak 15-line pages + Uthmani page data + verse texts (checked in as
                                a vendored snapshot, so builds are reproducible offline)
2. build editions               one edition per (script, layout, font) — currently uthmani-hafs and
                                indopak-15-lines; the 4 fonts are *styles* of the IndoPak edition
3. build page specs             lines, words, locations, PUA stripped, waqf marks nbsp-locked,
                                bismillah/surah-header lines typed — the exact rules from the current
                                MushafPageView, ported rule-by-rule into a pure module with tests
4. measure geometry             per word: advance in em via a font-metrics library or the Kotlin/JVM
                                `TextPaint` (preferred: identical metrics to the renderer)
5. build boundary allowances    +28 per verse end inside a line (the +14 note term stays runtime)
6. build indices                surahs, juz, verse→page for both editions, sparse flags, word counts
7. build search index           FTS5, Arabic normalised (diacritics stripped, alef/hamza unified,
                                tatweel removed) + translation
8. verify                       schema validation, 611/604 page counts, every verse reachable,
                                every page's word count matches, checksums
9. package                      content.db + manifest + sha256 → release artefact (+ optional bitmaps)
```

**Verified facts this pipeline must reproduce** (measured from the current shipped asset):
IndoPak edition = **611 pages, 15 lines/page, average 136.9 words/page, max 176 (page 254)**,
total 9,133 line entries. The verifier fails the build if these change without a deliberate bump.

### 6.4 Geometry: shipped, not measured — but verified on device

Because advances are in em and the font file is the same everywhere, the geometry is identical on all
devices. Two safety nets:

1. **Deterministic fit.** The fit maths (lineWidth from `textInsetFor`, `(lineW − 12)/total`,
   pitchScale, fontScale) runs from exact advances at render time, so nothing needs measuring.
2. **Self-check + optional persist.** On first render of a page, the renderer can compare its computed
   line widths against the packed geometry; if the delta exceeds a threshold (e.g. 1.5 px — a font
   update, a platform shaping change), it recomputes from the live paragraph and stores a *local
   correction* row. The pack stays canonical; devices self-heal. `geometryVersion` in the manifest
   invalidates corrections.

### 6.5 Content updates without a Play release

The pack is versioned and hosted. On launch (background, never blocking): compare `packVersion` with
your CDN manifest; if newer and policy allows, download the delta, verify sha256, stage it, and swap
atomically on the next cold start. A content update can fix a page, add an edition, add a translation,
or add a search index — without waiting for review. Bitmap packs are optional downloads, sized and
gated by preference ("download offline images, 180 MB").

## 7. The data layer

### 7.1 Driver and shape

* **SQLite via JSI** (`expo-sqlite` new API): prepared statements, synchronous variants for tiny reads,
  reads on a background thread by default, no bridge serialisation.
* **Two databases, always separate:**
  * `content.db` — shipped, read-only, replaced wholesale on update.
  * `user.db` — everything the user created; never touched by content updates; the thing we back up.
* **One write path.** All mutations go through a repository module that (a) writes the row,
  (b) appends an op to the oplog, (c) notifies the reader store. Nothing else writes SQL. This is what
  makes sync, undo and "export everything" trivial instead of archaeology.

### 7.2 Canonical references (the single most important data decision)

Annotations anchor to **the word, in the verse** — `(surahId, verseNumber, wordIndex)` — plus optional
ranges, plus a *hint* of where it was seen (`editionId`, `pageNumber`) for fast lookup. Drawings anchor
to a **verse range** or to a page in a specific edition (with an explicit note that page-anchored
drawings are edition-specific).

Why this matters more than it looks:

* Switch IndoPak → Uthmani: every mistake, note and bookmark **stays where it belongs** (today,
  highlights survive because they are verse-keyed, but drawings are page-keyed and don't).
* Change the font size, split mode, orientation, or the layout in a future update: annotations are
  untouched.
* Two devices on two different editions (one IndoPak, one Uthmani) still see the same marks.
* Reports and revision queues become natural: "unresolved mistakes in Juz 2" is a query, not a merge of
  blobs.
* Word-level marks survive a future re-pagination of the mushaf, which is otherwise a catastrophic
  migration.

Full `user.db` schema: Appendix A. Firestore + Functions contract: Appendix B.

### 7.3 Repository API (the only door to data)

```ts
// examples — every screen talks to this, never to SQL
annotationRepo.add(studentId, { kind:'mistake', category:'madd', target:{surahId:2, verseNumber:255, wordIndex:3} })
annotationRepo.byPage(studentId, editionId, pageNumber)      // one indexed query, cached per page
annotationRepo.byVerse(studentId, surahId, verseNumber)
annotationRepo.unresolved(studentId, { juz?, surah?, category? })
annotationRepo.resolve(id) / reopen(id) / remove(id) / update(id, patch)
annotationRepo.exportStudent(studentId): Backup        // full JSON/ZIP, user-owned
annotationRepo.importBackup(file, { merge:'keep-both'|'replace' })
```

Every repo method returns domain objects validated by Zod (catches schema drift the moment a migration
is wrong, instead of three screens later).

## 8. The sync engine

### 8.1 Model: an append-only operation log

```ts
type Op = {
  opId: string;                       // uuid v7 — sortable, idempotency key
  entity: 'annotation'|'drawing'|'student'|'readingPosition'|'setting';
  entityId: string;
  op: 'upsert'|'delete';
  payload: unknown;                   // Zod-validated per entity
  updatedAt: number;                  // device clock, server-clamped
  deviceId: string;                   // which device authored this
  baseVersion?: number;               // optional: optimistic concurrency for notes
};
```

* **Apply locally first** (the UI is never waiting on a network).
* Append to `oplog`; a background worker batches (≤ 200 KB or ≤ 200 ops) and calls a **Cloud Function**
  `applyOps({ studentId, batchId, ops })`.
* The Function validates ownership, clamps `updatedAt` to server time (anti clock-skew), writes
  per-record documents, and returns the accepted watermark + any records the client is behind on.
* **Pull** per collection with a cursor: `updatedAt > cursor`, ordered, paged. Apply with
  `(updatedAt, deviceId)` last-write-wins per *entity*; deletions are tombstones with a 90-day GC.
* **Notes** (the only content where losing text is painful) keep both versions in a `conflicts` table
  and show a small "keep mine / keep theirs" affordance. Everything else merges silently and
  deterministically.
* **Media** (voice notes, exported images) upload to Storage; only metadata syncs.
* **Guarantees:** idempotent (safe to retry forever), resumable, order-independent, testable. A
  two-device simulator runs adversarial interleavings in CI: simultaneous edits to one word, delete vs
  edit, 200 ops offline, clock skew ±1 day, one device reinstalled.
* **Visible state:** "All changes saved" / "3 pending, will sync" / "Last synced 12m ago" / "Offline —
  will sync later". The teacher must never wonder whether their marks are safe.

### 8.2 Why not Firestore-direct writes (today's approach)

Because today's shape (whole-document `set(merge:true)`) gives you no per-record conflict resolution, no
idempotency, 1 MB ceilings, and a client that can write arbitrary documents. Routing all writes through
a Function costs a little money and latency and buys validation, size caps, tamper resistance,
server-clamped timestamps, analytics on usage, and a **future-proof seam**: swapping Firestore for
Postgres later becomes a Function change, not an app rewrite.

### 8.3 Multi-device, offline, and the "one teacher, two phones" reality

Teachers commonly have a classroom tablet and a personal phone. Requirements: no login ceremony each
time, no "which device has the truth", no lag when offline. The oplog model satisfies all three; the
reading position is the only entity where "latest wins" is the wrong rule (a device that hasn't been
opened in a week must not yank the teacher back), so `readingPosition` carries `deviceId` and
`updatedAt` and the UI asks nothing — it keeps the *local* position and shows the other device's
position as a secondary "other device: page 312" hint.

## 9. Application architecture

### 9.1 Layers (hexagonal, features as vertical slices)

```
app/            screens, navigation, theming — presentation only
features/       vertical slices: reader, students, annotations, review, audio, reports, settings
                 (each slice: ui/ · state/ · domain/ · data access via repos)
core/           pure domain: entities, value objects, rules, the parity constants, word maths
infra/          adapters: sqlite, firebase, media, renderer, telemetry, flags
packages/       mushaf (renderer), content (pack reader), sync (protocol), design (tokens)
tools/          content generator, visual diff, benchmarks, migration tools
```

Rules that keep it healthy (and are lint-enforced):

* `core/` imports nothing platform-specific — pure TS, 100% unit tested.
* Screens never import SQL, Firebase, or the renderer's internals.
* One module per concern: `packages/mushaf` is the only place that touches Skia; `packages/sync` is the
  only place that touches the Functions API.
* No `any` in `core/` or `packages/`; `as any` is banned at the navigation boundary by a typed param list.

### 9.2 State: three tiers by update frequency

| Tier | Where | Contents |
|---|---|---|
| **Hot** (per interaction) | plain-TS store outside React + `useSyncExternalStore`, per-page subscriptions | current page, slot state, paragraph/handle, selection, drawing session, gesture state |
| **Warm** (per user action) | Zustand slices | students, active student, annotations index (per page cache), audio, sync status, settings |
| **Cold** (rare) | persisted store (SQLite or MMKV) | session, preferences, flags, caches metadata |

**The rule that fixes today's jank:** a page's data and annotations are keyed by page, so updating one
page **cannot** change the identity of another page's data. No full-tree re-renders during a swipe —
structurally impossible, not merely optimised.

### 9.3 Threading contract

| Thread | Owns | Forbidden |
|---|---|---|
| UI | gesture, Skia draws, native overlay | JS/SQL/file work |
| JS | state, commands, sync orchestration, paragraph building | `JSON.parse` of content-sized data, per-frame work |
| DB pool | all SQL | UI |
| Background native | audio, encode/decode, downloads, snapshot writes | |
| Worklet | pager transform, springs | allocation, dispatch, DB |

Enforced by a dev-mode guard that logs any JS task > 8 ms that starts during a gesture, plus a bundle
lint rule banning large `JSON.parse` outside `packages/content`.

### 9.4 Navigation contracts

```ts
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined; Register: undefined;
  Dashboard: undefined;
  Student: { studentId: string };
  Reader: { studentId: string;
            target: { kind:'page'; editionId: string; page: number }
                  | { kind:'verse'; surahId: number; verseNumber: number }
                  | { kind:'resume' }
                  | { kind:'practice'; queueId: string };
            mode?: 'page'|'ayah'|'continuous' };
  Mistakes: { studentId: string }; Notes: { studentId: string }; Bookmarks: { studentId: string };
  Practice: { studentId: string; queueId: string };
  Reports: { studentId: string }; Settings: undefined;
};
```
Every deep link becomes a **typed intent** (`target: {kind:'verse',…}`), which is what deletes the
current app's class of "the reader opened at the wrong place" bugs defended by timers and refs.

---

# PART III — THE FEATURES

Each feature: purpose → data → UX → edge cases → which layer implements it. **Bold** marks what is new
compared with today's app.

## 12. Accounts, students, classes

**Purpose:** a teacher manages several students; a student's record is the product.

| Feature | Data | Notes |
|---|---|---|
| Account (username + password → email), register, login, logout, password reset | Firebase Auth | keep the username→email mapping for existing users; new accounts get an optional real email + reset |
| Students CRUD, avatar, archive (soft delete) | `students` table + Firestore | archive instead of delete; delete is explicit and exportable first |
| **Groups / halaqah** | `groups`, `group_members` | group students ("Hifz class A"); bulk reports and bulk assignments; a student may be in several |
| **Student profile: level, target (hifz/nazirah), language, notes** | `students.meta` | drives sensible defaults (which edition, which qari, report language) |
| **Per-student defaults** | `students.prefs` | edition, font, qari, reminder of last page |
| Offline student list | cached in `user.db` | always opens instantly |

**Edge cases:** same name twice; a student taught by two teachers (v1: one owner, later: sharing); a
student moved between groups; device restored from backup with a different account.

## 13. Reading

**Purpose:** the mushaf must feel like paper.

| Feature | Implementation |
|---|---|
| Editions: IndoPak 15-line (default) and Uthmani 604-page | content pack; `editions` table; each has its own page count and geometry |
| 4 fonts (styles) | font files bundled; the paragraph rebuilds on change (a few ms); user choice persisted |
| Reading modes: page / ayah / continuous | pager for page; idle-prefetched virtualised lists for the other two, same annotation layer |
| Spread (two pages side by side) on tablets and landscape | slot = two renderers; exact gutter/scale parity |
| Font size, text brightness, background dim, night mode, 3 themes | design tokens; renderer reads a `MushafTheme` object; all persisted |
| Decorations: frame, juz pill, surah pill, page pill, pages-left-in-juz pill, bismillah, surah headers, ta'awwud, sparse enlargement | drawn from the parity constants; one source of truth shared by every renderer implementation |
| Jump anywhere: page number, surah, juz, verse, bookmark, note, mistake | Surah/Juz/Page index screens + FTS search + one `target` intent |
| **Search**: verse text, translation, and normalised Arabic | FTS5 in the content pack; results deep-link to the exact verse |
| **Word-by-word meaning** (horizon) | `word_translations` table + word rects already available |
| Resume: land exactly where the student stopped | `reading_positions` per student per device, plus a "last page" hint on the hub |
| Header auto-hide, edge taps, haptics, "hide drawing tool" | unchanged behaviour, retargeted to the worklet/native layer |

**Edge cases:** 604 vs 611 page counts (never assume); a page that begins mid-verse; pages with two
surahs; At-Tawba (no bismillah); Fatiha (bismillah *is* verse 1); a verse spanning two pages; rotation
mid-swipe; split mode on a phone-sized window; an edition removed in a content update.

## 14. Annotations (the teaching core)

| Annotation | Anchor | Payload | Notes |
|---|---|---|---|
| **Mistake mark** | word (`surahId, verse, wordIndex`), optional word range | **`category`** (tajweed taxonomy), optional severity, note | today's highlight, now categorised — turns a red mark into teachable data |
| **Mistake resolution** | same record | `resolvedAt`, `resolvedBy`, attempts | mark as fixed after the student recites it correctly; powers progress and the revision queue |
| Text note | verse (optional word range) | text | free typing, autosave |
| Bookmark | verse or page | label | quick navigation |
| Reading mark | verse | timestamp | the "we stopped here" ribbon + date |
| Drawing | page (edition-scoped) or verse range | strokes (binary) | pen / eraser / underline; the compaction + thinning + normalisation rules port from today |
| Voice note | verse | audio file + duration | record/play/delete; metadata syncs, file goes to Storage |

**The tajweed taxonomy** (the biggest product upgrade in this rebuild) — a fixed, extensible list,
each with a colour and an optional help text:

```
Makhraj (articulation point) · Sifah (attribute) · Ghunnah · Qalqalah · Madd (short/long/necessary)
Idgham · Ikhfa · Iqlab · Izhar · Hamzat ul Wasl · Waqf (stopping) · Harakat (vowel errors)
Letter confusion · Word omission · Word addition · Hesitation · Fluency · Other
```
Long-press a marked word → change category / add a note / mark resolved. A per-category colour ramp
(colour-blind-safe palette, with a "high contrast" toggle). A category legend screen. **This is what
makes the app worth paying for**, because it turns "the student made 40 mistakes last month" into
"28 of them are madd — practise these 9 verses".

**Interaction spec (locked to today's feel, now exact):**
* Tap a word → mark/unmark a mistake (centre band only; edges toggle the header — unchanged).
* Long-press a word or tap a verse badge → verse action sheet (bookmark, note, record, copy, reading
  mark, play, **set mistake category**, **mark resolved**), anchored to the finger via the word rect.
* Marks appear **in the same frame** as the tap (optimistic, native redraw of the highlight layer only —
  no React render, no page rebuild).
* Every mark is written to `user.db` + the oplog within ~50 ms; the "pending" indicator updates; sync
  happens whenever it can.

## 15. Review, progress and reports (mostly new, all built on marks)

| Feature | What it is | Data |
|---|---|---|
| **Revision queue (Practice)** | auto-generated set of verses with unresolved mistakes, ordered by **spaced repetition** (SM-2-style: ease, interval, last result per verse) | derived from annotations + a `practice_log` table |
| **Practice session UI** | big, calm reader: jump to verse, hide everything else, one button per outcome ("solid / shaky / again"), next verse | `practice_log` |
| **Progress dashboard** | per student: unresolved vs resolved over time, mistakes by category, verses touched, pages covered, practice streak | derived queries (no counters stored) |
| **Lesson plan / assignment** | "Next lesson: Baqarah 1–20, focus on madd" — a saved list of verse ranges + categories, printed or shared; future: pushed to a student device | `assignments` |
| **Session recording** | while the student recites, marks are timestamped; later, replay the session as a timeline of mistakes, optionally with the audio recording | `sessions`, `session_marks` |
| **Reports / export** | PDF (one page per student per period), CSV for spreadsheets, shareable link; includes a page image with the marks | Skia image export + a small PDF generator |
| **Weekly summary** (horizon) | a WhatsApp-friendly summary image for parents | derived + Skia |

**Why this is where the redesign pays for itself:** every one of these is a *query* over normalised
marks. In today's model the same features would require loading and merging whole JSON blobs per
student — possible, but slow and error-prone enough that nobody would build it.

## 16. Audio

| Feature | Implementation |
|---|---|
| Multiple qaris (keep the current list + add more) | manifest in the content pack: per qari, per surah: URL, bytes, sha256, duration |
| Play from a verse; continue verse by verse | the media player drives position; JS receives coarse progress events only |
| **Background playback + lock-screen controls** | media session (Track Player) — new, and expected by users |
| Loops: verse / range / whole surah / repeat N times | loop state in the player, not in JS timers |
| Basmala pre-play before verse 1 | player queue rule |
| Download per surah, delete, size budget, **resumable** | download queue manager with integrity checks and an index table (no filesystem scans) |
| **Playback speed** (0.75×–1.5×) | player |
| Page turns follow the playing verse (optional) | the reader subscribes to verse changes; the ring pre-warms the next page |
| Voice-note playback and recording | same player / a recorder module; files in app storage + Storage backup |

**Edge cases:** a download interrupted by an app kill; Arabic filenames on Android; two qaris' files
for the same surah; audio playing while the teacher records a voice note (pause the surah first);
"verse not available for this qari" fallback to the next source.

## 17. Sharing and export

| Feature | Implementation |
|---|---|
| Share a page as an image | Skia `makeImageSnapshot` at 2–3× — includes frame, marks (with categories), bookmarks, drawings per the toggles |
| Share a verse (text + translation + reference) | clipboard + share sheet |
| **Share a student's mistakes as a clean list/image** | new; the most teacher-friendly output there is |
| **PDF report per student / period** | new |
| **CSV export** | new; for schools that keep spreadsheets |
| **Full backup export/import** | new; JSON/ZIP of everything the user owns — the safety net for a data-loss bug and a trust feature |

## 18. Onboarding and tutorial

* **First 60 seconds:** pick how you teach (defaults: IndoPak, last page, one student), create the first
  student, land in the reader on page 1 with a "tap a word to mark a mistake" hint.
* The existing interactive tutorial (chapters: Setup → Read & Navigate → Annotate → Review & Sync) is
  kept but **data-driven** from a step table, so steps can be added/edited without touching code, and
  the anchor mechanism is one primitive (a ref measurement → spotlight rect) instead of a subsystem.
* **A 90-second in-reader coach marks** the three gestures that matter (tap to mark, long-press for the
  menu, swipe to turn) and can be replayed from Settings.

## 19. Settings

Grouped, searchable, all persisted, all with sane defaults:

`Reading` (edition, font, size, brightness, night mode, theme, spread, header behaviour, page-turn mode)
· `Marks` (category colours, high-contrast palette, default category, auto-resolve prompts)
· `Audio` (qari, quality, download-all, size budget, speed, background playback)
· `Sync` (status, pending changes, manual sync, last synced, per-device info, conflict log)
· `Data` (storage used, clear caches, export backup, import backup, delete student data, delete account)
· `Performance` (**renderer mode: auto / text / raster**, animations, images quality) — the escape hatch
that turns "my phone is old" into a setting instead of a support ticket
· `About` (versions: app, content pack, geometry, renderer; licences; credits), tutorial replay, haptics.

## 20. Monetization

| Tier | Contents |
|---|---|
| **Free** | full reader, all marks, sync, audio streaming, exports with a small footer stamp |
| **Premium** (one-off or annual) | no ads, offline audio packs, unlimited backup media (voice notes/drawings), PDF reports, priority content updates, **and the teaching features that cost us money to run** |
| **School** (later) | multi-teacher sharing of students, admin, bulk export |

Ads stay as a collapsible banner, loaded **after first paint**, never in the reader's first frame, never
between a tap and its mark. The ethical line: a teacher mid-lesson is never interrupted, and a student's
data is never the product.

---

# PART IV — BUILDING IT

## 22. Repository layout

```
teach-quran/
  apps/
    reader-app/                 # the Expo app (thin: screens + wiring)
  packages/
    mushaf/                     # renderer (skia/native/raster/legacy) + parity constants + word maths
    content/                    # pack reader: editions, pages, verses, search
    sync/                       # oplog protocol, transports, conflict rules, simulators
    core/                       # pure domain: entities, annotation rules, practice scheduling, reports
    design/                     # tokens, typography, RTL, accessible palettes
    ui/                         # shared components (buttons, sheets, lists)
  tools/
    content-generator/          # builds content.db + bitmaps (stage 1–9 of §6.3)
    visual-diff/                # golden-image harness (§23)
    bench/                      # headless render benchmark + perf report
    migration/                  # one-shot importers (from the current app's blobs)
  infra/
    functions/                  # Cloud Functions: applyOps, mediaPolicy, packManifest, tombstones GC
    firestore.rules  storage.rules  +  tests/
  .github/workflows/            # ci, golden, bench, e2e, release
```
Artefacts (APK/AAB, content packs, golden images) live in **object storage / GitHub Releases**, never in
git. (Your current repo carries 143 APKs and a `temp_changes/` duplicate tree; that history is
unrecoverable bloat and a fresh repo is one of the quiet wins of a rebuild.)

## 23. Testing strategy

| Level | What | Gate |
|---|---|---|
| Unit (fast, every commit) | parity constants, word maths, annotation rules, practice scheduler, oplog merge, migrations, Zod schemas | required |
| **Golden-image render** | ~60 representative pages × (4 fonts × 3 themes × night × header on/off × 3 sizes × orientations), rendered by every enabled engine implementation and diffed against frozen references; geometry must match **exactly**, raster within 1 px | required |
| Property/fuzz | geometry generator: every page's words sum to its declared word count; every verse reachable in both editions; no page with 0 or >200 words | required |
| Sync simulation | two/three virtual devices, adversarial interleavings, clock skew, offline replay, reinstall | required |
| E2E (Maestro) | the core loop on a real device: create student → resume → mark 10 words → kill app → reopen → marks present → sync → second device sees them | nightly |
| Manual device matrix | tier A (modern), tier B (4-year-old mid), tier C (old/low-end), plus a tablet and a small phone | each release |
| Soak | swipe 600 pages, annotate 200 marks, play audio 30 min, background/foreground 20×; assert memory ceiling and zero crashes | each release |

## 24. Observability and budgets

**Budgets (acceptance criteria, per tier — "AAA" made numeric):**

| Metric | A | B | C |
|---|---|---|---|
| Cold start → interactive, offline | < 900 ms | < 1.2 s | < 1.6 s |
| Student hub → first page readable | < 150 ms | < 250 ms | < 350 ms |
| Page turn (finger-up → painted) | < 40 ms | < 70 ms | < 110 ms |
| Word tap → mark visible | < 20 ms | < 30 ms | < 30 ms |
| Worst frame in a 100-page fling | < 60 ms | < 100 ms | < 150 ms |
| Memory (reader, steady) | < 220 MB | < 200 MB | < 160 MB |
| Sync 500 ops (wifi) | < 4 s | | |
| Crash-free sessions | ≥ 99.5% | | |

**Instrumentation from day one:** Perfetto/Systrace markers around page paint, paragraph build, DB
read, bitmap decode, ring shift, mark apply; a dev HUD showing them per gesture; Sentry for crashes
with a release-health dashboard; Remote Config flags to disable a renderer remotely if a device class
misbehaves. CI posts the benchmark delta on every PR; a regression beyond 10% fails the build.

## 25. Security, privacy and child data

* **Student data is a child's data.** Names, avatars, voice recordings, mistakes. Treat it as sensitive:
  encryption at rest for media, no third-party analytics that receives content, no ad SDK receiving
  anything but an ad request, no crash report containing mushaf/annotation content.
* Firestore/Storage rules rewritten around the ops model, with **rules unit tests in CI**; the client
  can never write an arbitrary document; server clamps timestamps and enforces payload size.
* Data ownership: export everything, delete everything (with a real deletion path in Storage too),
  account deletion that fulfils store requirements.
* Least privilege on Functions; no long-lived secrets in the app; Firebase App Check on.
* A short, plain-language privacy page inside the app and on the store listing.

## 26. CI/CD and release engineering

1. **PR gates:** typecheck · lint · unit · golden-image · bench delta · rules tests · bundle-size delta.
2. **EAS profiles:** `dev` (dev client), `preview` (internal track, tier override available), `prod`.
3. **Release flow:** tag → EAS build → Play internal track → staged rollout 5% → 20% → 100%, gated on
   crash-free rate and the perf budget dashboards.
4. **OTA updates:** JS-only fixes (most perf and UX work) ship via EAS Update to a subset of users
   first. This is the single biggest process upgrade over today's gradle-APK-in-git workflow: a page
   bug can be fixed in hours without a store review.
5. **Content releases are independent:** a pack update can ship mid-week without an app release.
6. **Rollback plan:** every flag has an off switch; content packs are atomic-swapped and revertible; the
   previous app version stays available; the oplog makes client rollback safe (no format lock-in).
7. **Versioning:** app `major.minor.patch` + `contentVersion` + `geometryVersion` + `rendererVersion` +
   `syncProtocolVersion`, all displayed in Settings → About so support can ask one question.

## 27. Roadmap from zero

| Phase | Deliverable | Duration (1 dev + agents) | Gate |
|---|---|---|---|
| **0. Spike** | §5.3 renderer spike; stack versions locked; repo skeleton; CI skeleton | 1–2 wk | a page draws ≤ 25 ms on a low-end phone with correct shaping, or the fallback engine is chosen |
| **1. Foundation** | content generator + `content.db` for both editions + golden harness; repository layer; navigation contracts; design tokens | 4 wk | generator reproducible; golden diff green on 60 pages; content pack < 40 MB |
| **2. Reader** | renderer implementation(s), pager ring, prefetch scheduler, resume/landing, split mode, themes, index screens | 6 wk | page turn < 70 ms on tier B; golden parity; a teacher can read and navigate all 611 pages |
| **3. Teaching core** | marks with categories, resolution, notes, bookmarks, reading mark, drawings, voice notes, annotation UX | 4 wk | the core loop is usable daily; marks survive kill/restart; no lost writes |
| **4. Sync + backup** | oplog, Functions, cursors, conflicts, export/import, multi-device sim tests | 3–4 wk | two devices converge in every simulated scenario; export/import round-trips |
| **5. Audio** | track player, loops, downloads, background, speed, verse-follow | 3 wk | audio works with the screen off for 30 min; downloads resume |
| **6. Review & reports** | practice queue with spaced repetition, progress dashboard, PDF/CSV reports | 3 wk | a teacher can plan and print a week of lessons from real marks |
| **7. Polish, tiers, launch** | raster tier C, onboarding, settings, ads, i18n, accessibility, staged rollout | 3–4 wk | budgets met on all three tiers; crash-free ≥ 99.5% |
| | **Total** | **≈ 27–31 weeks** | or **≈ 4.5–5 months with two devs** |

**Milestones that matter to a user:** end of Phase 2 the app *reads* better than today. End of Phase 3
it *teaches* better than today. End of Phase 6 it does things today's app cannot do at all.

## 28. Effort, team and cost

| Option | Shape | Timeline | Notes |
|---|---|---|---|
| Solo dev + AI agents | this document, in order | ~6–7 months | realistic only because the architecture is deliberately boring in the middle layers; the spike de-risks the hard part |
| Two devs | one on renderer+content, one on sync+features | ~4.5–5 months | the split matches the natural seams (packages/mushaf vs packages/sync) |
| Solo + contract Kotlin dev (1 month) | for the native fallback engine only | +2–3 weeks of wall clock | worth it if the Skia spike fails on shaping |
| Ongoing costs | Firebase (auth/firestore/storage/functions), EAS build minutes, CDN for packs/audio, Play fee, Sentry | low tens of £/month at first | audio bandwidth is the only real variable; offline packs reduce it |

## 29. Anti-goals (what I would not build)

1. **Not a general consumer Quran app.** Competing with free, beautiful, massive apps is a losing game.
   The teacher's record is the moat.
2. **Not a student-facing social app in v1.** Student devices are a horizon (read-only review), not a
   launch feature.
3. **Not web/iOS-at-launch.** Android first because that is where your users are; the architecture is
   cross-platform-capable, but shipping two platforms doubles the device-matrix cost.
4. **Not tafsir/translations at launch** beyond what ships cheaply in the pack. They are content
   problems, not architecture problems, and they crowd the reader.
5. **Not a "sync everything in real time" system.** Eventual consistency is correct here and far
   cheaper; the teacher is offline half the time anyway.
6. **Not custom-drawn UI everywhere.** Only the mushaf and the drawing canvas use Skia; the rest is
   ordinary React Native so it stays maintainable and accessible.
7. **Not one more "framework".** Zustand + SQLite + Zod + a Function is deliberately unglamorous. Every
   layer you cannot explain in a sentence is a future bug.
8. **Not a rewrite of the features themselves.** The teaching behaviour, the gestures and the layout
   constants are *knowledge*, and the rebuild ports them deliberately with tests.

## 30. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Skia shapes Qur'anic Arabic differently from the platform text | medium | high | the §5.3 spike before any commitment; Kotlin `StaticLayout` fallback behind the same interface; golden-image + manual 2× inspection with a teacher |
| Shipped em-geometry drifts from live rendering by a pixel | medium | low | self-check + per-device correction row; `geometryVersion` invalidation |
| Data migration from the current blob format loses marks | low | very high | migration is transactional + reversible; export-everything before migration; a migration fixture suite built from real v1 samples; keep old tables read-only for a release |
| Firebase cost creeps (ops, media, bandwidth) | medium | medium | ops are small and batched; offline packs shift bandwidth; monitor and cap; the Function seam allows a move to Postgres later |
| Scope creep back into a general Quran app | high | high | §29 anti-goals; the roadmap gates on budgets, not features |
| Solo-dev burnout across ~6 months | medium | high | every phase ships something usable; OTA updates mean small releases; the old app stays on the store as a fallback |
| Play listing/reset risk during the transition | low | high | keep the existing package name and signing key; ship the rebuild as an update of the same app, not a new app |
| Accessibility of a canvas-rendered page | medium | medium | explicit accessibility actions, labelled page description, tap targets ≥ 44 dp, manual TalkBack testing in Phase 7 |

## 31. The two-week plan (what I would actually do first)

| Days | Work | Output |
|---|---|---|
| 1–2 | Read this document; lock stack versions (§4.3); create the fresh repo skeleton + CI. | a repo that builds an empty app on EAS, with typecheck/lint/test green |
| 3–5 | **The renderer spike** (§5.3) on the worst phone you own: one IndoPak page + one Uthmani page in Skia, ms measured, pixel-compared against today's render, 2× visual inspection of shaping. | a decision: Skia, or Kotlin fallback, with numbers |
| 6–8 | Content generator stages 1–5 for **10 pages**, with the verifier + a Vitest suite porting the layout parity rules from `MushafPageView`. | a small `content.db` + proof that em geometry matches the current measured widths within a pixel |
| 9–10 | Repository + `user.db` schema + annotation repo with Zod, plus the oplog table; unit tests. | the data layer exists and is tested |
| 11–12 | The 3-slot pager with a stub renderer + the prefetch scheduler; measure settle→paint. | a page turn under 70 ms with placeholder content — the pipeline is proven |
| 13–14 | Golden-image harness (10 pages × 4 fonts × 2 themes) + bench tool. | CI that fails if a page's pixels move |

At the end of two weeks you have: a documented engine decision, a proven content pipeline, a tested data
layer, a working pager, and a CI harness that protects the parity of everything you port next. That is
the difference between "I rebuilt for six months and it still feels slow" and a build with a spine.

---

# PART V — PLAIN ENGLISH

## 32. Everything you need to know, without the jargon

**What you have now, in one honest sentence.**
You built a genuinely good app on a foundation that fights it: every page on screen is made of about
350 separate little text blocks, the app downloads and calculates everything on the user's phone, saves
each student's work as big lumpy documents, and starts building a page *while your finger is already
swiping*. That last part is why swiping feels inconsistent — it depends on what else the phone was
doing at that moment. No amount of caching fixes those four things, which is exactly why your caching
work stopped paying off.

**What I'd build instead, in one sentence.**
The same app, with the mushaf page drawn as a single picture-level object (like a photo, but it's live
text you can still tap), with all the page frameworks pre-computed on my computer instead of on the
student's phone, with the student's marks stored as proper individual records instead of one big lump,
and with pages prepared *while you're reading* rather than while you're swiping.

**Why it will be fast, in plain terms.**
Right now, showing a new page = building 350 little things and measuring every word of Arabic on the
phone. After the rebuild, showing a new page = drawing one thing whose positions were worked out
months ago on a real computer. That's the whole trick. It's the difference between assembling a
bookshelf for every page and turning a page.

**Will the page still look exactly the same?**
Yes — and this is the part I'd be strict about. Your current code contains a lot of hard-won rules about
exactly how big the text is, how it sits inside the border, when it shrinks to fit, and how much extra
room a verse ending gets. I'd move all those rules into one place, write automated tests that compare
the new page against the old page **pixel by pixel**, and refuse to ship anything that differs. You have
143 versions of the app in your repo; users' eyes are one of the few things you can't test automatically
without this.

**Will every feature still work?**
Yes. Everything you have today — the 4 fonts, both scripts, the two-page tablet view, tapping a word to
mark a mistake, notes, bookmarks, the reading ribbon, drawings, voice notes, audio with loops and
downloads, sharing, sync, the tutorial, ads, settings — is kept. I mapped all 25 of them to how they
work in the new design, and flagged the two risky ones (marking a word exactly where you tapped, and
sharing a beautiful image) as things that get automated tests of their own.

**What I'd add, because it makes the app worth paying for.**
Right now a mistake is just a red underline. I'd make it say *what kind* of mistake it was — madd,
ghunnah, qalqalah, makhraj and so on. Once a mark has a category, the app can tell you "this student's
problem is madd, practise these nine verses", build an automatic revision list, show progress over
weeks, print a proper PDF report for parents, and let you record a session and replay exactly when the
mistakes happened. That's the difference between a marking tool and a teaching tool, and none of it
works properly on today's storage shape without a rewrite of that layer.

**What changes for you and your users, practically.**
The app opens and shows the page almost immediately, even with no internet, because the Quran is now
inside the app instead of being downloaded the first time. Swiping is smooth on cheap phones because
the phone is no longer doing the hard part during the swipe. Old phones get a special mode where pages
are saved as pictures and still fully tappable, so even a slow 32-bit phone feels instant. Marks save
instantly and can never be half-synced, because each mark is a small record rather than part of a big
document. And a second phone sees the same records, resolving conflicts sensibly instead of last-file-
wins.

**What it costs.**
With one developer plus AI agents, roughly six months of part-time-equivalent work; with two
developers, about four and a half to five months. But — and this matters — you don't have to bet on six
months. The plan is split into eight phases, and each one leaves you with a better app you can put on
the Play Store: after about six weeks you have a reader that's already faster and fully offline, after
about three months you have the new marking engine in place, and the last phases are the extras
(reports, practice queue, polish). There is no "big bang" day where nothing works.

**The honest risks.**
Two. First, the new drawing engine (Skia) might shape Arabic differently from the phone's own text
engine — most likely subtly, in how stacked diacritics sit. That's why the very first thing I'd do is a
two-day test of one dense page on your worst phone, looking at it zoomed in. If it's wrong, there's a
second engine option (a small piece of native Android code) with the same interface, so the plan
survives either way. Second, moving your users' existing marks into the new storage must not lose a
single one. That's handled with a tested one-time migration, an "export everything" button as a safety
net, and keeping the old data read-only for a full release so nothing is destroyed.

**What I would NOT do, so you don't waste money.**
I wouldn't rewrite it in Flutter or Kotlin — you'd spend months re-learning your own app to gain the one
thing (a native text engine) that you can add to React Native instead. I wouldn't make the mushaf a set
of pictures with no word positions — it would look fast and destroy the marking feature that makes the
app worth anything. I wouldn't move everything to the cloud — teachers work with no wifi, so local-first
is correct. And I wouldn't chase more features until the reader is flawless, because that's the promise
your whole product rests on.

**The three numbers that define success.**
From choosing a student, the page is readable in under a quarter of a second. From tapping a word, the
mark appears in under a third of a tenth of a second. Over a hundred swipes, no single frame is ever
slow enough for your eye to catch. Those three numbers are the acceptance criteria for the whole build,
measured on the worst phone you own, not the best one.

**If you only do one thing this month.**
Do the two-day renderer test. It's one page, one phone, one measurement. It tells you whether the whole
plan is right — and if it works, you'll feel the difference in two days rather than in six months.

---

## Appendix A — `user.db` schema (sketch)

```sql
PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;

CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT);            -- schemaVersion, deviceId, installId

CREATE TABLE students(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, faceUri TEXT, archived INT DEFAULT 0,
  meta TEXT, prefs TEXT, createdAt INT NOT NULL, updatedAt INT NOT NULL,
  deleted INT DEFAULT 0, dirty INT DEFAULT 0, v INT DEFAULT 0);

CREATE TABLE groups(id TEXT PRIMARY KEY, name TEXT, createdAt INT, deleted INT DEFAULT 0, dirty INT DEFAULT 0);
CREATE TABLE group_members(groupId TEXT, studentId TEXT, PRIMARY KEY(groupId, studentId));

CREATE TABLE annotations(
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL,
  kind TEXT NOT NULL,                    -- 'mistake'|'note'|'bookmark'|'readingMark'|'voiceNote'
  surahId INT, verseNumber INT, wordIndex INT, wordEndIndex INT,
  category TEXT,                         -- tajweed category for mistakes
  editionId TEXT, pageNumber INT,        -- HINT ONLY (fast page lookup); never the identity
  canvasKey TEXT,                        -- drawings / voice-note grouping (parity with today)
  payload TEXT,                          -- small JSON: text, duration, file ref, style
  resolvedAt INT, resolvedBy TEXT, attempts INT DEFAULT 0,
  createdAt INT NOT NULL, updatedAt INT NOT NULL, deviceId TEXT NOT NULL,
  deleted INT DEFAULT 0, dirty INT DEFAULT 0, v INT DEFAULT 0, serverTs INT DEFAULT 0);
CREATE INDEX ix_ann_page      ON annotations(studentId, editionId, pageNumber) WHERE deleted=0;
CREATE INDEX ix_ann_verse     ON annotations(studentId, surahId, verseNumber)  WHERE deleted=0;
CREATE INDEX ix_ann_open      ON annotations(studentId, category)              WHERE deleted=0 AND resolvedAt IS NULL;
CREATE INDEX ix_ann_dirty     ON annotations(dirty)                            WHERE deleted=0;

CREATE TABLE drawings(
  id TEXT PRIMARY KEY, studentId TEXT NOT NULL, canvasKey TEXT NOT NULL,
  editionId TEXT, pageNumber INT, surahId INT, verseFrom INT, verseTo INT,
  strokes BLOB NOT NULL,                 -- compacted binary (port the current thinning/normalising rules)
  createdAt INT, updatedAt INT, deviceId TEXT, deleted INT DEFAULT 0, dirty INT DEFAULT 0, v INT DEFAULT 0);
CREATE UNIQUE INDEX ux_draw ON drawings(studentId, canvasKey);

CREATE TABLE reading_positions(
  studentId TEXT NOT NULL, deviceId TEXT NOT NULL,
  editionId TEXT, pageNumber INT, surahId INT, verseNumber INT, updatedAt INT NOT NULL,
  PRIMARY KEY(studentId, deviceId));

CREATE TABLE practice_log(
  id TEXT PRIMARY KEY, studentId TEXT NOT NULL, surahId INT, verseNumber INT,
  result TEXT,                            -- 'solid'|'shaky'|'again'
  ease REAL, intervalDays REAL, dueAt INT, reviewedAt INT NOT NULL, deviceId TEXT);

CREATE TABLE sessions(id TEXT PRIMARY KEY, studentId TEXT, startedAt INT, endedAt INT, audioRef TEXT, note TEXT);
CREATE TABLE session_marks(id TEXT PRIMARY KEY, sessionId TEXT, annotationId TEXT, atMs INT);

CREATE TABLE assignments(id TEXT PRIMARY KEY, studentId TEXT, title TEXT, dueAt INT,
  ranges TEXT, focusCategories TEXT, createdAt INT, deleted INT DEFAULT 0, dirty INT DEFAULT 0);

CREATE TABLE oplog(
  id INTEGER PRIMARY KEY AUTOINCREMENT, opId TEXT UNIQUE, entity TEXT, entityId TEXT, op TEXT,
  payload TEXT, updatedAt INT, deviceId TEXT, attempts INT DEFAULT 0, sentAt INT, batchId TEXT);

CREATE TABLE sync_state(k TEXT PRIMARY KEY, v TEXT);      -- cursors per collection, protocolVersion
CREATE TABLE conflicts(id TEXT PRIMARY KEY, entityId TEXT, localPayload TEXT, remotePayload TEXT, seenAt INT);
CREATE TABLE media_cache(k TEXT PRIMARY KEY, kind TEXT, path TEXT, bytes INT, sha TEXT, lastUsedAt INT);
CREATE TABLE page_image_cache(k TEXT PRIMARY KEY, editionId TEXT, page INT, width INT, dpi INT,
                              theme TEXT, path TEXT, bytes INT, lastUsedAt INT);
```

## Appendix B — Cloud contract

```
Firestore (client never writes directly):
  users/{uid}                         { username, createdAt, premium }
  students/{sid}                      { name, facePath, archived, meta, prefs, updatedAt, deviceId, v, deleted }
  students/{sid}/annotations/{id}     { kind, target{surahId,verseNumber,wordIndex,wordEndIndex},
                                        category, editionId, pageNumber, payload, resolvedAt,
                                        updatedAt, deviceId, v, deleted }
  students/{sid}/drawings/{canvasKey} { strokesPath (Storage), updatedAt, deviceId, v, deleted }
  students/{sid}/readingPosition      { editionId, pageNumber, surahId, verseNumber, updatedAt, deviceId }
  groups/{gid}                        { name, members[], updatedAt, v, deleted }
  media/{sid}/{kind}/{id}             { path, bytes, sha, mime, createdAt }

Cloud Functions (all writes):
  applyOps({ studentId, batchId, protocol, deviceId, ops[] })
      → validates ownership + Zod schema + payload size
      → clamps updatedAt to server time
      → writes/merges per-record documents (idempotent by opId)
      → returns { accepted: numberOfOps, watermark, serverChanges? }
  pullChanges({ studentId, collection, cursor, limit })
      → { records[], nextCursor }
  packManifest({ appVersion })        → { packVersion, geometryVersion, url, bytes, sha256 }
  gcTombstones()                      → scheduled; deletes tombstones older than 90 days
  deleteAccount()                     → deletes Firestore + Storage under users/{uid}

Security rules (tested in CI):
  - a user may read/write only under their own uid path
  - direct client writes to record collections are denied (Functions use the admin SDK)
  - Storage paths mirror ownership; media size and mime enforced
  - App Check required in production
```

## Appendix C — The end-to-end walkthrough of one tap

Worth reading once, because it shows why the redesign is fast in practice:

```
1. Teacher taps a word in verse 2:255 while the student is reciting.
2. UI thread: pager is idle, so the gesture reaches the page's native view immediately.
3. The paragraph's geometry is already in memory for this page → getGlyphPositionAtCoordinate
   returns the character index → word id, in well under a millisecond. (No JS involved yet.)
4. The renderer draws the marked word's underline rect and repaints the highlight layer only —
   the paragraph is not rebuilt. Visible mark: < 20 ms after the finger lifted.
5. In parallel, JS receives one event {wordId, word, verse, action} and calls
   annotationRepo.add(studentId, {kind:'mistake', category:'madd', target}).
6. The repository: writes one row to annotations · appends one op to oplog · bumps the student's
   page-cache entry · notifies the reader store (which updates only that page's subscribers).
7. The sync worker is already running: within ~2 s (or when back online) it batches the op with any
   others and calls applyOps(). The Function writes one document and returns a watermark.
8. The Mistakes screen, the progress dashboard and the revision queue are queries over the same rows —
   they need no new bookkeeping, and they were already correct before the network was involved.
9. If the phone dies at step 7, the op is still in the oplog and is retried on next launch with the
   same opId — so it can be applied exactly once, never twice, never lost.
```

## Appendix D — Feature parity with today's app (nothing lost)

| Today | In the rebuild |
|---|---|
| Username auth, register, logout | same, plus password reset and optional real email |
| Students CRUD + faces | same, plus archive, groups, per-student prefs |
| Student hub: resume, daily, go-to-page | same, plus a "practice" card from the revision queue |
| 3 reading modes | same |
| IndoPak + Uthmani, 4 fonts | same, via the content pack and the shared parity module |
| Frame, pills, bismillah, headers, ta'awwud, sparse pages | same visuals, drawn by the engine |
| Themes, night mode, brightness, font size | same, via design tokens |
| Tablet spread + landscape scaling | same |
| Word tap → mistake highlight | same feel, exact geometry, plus **categories** and **resolution** |
| Verse long-press / badge menu | same, plus category and resolve actions |
| Bookmarks, reading mark, notes | same, now verse-anchored records |
| Voice notes | same, plus storage backup and a session timeline |
| Drawing canvas | same rules, Skia-drawn, plus verse-range anchoring |
| Share capture with layer toggles | same, higher quality, plus mistake-list and PDF reports |
| Audio: qaris, verse play, loops, page turns, basmala, downloads, resume | same, plus background playback, lock screen, speed, resumable downloads |
| Sync: auto + manual, badge, offline | same promises, oplog guarantees, two-device simulator tests |
| Tutorial + haptics + ads + settings + index screens | same (tutorial becomes data-driven; ads load after first paint) |
| Offline reading | **fully offline including first launch** |

## Appendix E — What I'd ask the owner before starting

1. **Whose phone is the target?** Which physical device must feel perfect? (All budgets are relative to it.)
2. **Are 32-bit / very old devices a real segment?** It decides how much I invest in the raster tier.
3. **Do teachers share students with each other?** (Multi-teacher sharing is a data-model decision made
   now, cheaply, or later, expensively.)
4. **Is premium a plan for the next year?** It shapes the data model for reports and media limits.
5. **Can we ship two apps temporarily?** (Old app for existing users, new app in internal testing) — it
   changes how aggressive the migration can be.
6. **How much content are you willing to ship in the binary?** (A 40 MB install becomes ~80 MB with a
   bitmap pack; that's a marketing decision as much as a technical one.)
7. **Who checks the Arabic?** The visual golden tests catch pixel drift, but only a teacher can confirm
   that a diacritic *looks right*. Plan for one review session per release.
