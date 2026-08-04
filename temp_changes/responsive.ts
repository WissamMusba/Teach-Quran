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
