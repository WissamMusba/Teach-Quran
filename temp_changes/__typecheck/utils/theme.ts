/**
 * FILE: src/utils/theme.ts
 * ROLE: Font-family lookup by text style key, theme color constants, and the juz<->page/surah static tables with helpers.
 * DEPENDS ON: hardcoded static tables (JUZ_PAGE_START, JUZ_MAP).
 * USED BY: QuranViewScreen.tsx (getJuzInfoFromPage, getStartJuzOfSurah); MushafPageView.tsx (getArabicFont, getJuzInfoFromPage); FlowingText.tsx (getArabicFont); VerseDisplay.tsx (getArabicFont); SurahList.tsx (getStartJuzOfSurah, JUZ_MAP); BookmarksScreen.tsx (JUZ_MAP).
 */
import { Dimensions, PixelRatio, Platform } from 'react-native';
const { width: W } = Dimensions.get('window');
const wScale = W / 375;
// DEAD EXPORTS: scaleW / scaleFont are never imported in src/ (grep finds only their own definitions here).
// Their logic is duplicated by src/utils/responsive.ts's scaleFont, which IS used (FlowingText.tsx, VerseDisplay.tsx).
// Rebuild should keep only responsive.ts's version and drop these.
export const scaleW = (n: number) => PixelRatio.roundToNearestPixel(n * Math.min(wScale, 1.5));
export const scaleFont = (n: number) => PixelRatio.roundToNearestPixel(Math.max(12, Math.min(n * wScale, n * 1.6)));

// WHAT: Maps textStyle keys to registered font family names: saleem->PDMSSaleemQuranFont, uthmani->KFGQPCUthmanicScriptHAFS, alqalam->AlQalamQuranMajeed, lateef->Lateef-Regular, harmattan->Harmattan-Regular, amiri->Amiri-Regular, scheherazade->ScheherazadeNew-Regular.
// NOTES: 'indopak' is NOT in the map — getArabicFont('indopak') falls back to uthmani (QuranViewScreen treats 'indopak' as an Indopak-style key elsewhere, but the font falls back here).
export const ARABIC_FONTS: Record<string, string> = {
  saleem: 'PDMSSaleemQuranFont',
  uthmani: 'KFGQPCUthmanicScriptHAFS',
  alqalam: 'AlQalamQuranMajeed',
  lateef: 'Lateef-Regular',
  harmattan: 'Harmattan-Regular',
  amiri: 'Amiri-Regular',
  scheherazade: 'ScheherazadeNew-Regular',
};
// WHAT: ARABIC_FONTS[style] || ARABIC_FONTS.uthmani — unknown keys silently become Uthmani (no validation, a typo'd style renders Uthmani without warning).
// CALLED BY: FlowingText.tsx, VerseDisplay.tsx, MushafPageView.tsx (fontFamily applied to every word Text style).
// AFFECTS: Which glyph set renders the Quran text.
export const getArabicFont = (style: string) => ARABIC_FONTS[style] || ARABIC_FONTS.uthmani;

// Shared palette. NOTES: DEAD-ish — no src/ consumer (colors are re-hardcoded per file elsewhere); candidate for consolidation.
export const COLORS = { primary: '#00d4aa', gold: '#ffd700', blue: '#4a90d9', borderDark: '#2a2a2a', borderLight: '#e0e0e0' };

// WHAT: The 30 juz start pages (index 0 = page 1 of juz 1). Hand-maintained table — must stay in sync with the DB.
export const JUZ_PAGE_START = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];

// WHAT: Standard juz division points — 30 entries {j, s, v} (juz starts at surah s, verse v). Hand-maintained; also read directly by BookmarksScreen.tsx for the juz banner.
export const JUZ_MAP = [
  {j:1,s:1,v:1},{j:2,s:2,v:142},{j:3,s:2,v:253},{j:4,s:3,v:93},{j:5,s:4,v:24},{j:6,s:4,v:148},{j:7,s:5,v:82},{j:8,s:6,v:111},{j:9,s:7,v:88},{j:10,s:8,v:41},
  {j:11,s:9,v:93},{j:12,s:11,v:6},{j:13,s:12,v:53},{j:14,s:15,v:1},{j:15,s:17,v:1},{j:16,s:18,v:75},{j:17,s:21,v:1},{j:18,s:23,v:1},{j:19,s:25,v:21},{j:20,s:27,v:56},
  {j:21,s:29,v:46},{j:22,s:33,v:31},{j:23,s:36,v:28},{j:24,s:39,v:32},{j:25,s:41,v:47},{j:26,s:46,v:1},{j:27,s:51,v:31},{j:28,s:58,v:1},{j:29,s:67,v:1},{j:30,s:78,v:1},
];

// WHAT: Linear scan of JUZ_PAGE_START (the 30 juz start pages) to find the juz containing `page`, plus pages left until the next juz starts (juz 30 uses page 605 as the boundary).
// FLOW: 1) Loop picks the highest juz whose start page <= page. 2) nextStart = JUZ_PAGE_START[juz] (0-based index == 1-based juz) or 605 for juz 30. 3) pagesLeft = max(0, nextStart - 1 - page).
// CALLED BY: QuranViewScreen.tsx (builds headerInfo for page mode); MushafPageView.tsx (juzInfo for the "Juz N" pill shown when the header is hidden).
// AFFECTS: Header info line "Juz N · Page P · X left in Juz" and the mushaf juz badge.
// NOTES: JUZ_PAGE_START[0] = 1; total mushaf pages assumed 604/605 (Indopak 610 pages use a different numbering elsewhere).
export const getJuzInfoFromPage = (page: number): { juz: number; pagesLeft: number } => {
  let juz = 1;
  for (let i = 0; i < JUZ_PAGE_START.length; i++) if (page >= JUZ_PAGE_START[i]) juz = i + 1;
  const nextStart = juz < 30 ? JUZ_PAGE_START[juz] : 605;
  return { juz, pagesLeft: Math.max(0, (nextStart - 1) - page) };
};

// WHAT: Returns the juz in which a surah begins by scanning JUZ_MAP; the last entry with s <= surahId wins.
// CALLED BY: QuranViewScreen.tsx (headerInfo in ayah/continuous mode — page=0 so only the Juz is shown); SurahList.tsx (per-surah startJuz badge; also uses JUZ_MAP itself for the juz chips row).
// AFFECTS: Header Juz number in flowing modes; SurahList juz badges.
// NOTES: Surah 1 -> juz 1; Surah 114 -> juz 30 (map last entry s:78).
export const getStartJuzOfSurah = (surahId: number): number => {
  let juz = 1;
  for (let i = 0; i < JUZ_MAP.length; i++) if (JUZ_MAP[i].s <= surahId) juz = JUZ_MAP[i].j;
  return juz;
};
