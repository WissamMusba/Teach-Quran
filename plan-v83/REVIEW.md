# REVIEW.md — Reviewer Brief for plan-v83 (v83 work package)

Purpose: a READ-ONLY reviewer agent audits the implementation diffs produced from the three briefs in this folder (WS-1, WS-2, WS-3). You do NOT modify code. You read, you run verification commands, you produce a findings report.

## 1. Scope of the review

The implementation was planned against the CURRENT working tree at `C:\Users\wissa\Downloads\QuranMasterApp` (React Native ~0.72, TypeScript). The approved changes touch exactly three files:

| Workstream | File | Planned change (see brief) |
|---|---|---|
| WS-1 | `src/screens/QuranViewScreen.tsx` | TTL-gate (5 min) the 3 lazy cloud-pull sites: page-settle effect (lines 1003–1023), `refreshCloudDrawings` (938–972; watcher call at 1066 gains a force/bypass, canvas-open call at 1105 stays gated), toolbar-expand pull (1128–1154); shared module-level per-(student,range) timestamp map replacing `expandedDrawPullAttempted` (declared line 65, cleared line 1369); local SQLite merge untouched. |
| WS-2 | `src/database/localDB.ts` | `saveStudentData` (355–379) drawings loop (356–363) writes only changed keys via a module-level per-student last-persisted snapshot diff; first-per-session bootstrap full write; baseline updated only after success; `return changed` semantics (378–379) unchanged. |
| WS-3 | `src/api/sync.ts` + one line in `src/database/localDB.ts` | (3a) `pullRemote` (260–373) parallelizes students with 3-slot bounded concurrency, per-student `savePullBatch` atomicity kept; `PRAGMA busy_timeout=3000` added in `initDatabase` (localDB.ts ~16–17). (3b) chunk push loop (94–130) converted to `runTransaction` + `max(local,cloud)+1`, stale docs skipped, smaller slice constant to respect the 500-op transaction budget. (3c) `pushAllDrawings` (418–472) compacts appended strokes (`norm:1` + `compactStroke`) using last-used/window geometry and adds an ~800 KB serialized-size guard with fail-safe skip. |

Revise your expectations if the implementation deviates from the briefs — but flag EVERY deviation in the findings report, even if minor.

## 2. Verification commands (run all; record raw output)

