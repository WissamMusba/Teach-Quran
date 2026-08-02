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
    if (SCREEN_WIDTH < 900) return 28;
    return 32;
  })();
  if (headerVisible === false) return base + (SCREEN_WIDTH < 500 ? 1 : 3);
  return base;
};

export const getMushafLineHeight = (headerVisible?: boolean): number => {
  const mult = SCREEN_WIDTH >= 900 ? 1.7 : 1.6;
  return getMushafFontSize(headerVisible) * mult;
};
