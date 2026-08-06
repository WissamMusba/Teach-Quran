/**
 * FILE: src/store/quranSlice.ts
 * ROLE: Current reading session: which surah/verses are loaded, display prefs
 *       (translation/font/mode/font style), surah-name map, playback flash.
 * DEPENDS ON: none.
 * USED BY: src/screens/SplashScreen.tsx:6 (setSurahNames);
 *          src/screens/DashboardScreen.tsx:8 (setSurah);
 *          src/screens/QuranViewScreen.tsx:5 (setSurah, toggleTranslation,
 *            setFlashingVerse, setReadingMode);
 *          src/screens/SettingsScreen.tsx:4 (toggleTranslation, setFontSize,
 *            setReadingMode, setTextStyle);
 *          src/components/quran/VerseDisplay.tsx:10, FlowingText.tsx:10,
 *            MushafPageView.tsx:52 (read textStyle);
 *          src/screens/BookmarksScreen.tsx:34, NotesScreen.tsx:12,
 *            MistakesScreen.tsx:9 (read surahNames)
 * NOTE: NOT persisted (whitelist excludes 'quran') — all reading prefs are
 *       silently lost on every cold start.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
export const quranSlice = createSlice({
  name: 'quran', 
  initialState: { 
    currentSurahId: 1,  // surah currently open in QuranView 
    verses: [] as any[],  // paginated verse array for continuous/ayah modes 
    showTranslation: false,  // toggle translation line under Arabic 
    fontSize: 'medium' as 'small' | 'medium' | 'large' | 'xl',  // Arabic scale tier ('small'|'medium'|'large'|'xl') 
    readingMode: 'page' as 'continuous' | 'page' | 'ayah',  // renderer mode; 'page' = mushaf layout 
    surahNames: {} as any,  // { id: englishName } map (id as object key) 
    flashingVerse: null as number | null,  // verse num briefly highlighted during audio/deep-link 
    textStyle: 'lateef' as 'saleem' | 'uthmani' | 'alqalam' | 'lateef'  // Arabic font family 
  },
  reducers: {
    /**
     * WHAT: Swaps currentSurahId and the in-memory verses array (usually reset
     *       to [] and lazily reloaded).
     * CALLED BY: DashboardScreen.tsx:66 (student card tap); QuranViewScreen.tsx:209/:568
     *            (page swipe detects new surah), :230 (deep link prefetch),
     *            :260-261 (loadSurah paginated reset/append), :302 (restore
     *            lastRead on surah mismatch), :429-430 (prev/next surah swipe),
     *            :630 (SurahList row select).
     * AFFECTS: QuranViewScreen.tsx:108 re-render; refs synced :245-253; effects
     *          :264-280 (reload/prefetch + header), :282 (exit drawing mode).
     *          Verse readers: ayah FlatList :517, continuous ScrollView :531,
     *          copy-verse :392.
     */
    setSurah: (state, action) => { state.currentSurahId = action.payload.surahId; state.verses = action.payload.verses; },
    /**
     * WHAT: Flips showTranslation boolean.
     * CALLED BY: SettingsScreen.tsx:22 (Show Translation switch).
     * AFFECTS: VerseDisplay.tsx:36 + FlowingText.tsx:48 (render translation line);
     *          QuranViewScreen.tsx:108 + SettingsScreen.tsx:13.
     *          NOTE: QuranViewScreen.tsx:5 imports toggleTranslation but never
     *          dispatches it — dead import.
     */
    toggleTranslation: (state) => { state.showTranslation = !state.showTranslation; },
    /**
     * WHAT: Sets Arabic font scale tier.
     * CALLED BY: SettingsScreen.tsx:35 (Arabic Font Size buttons).
     * AFFECTS: VerseDisplay.tsx:19 (`FONT_SIZES[fontSize]` -> scaleFont),
     *          FlowingText.tsx:15; passed as prop from QuranViewScreen.tsx:523/:541.
     */
    setFontSize: (state, action) => { state.fontSize = action.payload; },
    /**
     * WHAT: Sets 'continuous' | 'page' | 'ayah' renderer.
     * CALLED BY: SettingsScreen.tsx:27 (Reading Mode buttons); QuranViewScreen.tsx:202
     *            (handleSelectPage forces 'page' when jumping to a page).
     * AFFECTS: QuranViewScreen.tsx:108/:202/:264-280 — swaps active renderer
     *          (ayah FlatList :516, continuous ScrollView :530, page FlatList :548),
     *          header info (:124-129), enables/disables swipe gestures (:513).
     */
    setReadingMode: (state, action) => { state.readingMode = action.payload; },
    /**
     * WHAT: Stores { id: englishName } map once at boot.
     * CALLED BY: SplashScreen.tsx:20 (load(), after downloadAndCacheQuran + getSurahs).
     * AFFECTS: Header name lookup QuranViewScreen.tsx:123; MushafPageView.tsx:187
     *          (surah badge); BookmarksScreen.tsx:34, NotesScreen.tsx:12,
     *          MistakesScreen.tsx:9 (surah labels). NOT persisted — re-fetched every boot.
     */
    setSurahNames: (state, action) => { state.surahNames = action.payload; },
    /**
     * WHAT: Sets the verse number to flash-highlight; callers clear with null
     *       after ~2s or on playback stop/end/error.
     * CALLED BY (all QuranViewScreen.tsx): :238 deep-link scroll (cleared after 2s),
     *          :464/:485 audio onVerseChange; :453/:476 playback stop;
     *          :465/:466/:487 onEnd / onError / Alert-catch clear.
     * AFFECTS: VerseDisplay.tsx:24, FlowingText.tsx:43, MushafPageView.tsx:322 —
     *          'rgba(255,215,0,…)' flash background; SpreadItem flashingVerseKey
     *          QuranViewScreen.tsx:576.
     */
    setFlashingVerse: (state, action) => { state.flashingVerse = action.payload; },
    /**
     * WHAT: Sets Arabic font family.
     * CALLED BY: SettingsScreen.tsx:43 (Text Style buttons).
     * AFFECTS: textStyleRef (QuranViewScreen.tsx:252); `isIndopak` (:114) changes
     *          page count 604->610 (:115) and triggers full page-cache flush
     *          (:284-290); fontFamily in VerseDisplay.tsx:18, FlowingText.tsx:14,
     *          MushafPageView.tsx:53; getFontAdj MushafPageView.tsx:75.
     */
    setTextStyle: (state, action: PayloadAction<'saleem' | 'uthmani' | 'alqalam' | 'lateef'>) => { state.textStyle = action.payload; }
  }
});
export const { setSurah, toggleTranslation, setFontSize, setReadingMode, setSurahNames, setFlashingVerse, setTextStyle } = quranSlice.actions;
export default quranSlice.reducer;
