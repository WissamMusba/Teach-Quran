# WS-1 — Throttle Cloud Reads (QuranViewScreen.tsx)

Implementation brief for a READ-ONLY-planned change. Verify every line reference against the current source before editing; line numbers below were verified against the working tree at plan time.

## GOAL

The reader currently fires up to 2 Firestore reads (drawings range + audio range) on nearly every page settle, so a 100-page session burns ~200 reads against the 50k/day free tier and can re-merge canvas strokes mid-read on slow links (visible flicker while `pullDrawings` re-writes SQLite and the canvas re-merges). After this change, cloud reads for a given 10-page range happen at most once per ~5 minutes per session, plus once immediately after a completed sync run (full pull or manual sync), while the local SQLite canvas merge continues to run on every settle untouched. Users see identical behavior on a single device, and cross-device drawings still arrive — just up to TTL/next-sync later, which is the accepted trade-off.

## HARD CONSTRAINTS (apply to every change in this brief)

- NO visual/UI changes, NO feature changes, NO data-loss risk. The reading experience, drawing experience, notes, bookmarks, sync semantics, and all screen looks must remain identical.
- Do NOT touch: AnimatedHeader.tsx, WordHitArea.tsx, MushafPageView.tsx, app.json, theme, fonts, images, FlatList virtualization props, the layout cache version.
- Keep existing functions' public behavior where possible; document any signature changes explicitly.
- tsc --noEmit must pass (run from C:\Users\wissa\Downloads\QuranMasterApp).

## CURRENT BEHAVIOR (verified)

File: `src/screens/QuranViewScreen.tsx` (2276 lines). All three sites that read the cloud on page activity:

1. **Page-settle effect** (lines 974–1027): fires whenever `settledPage === currentPageNum` changes (guard at line 978; `settledPage` is debounced 120 ms after a swipe settles — lines 2034–2035). `load()` (994) runs the LOCAL SQLite merge first (`mergeChunks` → `setCanvasData`, lines 994–996), then the cloud block (1003–1023):
   - builds `geoKeys`/`geo` (lines 1004–1005, `geo = { canvasW: splitOn ? pageW : winW, canvasH: winH, padX: hPadFor(splitOn ? pageW : winW) }`, `hPadFor` imported at line 47);
   - page mode groups the visible key(s) by 10-page range (`byRange`, lines 1009–1015) and then per range runs `Promise.all([pullAudioRange(sid, rk), pullDrawings(sid, rk, rKeys, geo)]).then(refresh).catch(refresh)` — **line 1017**;
   - surah mode pulls the single surah doc — **line 1021** (`pullDrawings(sid, drawingKey, geoKeys, geo)`).
   Every settle of every page inside the same 10-page range re-runs both GETs.

2. **`refreshCloudDrawings`** (lines 938–972, `useCallback`): pulls `pullDrawings` only (comment at 918–919: "pullAudioRange stays owned by the load effect") — page mode loop **lines 966–968** (`pullDrawings(sid, rk, rKeys, geo).then(refresh).catch(refresh)` at 967), surah mode **line 970**. Called from exactly two places:
   - the **syncing→synced watcher** (lines 1043–1085): on the `syncStatus` transition `'syncing'` → anything else (lines 1044–1046), deferred behind `InteractionManager` (1052), freshness-gated studentData re-hydration (1057–1061), then `refreshCloudDrawings().catch(() => {})` at **line 1066**, then the local `mergeChunks` canvas re-merge (1067–1081). `syncStatus` comes from `useSelector` (line 294) with `prevSyncStatusRef` (295).
   - the **canvas-open restore** effect (lines 1100–1106): on `isDrawing` false→true, stamped once per (student, range) via `canvasRestoreRef` (stamp at 1102, dedupe at 1103–1104, call at **line 1105**).

3. **Toolbar-expand pull** (lines 1128–1154): when `toolbarExpanded` becomes true (or page changes while expanded), a 200 ms timer (created at **line 1134**) fires; per-(student, range) session dedupe via the module-level `expandedDrawPullAttempted` Set (declared line 65; guard at 1137, add at 1143); then `pullDrawings(currentStudent.id, groupKey, pageKeys, geo)` at **line 1141** followed by a freshness-gated `getStudentData` re-hydration (1146–1149). The Set is cleared on app foreground at **line 1369** (AppState handler, lines 1365–1383).

