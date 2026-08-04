/**
 * FILE: src/store/settingsSlice.ts
 * ROLE: Reader appearance + reading preferences (all persisted).
 * DEPENDS ON: none.
 * USED BY: src/screens/SettingsScreen.tsx:5 (toggleNightMode, setTextBrightness,
 *          setBgBrightness, toggleShowPageInfo, setMushafSplit);
 *          src/screens/QuranViewScreen.tsx:10 (setMushafSplit);
 *          readers of nightMode/textBrightness/bgBrightness/mushafSplit across
 *          DashboardScreen, QuranViewScreen, VerseDisplay, FlowingText,
 *          MushafPageView, AnnotationToolbar.
 * NOTE: Persisted via whitelist 'settings'.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  nightMode: true,            // dark theme (defaults ON)
  textBrightness: 255,        // 0-255 alpha of Arabic text color
  bgBrightness: 18,           // 0-255 background dim (UNUSED in render — dead setting)
  translationTextSize: 16,    // DEAD: setter exists, no dispatcher, no reader
  showPageInfo: true,         // DEAD: only read by its own Settings switch
  mushafSplit: false,         // tablet two-page spread
  playBasmala: true,          // play the reciter's basmala before verse 1 of a surah (surah 1 & 9 excluded)
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    /**
     * WHAT: Flips nightMode.
     * CALLED BY: SettingsScreen.tsx:57 (Night mode switch).
     * AFFECTS: Background/foreground colors in DashboardScreen.tsx:28/:66/:72-74,
     *          QuranViewScreen.tsx:110/:112 (bgColor), AnnotationToolbar.tsx:88
     *          (inverts bar palette), VerseDisplay.tsx:11/:24, FlowingText.tsx:11/:33,
     *          MushafPageView.tsx:50/:54-62/:226-330 (text/line/frame/badge colors).
     */
    toggleNightMode: (state) => { state.nightMode = !state.nightMode; },
    /**
     * WHAT: Sets 0-255 Arabic-text opacity scalar.
     * CALLED BY: SettingsScreen.tsx:61 (Text brightness slider, Math.round).
     * AFFECTS: textColor = `rgba(...,${textBrightness/255})` in VerseDisplay.tsx:12/:16,
     *          FlowingText.tsx:12/:13, MushafPageView.tsx:51/:54.
     */
    setTextBrightness: (state, action) => { state.textBrightness = action.payload; },
    /**
     * WHAT: Sets 0-255 background dim scalar.
     * CALLED BY: SettingsScreen.tsx:66 (Background brightness slider).
     * AFFECTS: NOTHING in render. QuranViewScreen.tsx:110 selects bgBrightness
     *          but never uses it (bgColor hardcoded at :112); slider only reflects
     *          itself (SettingsScreen.tsx:14/:67). Dead setting.
     */
    setBgBrightness: (state, action) => { state.bgBrightness = action.payload; },
    /**
     * WHAT: Would set translation font size.
     * CALLED BY: NOBODY — action exported (:25) but zero dispatchers in src/.
     *            DEAD ACTION. Translation size is hardcoded 16 (VerseDisplay.tsx:46)
     *            and 14 (FlowingText.tsx:63).
     */
    setTranslationTextSize: (state, action) => { state.translationTextSize = action.payload; },
    /**
     * WHAT: Flips showPageInfo.
     * CALLED BY: SettingsScreen.tsx:75 (Show page info switch).
     * AFFECTS: Only the switch UI itself (SettingsScreen.tsx:14/:75). No reader in
     *          QuranViewScreen/MushafPageView — page info is instead controlled by
     *          `headerVisible` local state. Dead setting.
     */
    toggleShowPageInfo: (state) => { state.showPageInfo = !state.showPageInfo; },
    /**
     * WHAT: Sets two-page spread flag.
     * CALLED BY: SettingsScreen.tsx:80 (Spread view switch, tablet only — row hidden
     *            unless width >= SPLIT_MIN_WIDTH); QuranViewScreen.tsx:511
     *            (AnimatedHeader onSpread -> setMushafSplit(!splitOn)).
     * AFFECTS: splitOn = mushafSplit && winW >= SPLIT_MIN_WIDTH (QuranViewScreen.tsx:117)
     *          -> SpreadItem pairs (:573), prefetchPartner (:186), drawing key halves
     *          (:440-444), scroll index math (:214/:314/:549-572).
     */
    setMushafSplit: (state, action) => { state.mushafSplit = !!action.payload; },
    /**
     * WHAT: Flips playBasmala (audio prelude setting).
     * CALLED BY: SettingsScreen.tsx (Basmala before verse 1 switch).
     * AFFECTS: QuranViewScreen passes `{ playBasmala }` to playSurahFromVerse ->
     *          audioPlayback plays the basmala (reciter's 1:1 file) before verse 1
     *          of any surah except 1 (Al-Fatiha) and 9 (At-Tawbah).
     */
    togglePlayBasmala: (state) => { state.playBasmala = !state.playBasmala; },
  }
});

export const { toggleNightMode, setTextBrightness, setBgBrightness, setTranslationTextSize, toggleShowPageInfo, setMushafSplit, togglePlayBasmala } = settingsSlice.actions;
export default settingsSlice.reducer;
