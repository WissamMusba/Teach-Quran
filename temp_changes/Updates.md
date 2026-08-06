# Updates — staged changes in temp_changes/

Everything here lives in `temp_changes/` only. The real `src/` is untouched (verified by MD5 where noted) — you rebuild from this staging folder.

## Latest — UI tweaks (phone reading)

### 1. Bigger phone edge padding for the mushaf text
- `temp_changes/MushafPageView.tsx` — `hPad(w)`: phone padding raised **10 → 14** (`w >= 600` tablets keep 8% of width).
- `temp_changes/stroke.ts` — `hPadFor(w)`: same **10 → 14** change, kept in sync so drawing normalization/denormalization (padX) still lines strokes up exactly with the text. (Real files confirmed different by MD5 — nothing in `src/` was touched.)
- Effect: words no longer sit right against the page edge on phones; drawings under words stay aligned.

### 2. Smaller verse-number badges
- `temp_changes/MushafPageView.tsx` (styles):
  - `verseBadge` circle: **32×32 → 26×26** (borderRadius 16 → 13)
  - `verseBadgeText` number: **14 → 12**
  - `verseBadgeContainer.minWidth`: 24 → 22
- All three badge render sites share these styles, so bookmarked/reading-mark/plain badges all shrink together.

---

## Earlier staged work (mirrored from the sync overhaul — see commit/README history)

- `localDB.ts` — addToSyncQueue SQL fix (retryCount → synced/attempts), 10-page chunk/audio-range stores, saveStudentData merge + queue=false, purgeLocalStudent wipes audio_notes_cache, migrateLegacyAudioNotes guards, saveStudentData returns "queued?" bool
- `sync.ts` — requestSync single-flight + pendingPull chaining, pushAllDirty 3-pass push, user-level `sync_manifest` (written in-batch on push, read once on pull — pull cost now independent of student count), pullRemote manifest-driven diff with legacy fallback, lazy pullDrawings (skips Firestore read when range already local) / pullAudioRange (version-compared)
- `audioNotes.ts` — registerAudioNote 10-page range store; `playAudioNote` on-demand file download (now called by NotesScreen)
- `QuranViewScreen.tsx` — student-switch-safe flushPendingSave (currentStudentIdRef), badge increments only when a queue row was written, AppState background flush via canvas `flush()`, handleVoiceNoteSaved try/catch + orphan-upload cleanup, spread spans pull BOTH 10-page ranges, addPendingChange at highlight/note/audio sites
- `DrawingCanvas.tsx` — pen sampling ≥3px, rounded coords, imperative `flush()` on the handle
- `DashboardScreen.tsx` — manual sync try/catch/finally, button disabled only in-flight, **student list now refreshes on focus AND whenever a sync completes** (fixes: new student on another device not appearing until manual sync)
- `NotesScreen.tsx` — playback wired through `playAudioNote` (downloads only on press)
- `App.tsx` — 30-MINUTE cadence (push-only interval; pulls on open/foreground/manual), background push deferred 600ms
- `AudioPlayerBar.tsx` — removed caption text, buttons shortened 46 → 34px tall
- `RegisterScreen.tsx` — pre-existing missing `isSuccess` field fixed (needed for clean tsc)
- `audioPlayback.ts` — pending v49 staging

## How to apply
Copy the files back over `src/` (or build from this dir), then run:
`npx tsc --noEmit --skipLibCheck --esModuleInterop --jsx react-native --moduleResolution node --module esnext --target es2018 App.tsx src\database\localDB.ts src\api\sync.ts src\api\audioNotes.ts src\utils\stroke.ts src\screens\QuranViewScreen.tsx src\screens\DashboardScreen.tsx src\screens\NotesScreen.tsx src\screens\RegisterScreen.tsx src\components\drawing\DrawingCanvas.tsx src\components\quran\MushafPageView.tsx src\components\audio\AudioPlayerBar.tsx src\utils\audioPlayback.ts`
(verified exit 0 on the last full pass)
