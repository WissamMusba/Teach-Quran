/**
 * FILE: src/utils/responsive.ts
 * ROLE: Device-width-driven font sizing for the mushaf (page mode) and generic scaling.
 * DEPENDS ON: nothing (leaf module; window width captured at module load).
 * USED BY: MushafPageView.tsx (getMushafFontSize, getMushafLineHeight); FlowingText.tsx and VerseDisplay.tsx (scaleFont).
 */
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375;

// WHAT: round(size * SCREEN_WIDTH / 375) — linear scale from the 375pt design width.
// CALLED BY: FlowingText.tsx and VerseDisplay.tsx: scaleFont(FONT_SIZES[fontSize]) -> flowing-mode word size.
// AFFECTS: Flowing (ayah/continuous) text size.
// NOTES: No clamp — a huge tablet inflates sizes proportionally (unlike theme.ts's capped variant).
export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * scale);
};

// WHAT: Device-width BUCKETS for the page-mode mushaf font: <360 -> 18, <400 -> 20, <500 -> 22, <700 -> 25, <900 -> 28, else 32.
//       If headerVisible === false, +1 pt on small screens (<500) else +3 pt — the text grows when the header collapses to fill the freed space.
// CALLED BY: MushafPageView.tsx (base for every word size; further adjusted by font adj + line scale + SPARSE boost).
// AFFECTS: Whole mushaf page layout — font size cascades into line wrapping, which feeds the WordHitArea onMeasured fit loop and the layout cache.
// NOTES: Buckets keyed on window width at module load — NOT reactive to rotation (QuranViewScreen uses useWindowDimensions separately for split mode).
export const getMushafFontSize = (headerVisible?: boolean): number => {
  const base = (() => {
    if (SCREEN_WIDTH < 360) return 18;
    if (SCREEN_WIDTH < 400) return 20;
    if (SCREEN_WIDTH < 500) return 22;
    if (SCREEN_WIDTH < 700) return 25;
    if (SCREEN_WIDTH < 900) return 28;
    return 32;
  })();
  if (headerVisible === false) return base + (SCREEN_WIDTH < 500 ? 1 : 3);
  return base;
};

// WHAT: getMushafFontSize(headerVisible) * (width >= 900 ? 1.7 : 1.6) — loose line height for the Arabic script.
// CALLED BY: MushafPageView.tsx.
// AFFECTS: Mushaf line spacing (also multiplied by SPARSE_FONT_BOOST in sparse pages).
export const getMushafLineHeight = (headerVisible?: boolean): number => {
  const mult = SCREEN_WIDTH >= 900 ? 1.7 : 1.6;
  return getMushafFontSize(headerVisible) * mult;
};