Backend facts the gates must respect (verified in `src/api/sync.ts`):
- `pullDrawings` (482–502) merges stroke-by-stroke by id and writes via `saveChunkNoQueue` (499); `pullAudioRange` (505–514) writes via `saveAudioNotesRange(..., false)` — both are SQLite-only writes, queue-free.
- A full pull (`pullRemote`, sync.ts 260–373) refreshes `draws`/`audioNotes`/manifest but NEVER the `drawings` collection (strokes ranges) — so the screen's own `pullDrawings` remains the ONLY path that merges cross-device strokes into the visible canvas (see App.tsx runSync: `setSyncing` at 148 → `requestSync` at 149 → `setSynced` at 151; background/30-min interval runs are PUSH-ONLY — App.tsx lines 45, 52, 159–178 — yet still emit the same syncing→synced transition).
- Sync results (`pulled`, `manifestChanged`) are dispatched by `refreshReduxAfterPull` in App.tsx (152–154) but are NOT visible to this screen; only the `syncStatus` transition is.

## REQUIRED CHANGES (all inside `src/screens/QuranViewScreen.tsx`)

Module scope (near line 65, where `expandedDrawPullAttempted` lives):

1. Add a TTL constant and a module-level per-(student, range) last-pull map, e.g.:
   - `const CLOUD_PULL_TTL_MS = 5 * 60 * 1000;` (5 minutes — the approved TTL)
   - `const cloudPullLastAt = new Map<string, number>();` keyed `` `${sid}/${groupKey}` `` — `groupKey` is the 10-page range key (`rangeKeyForPage(...)`, `r_<lo>_<lo+9>`) in page mode, the surah key in surah mode (mirror the existing stamp convention at lines 1102 and 1136).
   - Two tiny helpers: `cloudPullDue(key)` (true when no entry or `Date.now() - t >= CLOUD_PULL_TTL_MS`) and `cloudPullStamp(key)` (sets the entry to `Date.now()`).

2. **Gate the page-settle cloud block (lines 1003–1023) by the TTL.** Keep the local merge (994–996) completely untouched. Inside the `if (!cancelled && currentStudent)` block, per range: compute the gate key, skip `Promise.all([pullAudioRange, pullDrawings])` (line 1017) when `!cloudPullDue(key)`; otherwise `cloudPullStamp(key)` and run the pulls exactly as today (same arguments, same `.then(refresh).catch(refresh)`). Do NOT stamp when skipped. The `cancelled` cleanup (line 1026) and the effect dependency array (1027) must not change.

3. **`refreshCloudDrawings` (938–972): give the watcher a TTL bypass, keep canvas-open TTL-gated.** Change the signature to `refreshCloudDrawings = useCallback(async (force?: boolean) => {...})` — an explicit, documented signature change (add it to the comment block at 916–937). Inside the page-mode loop (966–968) and surah-mode branch (970): when `force` is falsy, apply `cloudPullDue`/`cloudPullStamp` exactly as in change 2; when `force` is truthy, stamp and pull unconditionally. Callers:
   - line 1066 (syncing→synced watcher) → `refreshCloudDrawings(true)` — this is approved gate (a) "a full pull just completed" (and it also covers manual sync, which lands on the same transition via DashboardScreen.tsx lines 168–172).
   - line 1105 (canvas-open) → `refreshCloudDrawings()` (TTL-gated; the existing `canvasRestoreRef` one-pull-per-open stamp, lines 1102–1104, stays as-is).
   Update the `useCallback` dependency array (line 972) only if the new logic references new stable module-scope values — the map/helpers are module scope, so no new deps are required.

4. **Fold the toolbar-expand dedupe into the same TTL map (lines 1128–1154).** Replace the `expandedDrawPullAttempted` Set (declared at line 65; checked at 1137; added at 1143) with the shared gate: at line 1137 check `cloudPullDue(gateKey)`; before the `pullDrawings` call at 1141 `cloudPullStamp(gateKey)`. Delete the now-unused Set declaration at line 65 and its clear at line 1369 — replace the latter with `cloudPullLastAt.clear()` so app-foreground still re-enables pulls (preserves the current foreground-reset semantics documented at 1108–1117 and 1367–1369). Keep the 200 ms debounce, `getStudentData` freshness re-check (1146–1149), and the timer cleanup effects (1130–1131, 1156–1158) unchanged. Note: `foreground + no prior pull` also still satisfies `cloudPullDue` even if you keep the Set instead — but a single shared map is the approved approach (one gate, three doors).

