# temp_changes — apply AFTER the APK build finishes

These are the only 3 files that changed. Copy them over the real files:
- `temp_changes/src/components/common/AnimatedHeader.tsx`       → `src/components/common/AnimatedHeader.tsx`
- `temp_changes/src/components/drawing/AnnotationToolbar.tsx`   → `src/components/drawing/AnnotationToolbar.tsx`
- `temp_changes/src/screens/QuranViewScreen.tsx`                → `src/screens/QuranViewScreen.tsx`

Full-tree typecheck (same flags as usual) passes with these applied.

## 1. Header (`AnimatedHeader.tsx`)
- Removed the dark pill button bar — back to the original single-row format: [back arrow] [Surah name + "Surah X ☰"] [icon buttons].
- Original colors restored: bg `#f5f5f5`/`#1a1a2e`, title `#1a1a1a`/`#fff`, sub `#777`/`#8a8a8a`, border `#2a2a2a`, back arrow `#00D4AA`.
- Icons now have small labels (MISTAKES / SHARE / NOTES / SETTINGS) and bigger touch targets (38px + hitSlop); padding tweaked.
- Each icon has its own color: MISTAKES `#FF3B30`, SHARE `#00D4AA`, NOTES `#FF9F0A`, SETTINGS `#8A8A8A`.
- "X left in Juz" restored in the info line: `Juz 1 · Page 7 · 10 left in Juz`.
- Animation: hybrid — native-driver slide (translateY + opacity, 150ms open / 110ms close, ease-out) + JS-driven slot height on the same timeline, so the text below the header now moves in sync with the header instead of snapping a beat later.
- Exports `BookmarkIcon` (gold bookmark) for the floating button.

## 2. Floating bookmark (`QuranViewScreen.tsx`)
- Small gold bookmark button, always visible at top-right (`top: 8, right: 12`, 38px circle, `zIndex/elevation: 999`), whether the header is shown or hidden. Taps navigate to Bookmarks.
- The header row reserves 44px on the right so it doesn't overlap.
- `onBookmarks` prop removed from the header (button lives in the screen now).

## 3. Drawing toolbar (`AnnotationToolbar.tsx`)
- Color palette shrunk: 150px wide, 112px tall (was 180px), swatches 32x26, pen-size row tightened.
- Palette anchors to the color button (centered on it) but is clamped so it always stays fully on screen.
- Palette still only closes when a tool is picked (drawing starts) or the toolbar collapses; picking a color keeps it open.
- Grip icon when open is now a rounded rectangle with a chevron (drawer handle).
- When docked to an edge, the grip shows a directional arrow: docked left → arrow right, right → arrow left, top → arrow down, bottom → arrow up. Floating (not docked) still shows the pencil.
