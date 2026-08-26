# Interactive Tutorial Plan — "Teach the Teacher" Walkthru (PLAN ONLY — NOT BUILT YET)

> **Feasibility: YES.** Confirmed against this codebase: every hands-on step can hook into
> an existing, single-funnel code path (`handleWordFlow`, DrawingCanvas `onSave`, the share
> menu, VoiceNoteRecorder) with a one-line event emit guarded by `if (tutorialActive)` —
> zero impact when the tutorial is off. The pointing hand + pulse needs only the built-in
> `Animated` API + react-native-svg (already installed). **No new libraries.**

---

## Locked decisions (from your answers)

| Decision | Choice |
|---|---|
| Trigger | Auto-plays once right after login/registration + **"Replay Tutorial" button in Settings** |
| Entry | Dashboard (right after login), flows Dashboard → StudentHub → Reader |
| Language | English only |
| Depth | Full walkthru (~18 steps, modular) |
| Hands-on steps | Highlight a word · Draw on the page · Tap Share (REAL share flow) · Record voice note |
| Menu step | User presses the **verse badge** (not long-press) to open the menu; text mentions long-press also works |
| Hand | Custom drawn SVG hand + soft pulse + glowing ring on the target |
| Concept teaching | Side-by-side comparison cards, using YOUR exact semantics (below) |
| Practice edits | **Cleaned up** when the tutorial ends (practice highlight + drawing removed) |
| Ending | Quiet: "You're all set — free to use the app…" (no confetti) |
| Modularity | **Every step is one object in an array — delete any step's entry and the tutorial skips it cleanly** |

### Your semantics, verbatim in the tutorial script
- **Resume** = the last page that was OPEN (e.g. page 147) — "take me back to where we left off viewing", even if the app was closed.
- **Daily Recitation** = the 📍 **reading mark** set by the ribbon bookmark at the top of the page — where the student is UP TO. **Setting a new reading mark removes the old one** (only one exists). This is the daily-progress tracker.
- **📖 Normal bookmark** = saving a verse to revisit later — you can have many.

---

## Architecture (all new code lives in `src/tutorial/` — self-contained)

```
src/tutorial/
  tutorialSteps.ts     ← the step script: one array, one object per step (delete a line = delete a step)
  TutorialOverlay.tsx  ← dim layer + spotlight "hole" + tooltip card + Skip/Next + step dots
  TutorialHand.tsx     ← drawn SVG hand + pulsing ring, loops until the step advances
  tutorialController.ts← step engine: current step, navigation between screens, event wait,
                         practice-edit rollback, done-flag persistence
```

**How steps advance**
- `info` steps → "Next" button.
- `spotlight` steps → hand points at a measured element; "Next" (or tap target).
- `action` steps → overlay waits for ONE named event before advancing:
  `highlight_made` · `menu_opened` · `stroke_saved` · `voice_saved` (or its Skip) · `share_opened` · `student_created`.

