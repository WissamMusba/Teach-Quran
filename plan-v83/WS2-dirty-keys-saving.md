# WS-2 — Dirty-Keys-Only Saves (src/database/localDB.ts)

Implementation brief for a READ-ONLY-planned change. Verify every line reference against the current source before editing; line numbers below were verified against the working tree at plan time.

## GOAL

Every flush of student data rewrites ALL drawing chunks in the students' `data.drawings` map, even when only a highlight or a bookmark changed — SQLite churn plus a `v+1` bump on every drawing chunk, which inflates versions and makes other devices re-fetch chunks whose content never changed. After this change, only drawing chunks whose content actually changed since the last persisted flush are rewritten; untouched drawing chunks keep their exact stored `v`. Same data, same result on every device — far fewer SQLite writes and no phony version inflation. The caller contract (`saveStudentData(studentId, data) => Promise<boolean>`) and the queue semantics stay identical.

## HARD CONSTRAINTS (apply to every change in this brief)

- NO visual/UI changes, NO feature changes, NO data-loss risk. The reading experience, drawing experience, notes, bookmarks, sync semantics, and all screen looks must remain identical.
- Do NOT touch: AnimatedHeader.tsx, WordHitArea.tsx, MushafPageView.tsx, app.json, theme, fonts, images, FlatList virtualization props, the layout cache version.
- Keep existing functions' public behavior where possible; document any signature changes explicitly.
- tsc --noEmit must pass (run from C:\Users\wissa\Downloads\QuranMasterApp).

## CURRENT BEHAVIOR (verified)

File: `src/database/localDB.ts` (611 lines).

`saveStudentData` — **lines 355–379**:

```ts
export const saveStudentData = async (studentId: string, data: any) => {
  for (const [k, v] of Object.entries(data.drawings || {}) as Array<[string, any]>) {
    if (v && v.paths) {
      const cur = await getChunk(studentId, k);
      // merge so strokes never wipe co-located highlights/notes; drawings are
      // LAZY-SYNCED per 10-page range: keep the local cache write, never queue
      await saveChunk(studentId, k, { ...(cur?.data || { strokes: [], highlights: {}, notes: {} }), strokes: v.paths }, (cur?.v || 0) + 1, false);
    }
  }
  const m = await getManifest(studentId);
  let changed = false;
  if (JSON.stringify(m.data.bookmarks) !== JSON.stringify(data.bookmarks)) { m.data.bookmarks = data.bookmarks || m.data.bookmarks; changed = true; }
  if (JSON.stringify(m.data.lastRead) !== JSON.stringify(data.lastRead)) { m.data.lastRead = data.lastRead || m.data.lastRead; changed = true; }
  if (changed) { m.data.v = (m.data.v || 0) + 1; await saveManifestLocal(studentId, m.data); }
  return changed;   // true only when bookmarks/lastRead queued a manifest row
};
```

Mechanics:
- The drawings loop (356–363) runs on EVERY call with no comparison: each key with a truthy `v.paths` gets `getChunk` (358) + `saveChunk(..., (cur?.v || 0) + 1, false)` (361). Note `v.paths` truthy includes `[]` — an emptied canvas still rewrites. `saveChunk` (109–117) runs an SQLite transaction (INSERT OR REPLACE into `student_data_cache` with the full chunk JSON) and, because `queue=false`, does NOT enqueue — but it DOES call `markStrokesDirtySession()` when `data?.strokes?.length` (line 110) so a later full sweep is triggered.
- The manifest diff (366–373) is already changed-only; the return value (378–379) reflects ONLY bookmarks/lastRead changes, never drawings — callers rely on it for the sync badge (`addPendingChange` — QuranViewScreen.tsx line 1313: `saveStudentData(sid, dataToSave).then((queued: boolean) => { if (queued) dispatch(addPendingChange()); })`).
- Callers (all call sites verified): `flushPendingSave` in QuranViewScreen.tsx (1307–1315, the 400 ms-debounced flush of `updateData` snapshots — see 1345–1357), and the one-time skeleton persist at QuranViewScreen.tsx:1210. Both pass a FULL snapshot (data = whole `{ highlights, notes, bookmarks, drawings, lastRead, updatedAt }`), so repeated flushes of the same unchanged drawings map are common — that is the waste.
- Drawings chunks themselves: `v` is also consulted by the pull side as the clobber guard (`if (local && local.v >= (cloud.v || 0)) return;` — sync.ts lines 296, 249, 226) and carried into cloud `draws` docs at push time (`v: local.v` — sync.ts line 106). Inflated `v` → other devices see `cloud.v > local.v` and re-fetch chunks whose annotations are identical.

