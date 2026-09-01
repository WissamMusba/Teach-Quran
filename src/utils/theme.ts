/**
 * FILE: src/utils/theme.ts
 * ROLE: Font-family lookup by text style key, theme color constants, and the juz<->page/surah static tables with helpers.
 * DEPENDS ON: hardcoded static tables (JUZ_PAGE_START, JUZ_MAP, JUZ_NAMES).
 * USED BY: QuranViewScreen.tsx (getJuzInfoFromPage, getStartJuzOfSurah); MushafPageView.tsx (getArabicFont, getJuzInfoFromPage); FlowingText.tsx (getArabicFont); VerseDisplay.tsx (getArabicFont); SurahList.tsx (getStartJuzOfSurah, JUZ_MAP); BookmarksScreen.tsx (JUZ_MAP); JuzIndexScreen.tsx (JUZ_NAMES).
 */
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
};

export const getArabicFont = (style: string) => ARABIC_FONTS[style] || ARABIC_FONTS.alqalam;

export const COLORS = { primary: '#1C3D72', primaryNight: '#7BA7DB', secondary: '#C9A227', secondaryNight: '#8C7320', gold: '#ffd700', blue: '#4a90d9', borderDark: '#2a2a2a', borderLight: '#e0e0e0' };

export const JUZ_PAGE_START = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];

export const JUZ_MAP = [
  {j:1,s:1,v:1},{j:2,s:2,v:142},{j:3,s:2,v:253},{j:4,s:3,v:93},{j:5,s:4,v:24},{j:6,s:4,v:148},{j:7,s:5,v:82},{j:8,s:6,v:111},{j:9,s:7,v:88},{j:10,s:8,v:41},
  {j:11,s:9,v:93},{j:12,s:11,v:6},{j:13,s:12,v:53},{j:14,s:15,v:1},{j:15,s:17,v:1},{j:16,s:18,v:75},{j:17,s:21,v:1},{j:18,s:23,v:1},{j:19,s:25,v:21},{j:20,s:27,v:56},
  {j:21,s:29,v:46},{j:22,s:33,v:31},{j:23,s:36,v:28},{j:24,s:39,v:32},{j:25,s:41,v:47},{j:26,s:46,v:1},{j:27,s:51,v:31},{j:28,s:58,v:1},{j:29,s:67,v:1},{j:30,s:78,v:1},
];

export const JUZ_NAMES: { j: number; ur: string; en: string }[] = [
  { j: 1, ur: 'الم', en: 'Alif Laam Meem' },
  { j: 2, ur: 'سَيَقُولُ', en: 'Sayaqool' },
  { j: 3, ur: 'تِلْكَ الرُّسُلُ', en: 'Tilkar Rusul' },
  { j: 4, ur: 'لَنْ تَنَالُوا', en: 'Lan Tanaaloo' },
  { j: 5, ur: 'وَالْمُحْصَنَاتُ', en: 'Wal Muhsanat' },
  { j: 6, ur: 'لَا يُحِبُّ اللَّهُ', en: 'La Yuhibbullah' },
  { j: 7, ur: 'وَإِذَا سَمِعُوا', en: 'Wa Iza Samiu' },
  { j: 8, ur: 'وَلَوْ أَنَّنَا', en: 'Wa Law Annana' },
  { j: 9, ur: 'قَالَ الْمَلَأُ', en: 'Qalal Mala\'u' },
  { j: 10, ur: 'وَاعْلَمُوا', en: 'Wa\'lamoo' },
  { j: 11, ur: 'يَعْتَذِرُونَ', en: 'Ya\'taziroon' },
  { j: 12, ur: 'وَمَا مِنْ دَابَّةٍ', en: 'Wa Mamin Daabbah' },
  { j: 13, ur: 'وَمَا أُبَرِّئُ', en: 'Wa Ma Ubarri\'u' },
  { j: 14, ur: 'رُبَمَا', en: 'Rubama' },
  { j: 15, ur: 'سُبْحَانَ الَّذِي', en: 'Subhanallazi' },
  { j: 16, ur: 'قَالَ أَلَمْ', en: 'Qala Alam' },
  { j: 17, ur: 'اقْتَرَبَ', en: 'Iqtaraba' },
  { j: 18, ur: 'قَدْ أَفْلَحَ', en: 'Qad Aflaha' },
  { j: 19, ur: 'وَقَالَ الَّذِينَ', en: 'Wa Qalallazina' },
  { j: 20, ur: 'أَمَّنْ خَلَقَ', en: 'Amman Khalaqa' },
  { j: 21, ur: 'اتْلُ مَا أُوحِيَ', en: 'Utlu Ma Oohiya' },
  { j: 22, ur: 'وَمَنْ يَقْنُتْ', en: 'Wa Man Yaqnut' },
  { j: 23, ur: 'وَمَا لِيَ', en: 'Wa Maliya' },
  { j: 24, ur: 'فَمَنْ أَظْلَمُ', en: 'Faman Azlamu' },
  { j: 25, ur: 'إِلَيْهِ يُرَدُّ', en: 'Ilaihi Yuraddu' },
  { j: 26, ur: 'حـم', en: 'Ha-Meem' },
  { j: 27, ur: 'قَالَ فَمَا خَطْبُكُمْ', en: 'Qala Fama Khatbukum' },
  { j: 28, ur: 'قَدْ سَمِعَ اللَّهُ', en: 'Qad Sami\'allah' },
  { j: 29, ur: 'تَبَارَكَ الَّذِي', en: 'Tabarakallazi' },
  { j: 30, ur: 'عَمَّ يَتَسَاءَلُونَ', en: 'Amma Yatasa\'aloon' },
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
