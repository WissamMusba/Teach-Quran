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
  // NOTE: the layout cache persists NORMALIZED (font-size-independent) line-width sums shared by
  // both header states, and the vertical fit is folded into that normalization base (layoutVer
  // 4+), so the two states MAY render at different sizes — the replay math scales the sums to
  // the current size and the fit re-runs live whenever headerVisible (or box height) drifts
  // from the stored fit. Hence the hidden-header bump: with the header hidden the page box is
  // ~124px taller, so the text gets +2 for free with no spill risk (the live fit's
  // pitchScale/fontScale keep the line stack inside the box).
  return headerVisible ? base : base + 2;
};

export const getMushafLineHeight = (headerVisible?: boolean): number => {
  const mult = SCREEN_WIDTH >= 900 ? 1.7 : 1.6;
  return getMushafFontSize(headerVisible) * mult;
};
