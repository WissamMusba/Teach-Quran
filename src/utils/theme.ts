/**
 * FILE: src/utils/theme.ts
 * ROLE: Font-family lookup by text style key, theme color constants, and the juz<->page/surah static tables with helpers.
 */
import { Dimensions, PixelRatio } from 'react-native';
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

export interface AppThemeColors {
  primary: string;
  accent: string;
  gold: string;
  bg: string;
  cardBg: string;
  border: string;
  heroBg: string;
  heroBorder: string;
  text: string;
  subText: string;
  frameStroke: string;
  frameBandBg: string;
  frameCornerBg: string;
  badgeBg: string;
  badgeBorder: string;
  headerBg: string;
  headerBorder: string;
}

export const getThemeColors = (colorTheme = 'classic', nightMode = true): AppThemeColors => {
  if (colorTheme === 'emerald') {
    return {
      primary: '#0F4C3A',
      accent: '#52B788',
      gold: '#D4AF37',
      bg: nightMode ? '#0B1B15' : '#F5F8F5',
      cardBg: nightMode ? '#142821' : '#EAF2EC',
      border: nightMode ? '#1F3D32' : '#D3E2D6',
      heroBg: nightMode ? '#13382C' : '#E2EFE7',
      heroBorder: nightMode ? '#225242' : '#C2DBCB',
      text: nightMode ? '#FFFFFF' : '#0B1B15',
      subText: nightMode ? '#85A89B' : '#5E786E',
      frameStroke: nightMode ? '#52B788' : '#0F4C3A',
      frameBandBg: nightMode ? '#142821' : '#EAF2EC',
      frameCornerBg: nightMode ? '#183027' : '#F5F8F5',
      badgeBg: nightMode ? 'rgba(20, 40, 33, 0.92)' : 'rgba(245, 248, 245, 0.95)',
      badgeBorder: nightMode ? 'rgba(82, 183, 136, 0.35)' : 'rgba(15, 76, 58, 0.35)',
      headerBg: nightMode ? '#0E1F18' : '#EAF2EC',
      headerBorder: nightMode ? '#1F3D32' : '#D3E2D6',
    };
  }
  if (colorTheme === 'obsidian') {
    return {
      primary: '#20242D',
      accent: '#8FA4C4',
      gold: '#E5C07B',
      bg: nightMode ? '#000000' : '#F2EFE9',
      cardBg: nightMode ? '#111114' : '#E8E4DC',
      border: nightMode ? '#222228' : '#D6D0C4',
      heroBg: nightMode ? '#14151C' : '#E5E7EB',
      heroBorder: nightMode ? '#282A38' : '#CCD1DA',
      text: nightMode ? '#FFFFFF' : '#141416',
      subText: nightMode ? '#888898' : '#6A6A78',
      frameStroke: nightMode ? '#8FA4C4' : '#20242D',
      frameBandBg: nightMode ? '#111114' : '#E8E4DC',
      frameCornerBg: nightMode ? '#17181F' : '#F2EFE9',
      badgeBg: nightMode ? 'rgba(17, 17, 20, 0.92)' : 'rgba(242, 239, 233, 0.95)',
      badgeBorder: nightMode ? 'rgba(143, 164, 196, 0.35)' : 'rgba(32, 36, 45, 0.35)',
      headerBg: nightMode ? '#000000' : '#E8E4DC',
      headerBorder: nightMode ? '#222228' : '#D6D0C4',
    };
  }
  // Default: Classic Royal Navy
  return {
    primary: '#1C3D72',
    accent: '#7BA7DB',
    gold: '#C9A227',
    bg: nightMode ? '#10121A' : '#FAF7EE',
    cardBg: nightMode ? '#1C202E' : '#F3EFE4',
    border: nightMode ? '#2B3145' : '#E2DDD0',
    heroBg: nightMode ? '#18233C' : '#EAF0FA',
    heroBorder: nightMode ? '#2D3F66' : '#C7D7F0',
    text: nightMode ? '#FFFFFF' : '#1A1A1A',
    subText: nightMode ? '#8E95A8' : '#7D7667',
    frameStroke: nightMode ? '#7BA7DB' : '#1C3D72',
    frameBandBg: nightMode ? '#1E2532' : '#F5F2E9',
    frameCornerBg: nightMode ? '#232A38' : '#FAF7EE',
    badgeBg: nightMode ? 'rgba(18, 18, 20, 0.85)' : 'rgba(250, 247, 238, 0.92)',
    badgeBorder: nightMode ? 'rgba(123, 167, 219, 0.35)' : 'rgba(28, 61, 114, 0.35)',
    headerBg: nightMode ? '#141824' : '#F3EFE4',
    headerBorder: nightMode ? '#283048' : '#E2DDD0',
  };
};

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
