# UI Changes Plan — v96 candidates (DECISIONS LOCKED, AWAITING GO)

> **Status:** Question round done. Answers recorded below. Four items where no answer
> came back are marked **[DEFAULT]** — implemented as described unless you veto before
> saying "go". Nothing has been coded yet.

---

## 1) Word-tap hitbox wider (width only) — ✅ YOUR CHOICE: Center 80%

**Where:** `src/utils/constants.ts:22` → `WORD_TAP_FRACTION = 0.5` → **`0.8`**

Width-only (height math untouched). Applies to page / continuous / ayah alike via `WordHitArea`. No visual layout change. Trade-off accepted: taps near a word's outer edge will highlight rather than toggle the header.

---

## 2) Split view seam — ✅ YOUR CHOICE: 8px between pages

**Where:** `SpreadItem` margins (`QuranViewScreen.tsx:146/:160`) + matching `GUTTER`/`pageWFor` math in `src/utils/mushafLayout.ts`.

Inner gap 36px → **8px**. The drawing center-split math (`halfOrigin`, `QuranViewScreen.tsx:1763`) must be updated in the same commit so strokes crossing the middle stay aligned. Implemented together with items 4a and 11.

---

## 3) Split view frame stretched — **[DEFAULT] Match phone proportions**

Direction (visual tuning inside `OrnamentalFrame.tsx` only):
- Band widths derived from a blended/clamped reference dimension instead of raw width, so narrow tablet halves get phone-like band proportions (`frameBandFor/frameBandVFor`, :60/:71).
- Clamp corner vertical stretch `vScale` (:159) to a small ceiling.
- Text insets stay automatically in sync (same band functions feed `frameInsetFor/VFor`).
- Exact numbers tuned visually; you see before/after screenshots before we ship.

---

## 4a) Tablet outer side gaps +15px — ✅ as requested

Outer margin on tablets `18 → 33px` (phones untouched). Same SpreadItem lines as item 2.

## 4b) Tablet bookmark ribbon bigger — as requested

`MushafPageView.tsx:643/:923`: icon 20 → **26px** and hitSlop 6 → 10 when NOT compact (tablet). Phones unchanged.

---

## 5) Long-press / badge menu — ✅ your spec + one **[DEFAULT]**

- Remove the **Reading** button (menu = Play / Bookmark / Note / Record / Copy).
- Single row of 5 buttons: `flexWrap:'nowrap'`, width `5×btn+padding`, recalculated button width `min(66,(screenW-28)/5)`, reduced padding/gap; positioning constants (`MENU_BUBBLE_W/H`) updated so it never clips off-screen.
- **[DEFAULT]** Reading-mark setting moves to **verse-badge tap** in continuous/ayah modes (tap badge = set/clear mark there), so removing the menu button loses nothing. Page mode keeps its top-of-page ribbon. *Veto if unwanted.*
- Both menu entry points (long-press AND badge-tap menu) share the bubble — both change together. Note: if badge tap becomes "set reading mark", the badge MENU still opens via long-press; interaction detail confirmed at implementation.

---

## 6) Continuous & ayah modes only — fonts −2 ✅, badge **[DEFAULT] 26px**

- `FONT_SIZES {22,26,30,36}` → `{20,24,28,34}` (`constants.ts:19`; consumed only by VerseDisplay/FlowingText — page mode independent, untouched).
- verseBadge 22×22/r11/text10 → **26×26/r13/text11** in `VerseDisplay.tsx:95` + `FlowingText.tsx:111`. Page mode untouched.

---

## 7) A'udhu on EVERY surah start — ✅ bug fix

Root cause: `taawudLineIdx` (`MushafPageView.tsx:426-432`) uses `findIndex` → first match only. Fix: render the A'udhu strip before every `'surah-header' | 'basmala'` line (headerless-page fallback preserved). Non-interactive, own content height, same styling.

---

## 8) Phones locked portrait — ✅ as requested

`MainActivity.java onCreate()`: `smallestScreenWidthDp < 600` → `setRequestedOrientation(PORTRAIT)`. Tablets (≥600) keep free rotation for split view. No new dependency.

---

## 9) Share — bookmarks always included ✅

Delete `shareBookmarks` state + its switch row; `captureBookmarks` (`:1774`) always `studentData?.bookmarks`. Drawings/mistakes switches unchanged.

---

## 10) Pen frozen ~5s after opening toolbar — ✅ diagnosed, header behavior LOCKED

**Your clarifications:** header auto-hide on opening the tool STAYS; pills must stay visible (verified: pills are gated by share-capture only — they already survive drawing mode; nothing to change there). Symptom: whole toolbar unresponsive ~5s, PEN highlight not lighting on first press.

**Diagnosis:** entering draw mode flips header visibility AND mounts DrawingCanvas in one commit — the page's fit/measurement pipeline runs heavy JS work right then, blocking touches (the ~5s freeze matches a measure/fit pass on a dense page, worse first time per session). 

**Fix plan:** (a) defer the header hide until the canvas reports ready (or split it a beat after mount), and (b) arm toolbar/canvas interactions only after the fit settles — measured with timing logs during implementation so the freeze is gone, not guessed away. Header still ends up hidden exactly as you like, just without the freeze.

---

## 11) Share image shifts drawings — ✅ root cause confirmed ("only in shared image")

Capture hides header/pills/ribbons (`:1726`, `hideBottomChrome={isCapturing}`, `!isCapturing` gates) → box height changes → vertical fit re-runs → text shifts under strokes painted at old coordinates (variable shift per page — matches your "full verse / middle" observation).

**Fix:** capture without mutating layout — keep header/chrome state frozen while capturing (the captured region already excludes header UI via `viewShotRef`). If chrome hiding is still wanted cosmetically, freeze fit during `isCapturing` instead. Drawings land pixel-exact.

**Tab↔phone guarantee:** stroke storage is content-box normalized (`compactStroke/denormalizeStroke`, `utils/stroke.ts`); items 2/4 margin changes will be verified to preserve same-word placement across devices, tested explicitly before shipping. **[DEFAULT: you weren't sure whether drift exists today — testing will tell; if drift predates these changes, normalization fix gets added to scope after showing you evidence.]**

---

## 12) NEW — Laser pointer upgrade (your request)

Current: circle vanishes on finger-lift (`DrawingCanvas`). New behavior:

1. **Persistence:** while LASER mode is active, the dot stays at the last point after you lift your finger. It disappears when you switch to pen/eraser/line (never visible in other modes).
2. **Default (flag if wrong):** dot also clears on page/surah change so it never floats over unrelated content.
3. **Style:** more laser-like — slightly transparent core, a soft glow halo, and an irregular hand-drawn edge (small zigzag/wobble around the rim, varying place to place, subtle — "some places more, some less, not that noticeable"). Rendered in the same SVG overlay; zero persistence to storage/sync like today's laser.

---

## Implementation order (when you say GO)

1. Items 7, 1, 6, 9 (isolated, low-risk)
2. Item 5 (+badge-tap reading marks)
3. Item 8 (native manifest/activity edit)
4. Items 2 + 4 + 11 together (shared margin/drawing math) + tab↔phone verification
5. Item 3 (frame tuning, screenshots for approval)
6. Items 10 + 12 together (drawing-mode timing + laser)

Verification each step: `npx tsc --noEmit` clean + device checklist; regression pass on highlighting, header toggle, drawing save/share in single AND split mode.

## Not touched

Everything else — reader/prefetch/layout cache, sync engine, audio, ads, auth, DB schema, night mode, settings, navigation, page-mode fonts/scaling.
