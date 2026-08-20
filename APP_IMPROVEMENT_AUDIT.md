# APP_IMPROVEMENT_AUDIT — What's Next for Teach Quran

Ranked improvement list from the v89 audit (post R8 + indopak asset work).
Ordered by impact-per-effort. Nothing here has been implemented yet — this is the menu.

---

## A. Size & distribution — biggest remaining wins, zero app-logic risk

### A1. Drop the x86 ABI from native libs
- `android/gradle.properties:34` claims "32-bit x86 was dropped" but the APK still
  contains **4 ABIs** (~49 MB of native libs uncompressed, ~12 MB per ABI).
- Only emulators use x86; no real phone does.
- Fix: `reactNativeArchitectures=armeabi-v7a,arm64-v8a` (line 37).
- **Expected: APK 26.4 MB → ~20 MB. Zero user impact.**

### A2. Ship AABs to Play Store; keep ABI-trimmed APKs for direct distribution
- AAB builds already exist (`TeachQuran-v*.aab`). Play delivers ONE ABI per device →
  users download ~12-14 MB instead of 26.
- For direct APK distribution (WhatsApp/site): v7a + arm64 matters because
  `armeabi-v7a` is exactly the old/low-end phones this app targets.

### A3. Repo bloat — 95 APK/AAB files = ~3.1 GB at repo root
- Plus `temp_changes/`, `temp_icon/`, `.freebuff/` (1,639 files total).
- Slows every clone/checkout; release pushes are multi-GB.
- Recommendation: keep APKs out of git (the AGENTS.md `git add -f *.apk` habit is the
  cause) — or keep only the last N in `releases/`, prune the rest.
- Doesn't speed up the app, speeds up everything else (and protects disk space).

---

## B. JS-thread smoothness

### B1. AnimatedHeader runs JS-driven animations
- `src/components/common/AnimatedHeader.tsx:129-130` — both `Animated.timing` calls use
  `useNativeDriver: false` (height interpolation forces JS driver; ~8 layout frames of
  JS-thread work per show/hide).
- Restructure to `transform: translateY` (native driver) → header stays perfectly
  responsive even mid-page-load. Directly attacks the historical "dead header" feel.
- **Medium change, medium impact. Needs careful QA with the page FlatList row heights.**

### B2. LoopSettingsScreen FlatList batch size
- `src/screens/LoopSettingsScreen.tsx:46-47` — `initialNumToRender=30`,
  `maxToRenderPerBatch=30`. Fine IF the list is exactly 30 fixed rows; if it can grow,
  drop to 10/20.

---

## C. Dead code cleanup — small, safe

### C1. Unreachable mushaf styles (unreachable after the v90 font cleanup)
- `isIndopakStyle` lists `'harmattan'` — `quranData.ts:115`, `QuranViewScreen.tsx:322`.
  Harmattan's font was deleted; the setting can't be selected.
- `ARABIC_FONTS` still maps `harmattan`/`amiri`/`scheherazade` — `src/utils/theme.ts:23-25`;
  `getFontAdj` still has the `scheherazade` case — `MushafPageView.tsx:96`.
- `getArabicFont`'s silent fallback points at the deleted-but-still-present Uthmani font
  (`theme.ts:30`) — repoint to `ARABIC_FONTS.alqalam` (the real default).

### C2. Misc dead weight
- `COLORS` in `theme.ts:33` — documented "no src/ consumer; candidate for consolidation".
- `verseByKey` map in `MushafPageView.tsx:412-419` — commented "DEAD CODE" in-file.
- `src/assets/data/indopak_verse_pages.json` (83 KB) — candidate for the same shipped
  SQLite-asset treatment as `indopak_pages.db` (later, optional).

---

## D. Big structural upgrades — only if unsatisfied after A-C

### D1. React Native 0.72 → recent + New Architecture (Fabric/TurboModules)
- Largest smoothness-ceiling raise available (native-driven rendering, less bridge
  marshalling, Hermes improvements).
- Cost: months of migration + whole library-compat test matrix.
- Touch nothing until the A/B/C wins are measured on a real low-end device.

### D2. SQLite layer swap: react-native-sqlite-storage → op-sqlite (JSI)
- Measurably faster per-query on low-end devices (no bridge marshalling).
- Touches every data path — highest-risk change on this list. Only do after D1 era.

---

## Recommended next batch

| # | Item | Risk | Effort |
|---|------|------|--------|
| A1 | Drop x86 ABI | none | 1 line |
| A3 | Stop committing APKs to git | none | AGENTS.md policy change |
| B1 | Native-driver header | medium | medium (needs QA) |
| C1 | Unreachable mushaf styles | none | ~15 min |
| C2 | Misc dead weight | none | ~15 min |

Decision needed for A2: Play Store (AAB), direct APK, or both.

---

## Already done (v89) — do not redo

- R8 minification ON (APK 30.95 → 26.37 MB) — `android/app/build.gradle` [PERF-CHANGE-2].
- 4.5 MB `indopak_pages.json` → shipped read-only SQLite asset (`assets/www/indopak_pages.db`)
  — JS bundle 5.48 → 2.28 MB — [PERF-CHANGE-1].
- Redux dev-checks (serializable/immutable) disabled in release — [PERF-CHANGE-3].
- Ad SDK init deferred off the critical path — [PERF-CHANGE-4].
- PersistGate blank-screen replaced with static splash — [PERF-CHANGE-5].
- DB init batched into one transaction — [PERF-CHANGE-6].
- 5 unreachable TTF fonts deleted (Me_Quran, NotoNaskh, Harmattan, Amiri, Scheherazade) —
  −2.0 MB — v90.
- Startup prefetch plan drafted — see `PAGE_LOAD_PREFETCH_PLAN.md` (Tier 1 + 3-A pending).
