/**
 * FILE: src/utils/constants.ts
 * ROLE: Shared constants + the word-cleaning util used by every text renderer.
 * DEPENDS ON: nothing (leaf module).
 * USED BY: VerseDisplay.tsx (FONT_SIZES, WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT, cleanQuranWord); FlowingText.tsx (same set); MushafPageView.tsx (WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT); QuranViewScreen.tsx (MISTAKE_COLOR).
 */

// DEAD EXPORT: five color options {red/blue/green/yellow/black} for the drawing tool — no importer in src/ (drawing colors are handled elsewhere/hardcoded). Check before rebuilding.
export const DRAWING_COLORS = [
  { id: 'red', name: 'Red', hex: '#FF0000' },
  { id: 'blue', name: 'Blue', hex: '#0066FF' },
  { id: 'green', name: 'Green', hex: '#00CC00' },
  { id: 'yellow', name: 'Yellow', hex: '#FFD700' },
  { id: 'black', name: 'Black', hex: '#000000' }
];
// WHAT: Named sizes for FLOWING mode (ayah/continuous): small 22 / medium 26 / large 30 / xl 36.
// CALLED BY: VerseDisplay.tsx and FlowingText.tsx -> scaleFont(FONT_SIZES[fontSize]).
// NOTES: Mushaf page mode does NOT use this — it uses getMushafFontSize buckets (responsive.ts).
export const FONT_SIZES = { small: 22, medium: 26, large: 30, xl: 36 };
// WHAT: 0.5 — center-half band for word taps; passed as `tapFraction` to WordHitArea (MushafPageView, FlowingText, VerseDisplay).
// AFFECTS: Tap precision — 50% of the word's width must be hit for a word-press.
// NOTES: matches WordHitArea's own default (0.5) — the explicit prop and the default agree.
export const WORD_TAP_FRACTION = 0.5;
// DEAD EXPORT: 5 * 60 * 1000 (5 min) intended auto-sync cadence — no importer found in src/ (App.tsx's periodic refresh does not use it).
export const SYNC_INTERVAL = 5 * 60 * 1000;
// WHAT: Canonical red for word mistakes/highlights.
// CALLED BY: QuranViewScreen.tsx -> new highlight color in handleWordFlow (stored in studentData.highlights).
export const MISTAKE_COLOR = '#FF3B30';
// WHAT: Style object — 3px red underline + 66%-alpha red wash ({ borderBottomWidth: 3, borderBottomColor: '#FF3B30', backgroundColor: '#FF3B30AA' }).
// CALLED BY: VerseDisplay.tsx, FlowingText.tsx, MushafPageView.tsx -> spread onto the word Text when a highlight entry for wordIndex exists.
// AFFECTS: Visual marking of mistake-tagged words in all three renderers.
// NOTES: renderers always use this fixed style (they ignore per-highlight color fields), which is
//        consistent because handleWordFlow always stores color = MISTAKE_COLOR.
export const MISTAKE_HIGHLIGHT: { borderBottomWidth: number; borderBottomColor: string; backgroundColor: string } = {
  borderBottomWidth: 3,
  borderBottomColor: MISTAKE_COLOR,
  backgroundColor: `${MISTAKE_COLOR}AA`,
};
// Per-session memo cache for cleanQuranWord; capped at 2000 entries — on overflow the OLDEST inserted key (first-in-first-out) is evicted.
const cleanWordCache = new Map<string, string>();
const CLEAN_WORD_CACHE_MAX = 2000;
// WHAT: Strips Quranic annotation characters U+06DD/U+06DE (end-of-ayah signs) and U+FD3E/U+FD3F (rub-el-hizb ornaments) so the word matches display text; memoized in a capped Map.
// CALLED BY: VerseDisplay.tsx and FlowingText.tsx: displayText.trim().split(' ').map(cleanQuranWord) — every word of every verse.
// AFFECTS: Which string is rendered/tapped; keeps the PUA-stripped word in sync with what the DB stores.
// NOTES: Cache is per-session only; eviction drops the first inserted key — fine for a pure function.
export const cleanQuranWord = (w: string) => {
  const cached = cleanWordCache.get(w);
  if (cached !== undefined) return cached;
  const result = (w || '').replace(/[\u06DD\u06DE\uFD3E\uFD3F]/gu, '');
  if (cleanWordCache.size >= CLEAN_WORD_CACHE_MAX) cleanWordCache.delete(cleanWordCache.keys().next().value);
  cleanWordCache.set(w, result);
  return result;
};
