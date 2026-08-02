import { Dimensions, PixelRatio, Platform } from 'react-native';
const { width: W } = Dimensions.get('window');
const wScale = W / 375;
export const scaleW = (n: number) => PixelRatio.roundToNearestPixel(n * Math.min(wScale, 1.5));
export const scaleFont = (n: number) => PixelRatio.roundToNearestPixel(Math.max(12, Math.min(n * wScale, n * 1.6)));

export const ARABIC_FONTS: Record<string, string> = {
  saleem: 'PDMSSaleemQuranFont',
  uthmani: 'KFGQPCUthmanicScriptHAFS',
  alqalam: 'AlQalamQuranMajeed',
  lateef: 'Lateef-Regular',
  harmattan: 'Harmattan-Regular',
  amiri: 'Amiri-Regular',
  scheherazade: 'ScheherazadeNew-Regular',
};
export const getArabicFont = (style: string) => ARABIC_FONTS[style] || ARABIC_FONTS.uthmani;

export const COLORS = { primary: '#00d4aa', gold: '#ffd700', blue: '#4a90d9', borderDark: '#2a2a2a', borderLight: '#e0e0e0' };

export const JUZ_PAGE_START = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];

export const JUZ_MAP = [
  {j:1,s:1,v:1},{j:2,s:2,v:142},{j:3,s:2,v:253},{j:4,s:3,v:93},{j:5,s:4,v:24},{j:6,s:4,v:148},{j:7,s:5,v:82},{j:8,s:6,v:111},{j:9,s:7,v:88},{j:10,s:8,v:41},
  {j:11,s:9,v:93},{j:12,s:11,v:6},{j:13,s:12,v:53},{j:14,s:15,v:1},{j:15,s:17,v:1},{j:16,s:18,v:75},{j:17,s:21,v:1},{j:18,s:23,v:1},{j:19,s:25,v:21},{j:20,s:27,v:56},
  {j:21,s:29,v:46},{j:22,s:33,v:31},{j:23,s:36,v:28},{j:24,s:39,v:32},{j:25,s:41,v:47},{j:26,s:46,v:1},{j:27,s:51,v:31},{j:28,s:58,v:1},{j:29,s:67,v:1},{j:30,s:78,v:1},
];

export const getJuzInfoFromPage = (page: number): { juz: number; pagesLeft: number } => {
  let juz = 1;
  for (let i = 0; i < JUZ_PAGE_START.length; i++) if (page >= JUZ_PAGE_START[i]) juz = i + 1;
  const nextStart = juz < 30 ? JUZ_PAGE_START[juz] : 605;
  return { juz, pagesLeft: Math.max(0, (nextStart - 1) - page) };
};

export const getStartJuzOfSurah = (surahId: number): number => {
  let juz = 1;
  for (let i = 0; i < JUZ_MAP.length; i++) if (JUZ_MAP[i].s <= surahId) juz = JUZ_MAP[i].j;
  return juz;
};