Why a snapshot diff is safe: stroke content is written to SQLite by exactly two paths — `saveCanvasEdit`/`saveChunk` (drawing canvas, queue-aware) and pull-side `saveChunkNoQueue`. `saveStudentData` drawings come from Redux `studentData.drawings` (last-known snapshot, updated via `updateData` patches from the DrawingCanvas `onSave` — QuranViewScreen.tsx 2079–2091). Diffing against a module-level "last persisted drawings snapshot" detects exactly the changes the previous flush persisted.

## REQUIRED CHANGES (all inside `src/database/localDB.ts`)

1. **Add a module-level snapshot ref** near the existing session flags (lines 104–107, where `strokesDirtySession` lives):
   - `let lastPersistedDrawings: Record<string, string> = {};` — keyed by `studentId`, value is a canonical JSON string of that student's drawings map as of the last successful persist. (Per-student, so two students' flushes never collide.)

2. **Rewrite the drawings loop in `saveStudentData` (lines 356–363) to write changed keys only:**
   - Compute `const drawings = data.drawings || {};` once.
   - `const baseline = lastPersistedDrawings[studentId];` and `const canonical = canonicalize(drawings);` where `canonicalize` is a tiny local helper producing a stable, order-independent serialization (see step 3). Do NOT use bare `JSON.stringify(data.drawings)` for the diff — object key insertion order can vary between Redux spreads and a reorder would read as "changed".
   - If `baseline === undefined` (first `saveStudentData` call for this student in this app session): behave EXACTLY like today — loop everything (full rewrite, all `(cur?.v || 0) + 1` bumps, `queue=false`).
   - Else: `const diffKeys = keys of drawings where canonical-per-key value differs from baseline` (per-key compare; also treat a key PRESENT in baseline but ABSENT in the new map as removed — but keep the existing `if (v && v.paths)` guard shape: only keys with `v && v.paths` are ever candidates, exactly as at 357). For each diff key run the exact existing body (358–361: `getChunk`, merge spread from `cur?.data`, `strokes: v.paths`, `(cur?.v || 0) + 1`, `queue=false`). Unchanged keys: NO read, NO write, NO v bump.
   - **Persist the baseline only AFTER the loop completes successfully** (after step 4/5's sequence below): `lastPersistedDrawings[studentId] = canonical;`. If any `saveChunk` throws, leave the baseline untouched so the next flush retries every diff key (safe direction: at most a re-bump of a key written moments earlier on the error path — code never loses an update).
   - Place the baseline update so that it still happens when only bookmarks/lastRead changed and the drawings map is unchanged (i.e., after the manifest block, before `return changed;`).

3. **Canonical comparison helper (module-scope, private):** a small function `canonicalize(obj)` that returns a JSON string built from sorted keys (and for nested plain objects, sort recursively; strokes arrays keep their order) or, simplest safe equivalent, compares two maps key-by-key via `JSON.stringify(value)` per key WITHOUT a global snapshot string. Pick one; requirement: two structurally equal objects must compare equal regardless of property insertion order; `undefined` members and missing keys must be treated consistently.

4. **No other changes.** The manifest diff block (364–377), `return changed` (378–379), `addToSyncQueue` usage, `getStudentData` (336–354 — the v1 compat shim that feeds `blob.drawings` at 344), `saveChunk` (109–117), `saveChunkNoQueue` (120–121), and the pull-side `savePullBatch` (204–229) are all untouched. Do NOT touch `sync.ts` in this brief (WS-3 owns it).

Signature note: `saveStudentData(studentId: string, data: any)` — UNCHANGED, per the approved "self-contained snapshot-diff" approach (no optional dirty-keys param).

## WHAT MUST NOT CHANGE

- `queue=false` for drawing-chunk writes — drawings never enter `sync_queue` (comment at 359–360, `saveChunk(..., false)` at 361).
- Flush-batch scope — `saveStudentData` still receives the full pending snapshot from `flushPendingSave`/skeleton persist; the debounce pipeline (QuranViewScreen.tsx 1307–1357) is untouched.
- Stroke/label co-location merge-safety — the `{ ...(cur?.data || { strokes: [], highlights: {}, notes: {} }), strokes: v.paths }` spread (361) is preserved verbatim on every written key.
- The `v+1` formula for keys that ARE written — `(cur?.v || 0) + 1` semantics remain.
- The return value contract (`true` only when bookmarks/lastRead changed) and the `markStrokesDirtySession` side effect (via `saveChunk`, line 110).
- Any other localDB function and any other file.

## ACCEPTANCE CRITERIA (testable)

- Saving a highlight on a page whose drawing chunk already exists: the drawing chunk's `v` in `student_data_cache` does NOT change (verify by SELECTing `v` before/after, or by a temporary console log in `getChunk`), and the `draws` SQLite write is limited to the changed chunk. Previously: every drawing chunk bumped `v+1` every flush.
- First `saveStudentData` call per student per session rewrites all drawing chunks (session bootstrap — parity with old behavior, one time only).
- Only keys whose content changed are written: adding a stroke to page_5 rewrites `page_5` only; pages 1–4, 6+ untouched.
- Clearing a canvas (drawing chunk re-saved with `paths: []` — truthy `[]` per line 357) still rewrites that key exactly as today.
- A pull-side write (`saveChunkNoQueue`) is never undone by a later `saveStudentData` flush (diff only reflects Redux `data.drawings`, and only changed keys are written — an unchanged key's other fields like highlights are re-merged only when the key itself is rewritten, exactly as today).
- Bookmarks/lastRead-only saves: same `changed=true` result, `addPendingChange` badge counts identically (QuranViewScreen.tsx:1313).
- `npx tsc --noEmit` passes from the repo root.

## SELF-REVIEW CHECKLIST

- Run `npx tsc --noEmit` (from C:\Users\wissa\Downloads\QuranMasterApp).
- Grep for dead refs: `lastPersistedDrawings` (declared in localDB.ts, only written in `saveStudentData`), the canonicalize helper (no unused exports), and confirm no remaining references to any removed identifier.
- `git diff` audit: diff limited to `src/database/localDB.ts`; only the drawings loop of `saveStudentData` + the new module-scope helper; zero changes to `student_data_cache` schema, `sync_queue`, manifest, audio, layout-cache code.
- Hand-check regression list: draw stroke → kill app quickly → reopen (flush-on-background catches it — QuranViewScreen.tsx 1365–1383); highlight-then-rapid-double-tap (the stale-snapshot path, 1285–1343); bookmark then read → badge count; notes per verse; voice-note registration (`saveAudioNotesRange` — NOT part of this diff; confirm untouched); drawings appearing from a second device after a pull.
- Sanity: run a session with 2 students and alternate flushes — per-student baselines must not cross (keyed by `studentId`).

## RISKS & WARNINGS

- **Bootstrap skip trap:** if you skip the first-per-session write entirely on the theory that "SQLite already has this", a drawing made in the PREVIOUS session (before that session's final flush) could be missed. The brief mandates full rewrite on first `saveStudentData` per student per session — keep it.
- **Early-clear trap:** never update `lastPersistedDrawings[studentId]` BEFORE the writes. A mid-loop SQLite failure would then mark unsaved content as persisted — the exact data-loss bug this feature must never have. Update only after the loop, and wrap the baseline assignment so a throw leaves it stale (retry-next-flush).
- **Ordering NaN:** bare `JSON.stringify` comparisons are unstable when the same object is rebuilt with different key order (Redux spreads). Use the canonical compare (step 3) or per-key value compares. A spurious "changed" is only a wasted write (benign), but it erodes the feature's purpose.
- **`updatedAt` inside drawn entries:** each stroke save stamps a new `updatedAt` in the paths object (`QuranViewScreen.tsx:2083/2089`) — the diff must treat that as a REAL change (it is content). Don't strip it.
- **Return-value coupling:** `return changed` must never become true because a drawing was written — the badge/`addPendingChange` math and DashboardScreen flush counting depend on it (verified comment at 378 and caller at QuranViewScreen.tsx:1313).
- **Stringly keys:** `data.drawings` keys are `page_N`/`surah_N` canvas keys (canvasKeyForPage/canvasKeyForSurah, localDB.ts 9–10); the diff keys must use the exact same strings — no normalization.