1. `npx tsc --noEmit` — from `C:\Users\wissa\Downloads\QuranMasterApp`. MUST exit 0 with zero errors.
2. `git diff --stat` and `git diff` — confirm only the 3 allowed files changed. Warn if temp_changes/ (there are stale copies of App.tsx, DashboardScreen.tsx, SyncStatus.tsx in `temp_changes\` from earlier experiments) or any other file appears.
3. Grep audits (record results):
   - WS-1: `expandedDrawPullAttempted` — should be gone entirely (lines 65, 1137, 1143, 1369); `refreshCloudDrawings(` call sites — must show `(true)`/'()' exactly once each at 1066/1105; every `pullDrawings(` / `pullAudioRange(` invocation site must be inside a gate (page-settle 1017/1021, refreshCloudDrawings 967/970, toolbar 1141) or a documented force path; `cloudPullLastAt|cloudPullDue|cloudPullStamp` defined and used.
   - WS-2: `lastPersistedDrawings` — declared module scope in localDB.ts, referenced ONLY inside `saveStudentData`; `saveChunk(`,... `(cur?.v || 0) + 1` still present inside saveStudentData; `return changed` still line ~378-379 semantics.
   - WS-3: `MAX_BATCH_OPS` — either still used or fully removed (no dead const); `lastDrawingGeo` set in `pushDrawings` and read in `pushAllDrawings`; `busy_timeout=3000` present in `initDatabase`; `runTransaction` present in the chunk-push path; `norm: 1` + `compactStroke` present in `pushAllDrawings`; `800`-KB guard constant present; every `tx.get` inside the new chunk transaction bounded ≤ slice size (op budget ≈ 2×slice ≤ ~204).
4. Count checks: `.where('updatedAt'` occurrences in sync.ts (must remain exactly 1 — the pull range query); `savePullBatch(` calls per pull pass = one per student (only the extract call site + definition).

## 3. Acceptance-criteria audit

Walk the acceptance criteria in each brief and mark each P (pass with evidence—cite command/output or code inspection), F (fail), or N/E (not evaluable statically — mark as MANUAL):

- WS-1: ≤10 GET pairs per 100-page session after TTL (code-inspection: gate present on all 3 sites); revisit-within-TTL → 0 reads; watcher/manual-sync force-bypass present; local merge on every settle un-gated; foreground clear present; tsc.
- WS-2: unchanged-chunk `v` never bumped after a highlight-only edit (code-inspection: diff gate); first-per-session bootstrap full write; baseline-only-after-success; return-value contract preserved; tsc.
- WS-3: 3-slot pool present (≈3× speedup is a runtime claim — mark MANUAL); per-student single `savePullBatch`; busy_timeout line present at init; monotonic max(local,cloud)+1 in chunk push; stale-skip + queue-clear convergence; slice ≤ ~204 ops; compaction + norm:1 single-tag on appended strokes; 800 KB guard + fail-safe skip; cloud-owned strokes not re-compacted; overall tsc + no unhandled-rejection paths.

## 4. Feature-break scan (manual re-check list — must be handed to the implementer/user as is)

Every feature below must be re-checked on device after the implementation. For each, note the baseline behavior before the change so deviations are obvious:

1. Word highlights: tap a word → highlight appears instantly (SQLite); rapid double-tap on two words keeps both (stale-snapshot fix).
2. Bookmarks: add/remove; badge count (pendingChanges) increments only on real manifest changes; two devices editing concurrently — nothing lost.
3. Notes: per-verse text notes; edit + clear.
4. Voice notes: record → upload (audioNotes.ts) → registry entry; playback; registry sync across devices (`audioNotes` range docs).
5. Drawings: draw → save → reopen page (persisted); undo/redo; clear canvas; canvas open/close transitions; toolbar expand pre-fetch.
6. Sync across devices: device A draws → sync → device B sees strokes (≤ TTL/next sync); device B draws meanwhile → merge by stroke id (no dupes); norm:1 compacted strokes land on the same words; legacy raw cloud strokes unaffected.
7. Mistakes list: MISTAKE_COLOR-based highlights still appear in the mistakes list screen.
8. Dashboard manifests: student list, syncing header, "Pushed: n | Pulled: m" alert, offline banner.
9. Reader page loads: 604/610-page mushaf, warmNearPages, layout cache hits (no re-measure flicker), split-view (splitOn) pages, surah mode.
10. Audio playback: surah/audio bar, qari selection, pause on background.
11. Reading mark: set → persists; LWW across devices.
12. Offline behavior: draw/annotate offline → sync later; background flush on kill.

## 5. UI-byte-identical check guidance

The hard constraint is: zero visual change. Do this:

- `git diff` on the 3 files: reject ANY hunk touching JSX, StyleSheet objects, colors, fonts, spacing, text strings, icons, or component props (excluding functional code inside event handlers).
- Grep the diff for style/animation/visual tokens: `style=`, `StyleSheet`, `padding`, `fontSize`, `color`, `Animated`, `opacity`, `transform`, `onLayout`, and the no-touch file list (AnimatedHeader.tsx, WordHitArea.tsx, MushafPageView.tsx, app.json, theme, fonts, images, FlatList `virtualizedListProps`/windowSize/etc.) — zero hits allowed.
- The only permitted no-touch-adjacent interactions: WS-1 code paths call `pullDrawings`/`pullAudioRange`/`setCanvasData`/`mergeChunks` (functional), WS-2 alters SQLite write frequency (content-identical), WS-3 alters Firestore payloads (schema-identical). Screen render output must be byte-identical for identical data.

## 6. Severity rubric

| Severity | Definition | Required action |
|---|---|---|
| BLOCKER | Data loss or corruption risk; version regression that loses sync data; Firestore doc overwrite of newer data; crash/exception on a main path (reader, sync, drawing save); tsc failure; any change to a no-touch file; visual change. | Stop: the implementation must be fixed and re-reviewed before any merge/build. |
| MAJOR | Behavior change visible to users beyond the approved scope; an acceptance criterion fails (code-inspection level); unbounded retry loop potential; transaction op budget breached (≈900 ops slice); norm double-scale hazard present; busy_timeout missing while concurrency added; TTL gate that can block the watcher path. | Fix before merge; approve only after a correcting commit and re-check of the specific criterion. |
| MINOR | Comment staleness; naming inconsistency; missing documentation of a signature change; over-cautious guard threshold; unused-but-harmless code (e.g., kept `MAX_BATCH_OPS`); warning-noise additions. | Record in the report; fix at implementer's discretion; does not block merge. |
| N/E (MANUAL) | Runtime-only claims (speedup factor, read counts, double-device scenarios, Firebase behavior). | Listed in the report as manual checks; must be run by the user before the release is declared done. |

## 7. Findings-report format (fill out exactly)

```markdown
# Review findings — plan-v83 (date, reviewer)

## Verification evidence
- tsc --noEmit: PASS/FAIL (paste tail of output)
- git diff --stat: (paste; must list only src/screens/QuranViewScreen.tsx, src/database/localDB.ts, src/api/sync.ts)
- Grep results: (paste each grep + hit count)
- Count checks: (results)

## Findings
| # | Severity | Workstream | File:line(s) | Description | Required action |
|---|----------|------------|--------------|-------------|-----------------|
| 1 | ... | WS-x | ... | ... | ... |

## Acceptance-criteria matrix
| Criterion (quote) | Status P/F/N-E | Evidence |
|-------------------|----------------|----------|
| WS-1: "..." | ... | ... |

## Manual test checklist (hand to user)
- [ ] (each item from section 4, with expected result)

## Deviation log (implementation vs. brief)
- Brief said X at file:line; implementation does Y — assessment: acceptable/not.

## Verdict
APPROVED / APPROVE-WITH-FIXES (list blockers/majors) / REJECTED (list blockers)
```

## 8. Reviewer ground rules

- Do not trust the briefs blindly: re-verify every line reference cited in a finding against the current file before reporting it.
- If the implementation is a superset (e.g., extra hygiene refactor inside the allowed files), audit it for risk; report as MINOR unless it changes behavior.
- Remember the design invariants that must survive all three workstreams: (1) SQLite is the single source of truth for reading; (2) `queue=false` for drawings and for pull-side writes; (3) syncing→synced watcher fires after EVERY sync run incl. push-only; (4) `pullDrawings` merge is stroke-id-based and never clobbers local edits; (5) one atomic `savePullBatch` per student; (6) layout cache version and MushafPageView are off-limits.
- Produce the report ONLY; write no code, create no files outside this plan folder's report file if asked.