**Event hooks (one guarded line each, in existing code)**
| Event | Hook location |
|---|---|
| highlight_made | `QuranViewScreen.handleWordFlow` (after `setCanvasData`) |
| menu_opened | `handleVerseLongPress` (fires from badge tap AND long-press — tutorial asks for badge) |
| stroke_saved | `DrawingCanvas` `onSave` prop call in QuranViewScreen |
| voice_saved | `handleVoiceNoteSaved` |
| share_opened | `runShare` (after the share menu's Share button) |
| student_created | `DashboardScreen.handleCreate` success |

**Practice-edit rollback (your "clean up after" choice)**
- Before the highlight step: record whether the practice verse already had a highlight.
- Before the draw step: snapshot the current drawing paths array length.
- On tutorial end (or Skip): restore both — remove the practice highlight entry, truncate strokes added during the tutorial, push one save through the normal funnel. Runs once, guarded, best-effort.

**First-run + replay**
- `settings` slice gains `tutorialDone: boolean` (redux-persisted — already whitelisted).
- After login/registration success: if `!tutorialDone` → start. Set `tutorialDone = true` on finish OR skip.
- Settings gains a **"Replay Tutorial"** row → clears the flag and starts (same flow; the create-student gate is skipped if a student already exists).

---

## The step script (order + exact teaching intent)

| # | Screen | Type | Content |
|---|---|---|---|
| 1 | Dashboard | info | Welcome — "Each card here is one student. Everything your student does — highlights, notes, drawings — is saved to THIS student." |
| 2 | Dashboard | action | **Create your first student** — hand points at the + FAB; waits for `student_created`. (Skipped automatically if a student already exists, e.g. on replay.) |
| 3 | Dashboard | spotlight | Card anatomy — name, and the "Reading:" line = their **Daily Recitation** position at a glance. |
| 4 | Dashboard | info | "Tap a card to open the student's hub." → advances on tap. |
| 5 | StudentHub | **comparison card** | **Resume vs Daily Recitation** — "RESUME takes you back to the last page that was OPEN (say page 147) — even after closing the app. DAILY RECITATION is the 📍 mark you set with the ribbon bookmark at the top of the page — where the student is UP TO. A new reading mark REPLACES the old one — one mark per student." |
| 6 | StudentHub | spotlight→tap | "Tap Continue to open the mushaf." |
| 7 | Reader | info | Page basics — swipe or tap the page edges to turn pages; Hide Header gives full-screen. |
| 8 | Reader | **action** | **Highlight a word** — hand + glow on a specific word: "Press this word to mark it as a mistake (red underline)." waits `highlight_made`. |
| 9 | Reader | **action** | **Open the verse menu** — "Tap the number circle at the end of the verse (long-press on words does the same)." waits `menu_opened`; then spotlight the menu: Play ▸ Bookmark ▸ Note ▸ Record ▸ Copy, one line each; user closes it. |
| 10 | Reader | info | Notes — "Notes live on the verse AND in the Notes screen, so you can review all of them later." |
| 11 | Reader | **action** | **Draw** — tutorial opens drawing mode with the pen ready: "Draw a line under any word." waits `stroke_saved`; then auto-exits draw mode. |
| 12 | Reader | **action** | **Voice note** — badge menu → Record: "Record a short recitation — or press Skip." waits `voice_saved` or Skip. |
| 13 | Reader | **comparison card** | **📖 Bookmark vs 📍 Reading mark** — "📖 Bookmark saves a verse to revisit — as many as you like (verse menu). 📍 Reading mark = Daily Recitation — set from the ribbon at the top of the page; the new one always replaces the old." |
| 14 | Reader | **action** | **Share** — hand to the header Share button: real menu opens (explain Include drawings / Include mistakes — bookmarks always included); user taps Share → OS sheet (cancelling is fine). waits `share_opened`. |
| 15 | Reader | spotlight | Mistakes screen — "Every red-marked word collects here per student — perfect for revision." |
| 16 | Reader→Settings | spotlight | Notes screen (all notes in one list) + Night mode toggle for night-time reading. |
| 17 | Reader | spotlight | Juz / Surah index — jump to any juz or surah instantly. |
| 18 | Reader | info (quiet end) | "You're all set — free to use the app! You can replay this anytime from Settings → Replay Tutorial." → cleanup runs (practice highlight + drawing removed) → done flag set. |

**Removing a step later** = delete its object from `tutorialSteps.ts` (steps chain by order, not by id — nothing else to touch). Action steps are self-contained the same way.

---

## Files touched outside `src/tutorial/` (all additive, all guarded)

| File | Change |
|---|---|
| `src/store/settingsSlice.ts` | + `tutorialDone` flag + `replayTutorial` action |
| `src/screens/LoginScreen.tsx` / `RegisterScreen.tsx` | + start-if-pending after success |
| `src/screens/SettingsScreen.tsx` | + "Replay Tutorial" row |
| `src/screens/QuranViewScreen.tsx` | + ~5 one-line `tutorialEvent(...)` emits + overlay mount + practice-snapshot capture |
| `src/screens/DashboardScreen.tsx` | + `student_created` emit + overlay mount |
| `src/screens/StudentHubScreen.tsx` | + overlay mount |
| `src/App.tsx` | + TutorialController mount (owns navigation between tutorial screens) |

**Not touched:** sync engine, audio engine, drawing engine internals, layout/prefetch pipeline, mushaf rendering, ads, auth logic.

---

## Risks & mitigations

1. **Overlay vs gesture conflicts** (reader swipes/draw): the overlay swallows all touches except the spotlight target during action steps; draw step temporarily disables the overlay's blocker over the canvas region only.
2. **Target moves** (page turns mid-step): spotlight positions re-measure on scroll end; the highlight step pins the page (navigation locked while that step is active).
3. **God-component creep**: QuranViewScreen only receives ~5 one-line emits + one `<TutorialOverlay>` mount — all logic lives in `src/tutorial/`.
4. **Rollback safety**: snapshot → restore is idempotent and runs through the same debounced save funnel as normal edits; if the user force-quits mid-tutorial, the flag isn't set and the tutorial replays from the start next login (practice edits from the aborted run stay — acceptable, they're on a real student).

## Build & verify plan
1. `src/tutorial/` module + slice flag + Settings row.
2. Wire emits + mounts; typecheck clean.
3. Manual run-through: fresh account (full path incl. student-creation gate) + replay path + skip-mid-tutorial path + step-removal smoke test (delete one step object, confirm clean skip).
4. Ship in the next release with the rest of that release's changes.
