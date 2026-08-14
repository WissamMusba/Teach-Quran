/**
 * FILE: src/utils/responsive.ts (TEMP V51)
 * ROLE: Device-width-driven font sizing for the mushaf (page mode) and generic scaling.
 * DEPENDS ON: nothing (leaf module; window width captured at module load).
 * USED BY: MushafPageView.tsx (getMushafFontSize, getMushafLineHeight); FlowingText.tsx and VerseDisplay.tsx (scaleFont).
 */
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375;

export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * scale);
};

export const getMushafFontSize = (headerVisible?: boolean): number => {
  const base = (() => {
    // Two sizes lower than the v62-era restore (18/20/22/25): the current frame +
    // paddings are bigger than v62's, so the full restore rendered too large and
    // clipped at the top with the header visible. Phones only — tablets stay 38/48.
    if (SCREEN_WIDTH < 360) return 16;
    if (SCREEN_WIDTH < 400) return 18;
    if (SCREEN_WIDTH < 500) return 20;
    if (SCREEN_WIDTH < 700) return 23;
    // Tablets / iPad sizes: drastically increased as requested, 
    // leveraging the extra available space to make the text way bigger.
    if (SCREEN_WIDTH < 900) return 38; 
    return 48; // For very large screens (was 32)
  })();
  // NOTE: headerVisible must NOT change the size here. The page layout cache persists ONE set
  // of measured line widths shared by both header states, and the cache-hit scale math assumes
  // they were measured at the current render size — a hidden-header size bump (+1/+3) made
  // hidden-header pages under-scale and spill past the padding into the frame. Both states
  // render at the same size now, so the fit is identical (and correct). Vertical room is NOT
  // handled here either: MushafPageView's pitchScale squeezes line pitch when the shorter
  // header-visible box demands it, while fontScale keeps the font full-size down to a pitch
  // floor — so this shared size stays the same in both header states by design.
  return base;
};

export const getMushafLineHeight = (headerVisible?: boolean): number => {
  const mult = SCREEN_WIDTH >= 900 ? 1.7 : 1.6;
  return getMushafFontSize(headerVisible) * mult;
};
