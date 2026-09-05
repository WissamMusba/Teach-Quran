/**
 * FILE: src/utils/responsive.ts (TEMP V51)
 * ROLE: Device-width-driven font sizing for the mushaf (page mode) and generic scaling.
 * DEPENDS ON: nothing (leaf module; window width captured at module load).
 * USED BY: MushafPageView.tsx (getMushafFontSize, getMushafLineHeight); FlowingText.tsx and VerseDisplay.tsx (scaleFont).
 */
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375;

export const scaleFont = (size: number, targetWidth?: number): number => {
  const w = targetWidth != null && targetWidth > 0 ? targetWidth : Dimensions.get('window').width;
  const scale = w / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * scale);
};

export const getMushafFontSize = (headerVisible?: boolean, targetWidth?: number): number => {
  const w = targetWidth != null && targetWidth > 0 ? targetWidth : Dimensions.get('window').width;
  const base = (() => {
    if (w < 360) return 16;
    if (w < 400) return 18;
    if (w < 500) return 20;
    if (w < 700) return 23;
    if (w < 900) return 34;
    return 44;
  })();
  return headerVisible ? base : base + 2;
};

export const getMushafLineHeight = (headerVisible?: boolean, targetWidth?: number): number => {
  const w = targetWidth != null && targetWidth > 0 ? targetWidth : Dimensions.get('window').width;
  const mult = w >= 900 ? 1.7 : 1.6;
  return getMushafFontSize(headerVisible, targetWidth) * mult;
};