5. **Never gate local-only work.** `mergeChunks` + `setCanvasData` (994–996, 1067–1081), the freshness-gated `getStudentData` re-hydration (1057–1061, 1146–1149), `pushDrawings` calls (2084, 2090 — sync.ts 384–403, push-only, out of scope for this brief), and all drawing UI code must remain exactly as-is.

## WHAT MUST NOT CHANGE

- The local SQLite canvas merge (SQLite-only) — runs on every settle/watcher regardless of the cloud gate.
- `pullDrawings`, `pullAudioRange`, `pushDrawings` in `src/api/sync.ts` — no changes in this brief (WS-3 owns sync.ts).
- The 120 ms settle debounce (2034–2035), the `cancelled` flag semantics (978/994/1006), `drawingGestureActiveRef` guard inside `refresh` (957), `canvasRestoreRef` one-pull-per-open stamp (1102–1104), the 200 ms expand debounce.
- Any Redux dispatch, any state shape, any JSX, any style.
- `syncStatus` handling in App.tsx / DashboardScreen.tsx — this brief is screen-scoped only.

## ACCEPTANCE CRITERIA (testable)

- Paging through 100 pages in one session fires `pullDrawings`/`pullAudioRange` only on the FIRST settle of each 10-page range (with `splitOn` off = 10 ranges → ≤10 GET pairs), then 0 until the 5-minute TTL expires — measured via console.log instrumentation or Firestore read logs in Debug mode.
- Revisiting a range within the TTL (swipe back) fires 0 cloud reads.
- After the watcher fires (any `syncing`→`synced` transition, including the 30-min push-only runs), the visible range pulls even inside the TTL; the whole screen still flips none — no visible change beyond what the old watcher did.
- A manual sync from the Dashboard (setSyncing→setSynced) is followed by a pull of the visible range on the reader (data from another device appears ≤ TTL/next-sync).
- Strikes on `mergeChunks`: highlights/notes still appear instantly from SQLite on every settle even while the cloud gate is closed.
- App foregrounding clears the map: expanding the toolbar after foreground pulls again (matches current Set-clear semantics).
- While the app is offline, gated pulls are skipped (fewer warnings), and local drawing/editing works exactly as before.
- `npx tsc --noEmit` passes from the repo root.

## SELF-REVIEW CHECKLIST

- Run `npx tsc --noEmit` (from C:\Users\wissa\Downloads\QuranMasterApp).
- Grep for dead references: `expandedDrawPullAttempted` (must be gone if removed: lines 65, 1137, 1143, 1369), `cloudPullLastAt`/`cloudPullDue`/`cloudPullStamp` (each used), `refreshCloudDrawings` call sites (1066 must pass `true`, 1105 must not).
- `git diff` audit: the diff must be limited to `src/screens/QuranViewScreen.tsx`; zero JSX/style/state changes; grep the diff for `setStudentData`, `style=`, `<View`, `<Text` — none may appear.
- Feature regression hand-check list: page turning, word highlight/notes on a cold settle, drawing + canvas open/close, toolbar expand draw, app foreground resume, surah-mode reading, split-view (splitOn) reading.
- Confirm the map key format is identical to the pre-existing stamp format (`${studentId}/${rangeKey|surahKey}` — lines 1102, 1136) so the gates are comparable across the three sites.

## RISKS & WARNINGS

- **TTL staleness (accepted):** a cross-device drawing can arrive up to TTL/next-full-sync later. Do NOT "fix" this by shortening the TTL so far that the 200-reads/session problem returns; the approved budget is ~5 min.
- **Watcher bypass cost:** push-only sync runs (30-min interval, AppState background — App.tsx 169–171, 173–178) also emit the syncing→synced transition, so the `force` bypass fires 1–2 GETs per such run on the visible range. This is accepted (it is exactly gate (a)); do not try to distinguish pull vs push runs from this screen (the result object never reaches it).
- **Map growth:** the module-level map persists for the app session; every distinct (student, range) visited adds one tiny entry. Bounded by usage; cleared on foreground per change 4. Do not clear it on every page change — that would defeat the throttle.
- **Do not stamp on skip:** stamps must be written exactly when the pull actually fires (pre-fire stamp is safer than post-fire for thundering-herd suppression; failures are swallowed by the pulls themselves today).
- **Clocks:** TTL uses `Date.now()` (local clock) — fine for a 5-minute budget; never use Firestore `serverTimestamp()` for this.
- **Keep `cancelled`/`syncRefreshHandle` interplay intact:** the watcher's `InteractionManager` deferral (1052) and cancel (1084) must stay; reordering it changes load behavior.