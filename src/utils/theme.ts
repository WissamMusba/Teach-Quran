import { Dimensions, PixelRatio, Platform, StatusBar } from 'react-native';
const { width: W, height: H } = Dimensions.get('window');
const wScale = W / 375, hScale = H / 812;
export const scaleW = (n: number) => PixelRatio.roundToNearestPixel(n * Math.min(wScale, 1.5));
export const scaleH = (n: number) => PixelRatio.roundToNearestPixel(n * Math.min(hScale, 1.5));
export const scaleFont = (n: number) => PixelRatio.roundToNearestPixel(Math.max(12, Math.min(n * wScale, n * 1.6)));
export const moderateScale = (n: number, f = 0.5) => PixelRatio.roundToNearestPixel(n + (scaleW(n) - n) * f);
export const isSmallPhone = W < 360;
export const isTablet = W >= 768;
export const isLargePhone = W >= 414 && W < 768;
export const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? (isTablet ? 24 : 44) : StatusBar.currentHeight || 0;
export const BOTTOM_BAR_HEIGHT = scaleH(60);
export const COLORS = {
  primary: '#00d4aa', primaryDark: '#00a885', primaryLight: '#33e0be',
  bgDark: '#0d0d0d', bgCard: '#1a1a2e', bgCardLight: '#222240', bgSurface: '#16213e',
  bgInput: '#121212', bgWhite: '#FFFFFF', bgLightCard: '#f5f5f5',
  textPrimary: '#FFFFFF', textSecondary: '#b0b0b0', textMuted: '#666666',
  textDark: '#1a1a1a', textDarkSecondary: '#555555',
  accent: '#0066FF', accentLight: '#3385ff', gold: '#ffd700',
  red: '#FF4444', green: '#00CC66', blue: '#4a90d9',
  borderDark: '#2a2a2a', borderLight: '#e0e0e0',
  overlay: 'rgba(0,0,0,0.6)', overlayLight: 'rgba(0,0,0,0.3)',
};
export const ARABIC_FONTS = {
  uthmani: Platform.OS === 'ios' ? 'KFGQPC Uthmanic Script HAFS' : 'KFGQPCUthmanicScriptHAFS',
  indopak: Platform.OS === 'ios' ? 'PDMS Saleem Quran Font' : 'PDMSSaleemQuranFont',
  naskh: Platform.OS === 'ios' ? 'Noto Naskh Arabic' : 'NotoNaskhArabic',
};
export const getArabicFont = (style: string) =>
  style === 'indopak' ? ARABIC_FONTS.indopak : style === 'naskh' ? ARABIC_FONTS.naskh : ARABIC_FONTS.uthmani;
export const SPACING = { xs: scaleW(4), sm: scaleW(8), md: scaleW(12), lg: scaleW(16), xl: scaleW(20), xxl: scaleW(24), xxxl: scaleW(32) };
export const RADIUS = { sm: scaleW(6), md: scaleW(10), lg: scaleW(14), xl: scaleW(20), full: scaleW(999) };
export const SHADOWS = {
  sm: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3 }, android: { elevation: 2 } }),
  md: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 }, android: { elevation: 5 } }),
  lg: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 }, android: { elevation: 10 } }),
};
export const FONT_SIZES = { small: 18, medium: 24, large: 30, xl: 36 };
export const DRAWING_COLORS = [
  { id: 'red', name: 'Red', hex: '#FF0000' }, { id: 'blue', name: 'Blue', hex: '#0066FF' },
  { id: 'green', name: 'Green', hex: '#00CC00' }, { id: 'yellow', name: 'Yellow', hex: '#FFD700' },
  { id: 'black', name: 'Black', hex: '#000000' },
];
export const SYNC_INTERVAL = 30 * 60 * 1000;
export const JUZ_MAP = [
  {j:1,s:1,v:1},{j:2,s:2,v:142},{j:3,s:2,v:253},{j:4,s:3,v:93},{j:5,s:4,v:24},
  {j:6,s:4,v:148},{j:7,s:5,v:82},{j:8,s:6,v:111},{j:9,s:7,v:88},{j:10,s:8,v:41},
  {j:11,s:9,v:93},{j:12,s:11,v:6},{j:13,s:12,v:53},{j:14,s:15,v:1},{j:15,s:17,v:1},
  {j:16,s:18,v:75},{j:17,s:21,v:1},{j:18,s:23,v:1},{j:19,s:25,v:21},{j:20,s:27,v:56},
  {j:21,s:29,v:46},{j:22,s:33,v:31},{j:23,s:36,v:28},{j:24,s:39,v:32},{j:25,s:41,v:47},
  {j:26,s:46,v:1},{j:27,s:51,v:31},{j:28,s:58,v:1},{j:29,s:67,v:1},{j:30,s:78,v:1},
];
