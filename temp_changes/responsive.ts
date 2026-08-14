/**
 * FILE: src/utils/responsive.ts (TEMP V51)
 * ROLE: Device-width-driven font sizing for the mushaf (page mode) and generic scaling.
 * DEPENDS ON: nothing (leaf module; window width tracked live via a Dimensions 'change' listener so
 *             tablet rotation re-buckets the mushaf sizes without a remount).
 * USED BY: MushafPageView.tsx (getMushafFontSize, getMushafLineHeight); FlowingText.tsx and VerseDisplay.tsx (scaleFont).
 */
import { Dimensions, PixelRatio } from 'react-native';

// Rotation-safe width: AndroidManifest handles orientation config changes in-app (no activity
// restart), so the module-load value would go stale after a tablet rotates — keep it in sync with
// Dimensions 'change' events instead.
let SCREEN_WIDTH = Dimensions.get('window').width;
const BASE_WIDTH = 375;

Dimensions.addEventListener('change', ({ window }) => {
  if (window && window.width && window.width !== SCREEN_WIDTH) SCREEN_WIDTH = window.width;
});

export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * scale);
};

export const getMushafFontSize = (headerVisible?: boolean): number => {
  const base = (() => {
    if (SCREEN_WIDTH < 360) return 18;
    if (SCREEN_WIDTH < 400) return 20;
    if (SCREEN_WIDTH < 500) return 22;
    if (SCREEN_WIDTH < 700) return 25;
    // Tablets / iPad sizes: drastically increased as requested,
    // leveraging the extra available space to make the text way bigger.
    if (SCREEN_WIDTH < 900) return 38;
    return 48; // For very large screens (was 32)
  })();
  if (headerVisible === false) return base + (SCREEN_WIDTH < 500 ? 1 : 3);
  return base;
};

export const getMushafLineHeight = (headerVisible?: boolean): number => {
  const mult = SCREEN_WIDTH >= 900 ? 1.7 : 1.6;
  return getMushafFontSize(headerVisible) * mult;
};
