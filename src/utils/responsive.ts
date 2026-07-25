import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375;

export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * scale);
};

export const getMushafFontSize = (): number => {
  if (SCREEN_WIDTH < 360) return 12;
  if (SCREEN_WIDTH < 400) return 15;
  if (SCREEN_WIDTH < 500) return 18;
  if (SCREEN_WIDTH < 700) return 21;
  return 24;
};

export const getMushafLineHeight = (): number => getMushafFontSize() * 2.6;
