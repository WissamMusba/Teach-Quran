/**
 * FILE: src/screens/SettingsScreen.tsx
 * ROLE: Settings UI: reading toggles that dispatch to quranSlice (showTranslation, fontSize, readingMode, textStyle) and appearance/preferences toggles that dispatch to settingsSlice (nightMode, mushafSplit, playBasmala). Renders the fixed ScreenHeader plus theme-aware rounded cards.
 * DEPENDS ON: ../store/quranSlice (toggleTranslation/setFontSize/setReadingMode/setTextStyle, quranSlice.ts:16-21); ../store/settingsSlice (toggleNightMode/setMushafSplit/togglePlayBasmala, settingsSlice.ts:16-21); ../utils/mushafLayout SPLIT_MIN_WIDTH (768, mushafLayout.ts:2); ../utils/theme getArabicFont (font lookup for the Quran Script preview + options); ../components/common/ScreenHeader (fixed theme-aware header, self-reads nightMode); ../store RootState. Redux only â€” quranSlice state is NOT persisted; settingsSlice state IS persisted (redux-persist whitelist ['auth','drawing','sync','settings','audio'], src/store/index.ts:16).
 * USED BY: QuranView toolbar `onSettings` (QuranViewScreen.tsx:510).
 */
import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Modal, useWindowDimensions } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { toggleTranslation, setFontSize, setReadingMode, setTextStyle } from '../store/quranSlice';
import { toggleNightMode, setMushafSplit, togglePlayBasmala } from '../store/settingsSlice';
import { SPLIT_MIN_WIDTH } from '../utils/mushafLayout';
import { getArabicFont } from '../utils/theme';
import { RootState } from '../store';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';

const PREVIEW_BG = '#16294d';
const PREVIEW_TEXT = '#f5d98a';
const SCRIPT_SAMPLE = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
const SCRIPT_WORD = 'بِسْمِ';

const SCRIPT_OPTIONS = [
  { key: 'uthmani', label: 'Uthmani' },
  { key: 'alqalam', label: 'Indopak 1' },
  { key: 'saleem', label: 'Indopak 2' },
  { key: 'lateef', label: 'Indopak 3' },
];

const scriptLabel = (key: string) => SCRIPT_OPTIONS.find((o) => o.key === key)?.label || key;

/**
 * WHAT: Screen component: three cards of settings controls that dispatch Redux actions on change, topped by the fixed ScreenHeader. Wrapped in memo() (bottom of file).
 * FLOW: 1) useSelector: from state.quran -> showTranslation, fontSize, readingMode, textStyle; from state.settings -> nightMode, mushafSplit, playBasmala. 2) "Reading Settings" card: Show Translation Switch -> toggleTranslation(); Reading Mode segmented ['ayah'|'continuous'|'page'] -> setReadingMode(mode); Arabic Font Size ['small'|'medium'|'large'|'xl'] -> setFontSize(size); Quran Script preview box (Basmala in getArabicFont(textStyle)) + dropdown row that opens a bottom-sheet Modal listing Uthmani=uthmani / Indopak 1=alqalam / Indopak 2=saleem / Indopak 3=lateef (each sample word in its own font, ✓ on the current pick) -> setTextStyle(style). 3) "Appearance" card: Dark mode Switch -> toggleNightMode(). 4) "Reading Preferences" card: Spread view (two pages) Switch rendered ONLY when width >= SPLIT_MIN_WIDTH (768) -> setMushafSplit(v); Bismillah play Switch -> togglePlayBasmala().
 * CALLS: toggleTranslation / setFontSize / setReadingMode / setTextStyle (quranSlice); toggleNightMode / setMushafSplit / togglePlayBasmala (settingsSlice).
 * CALLED BY: React Navigation; via QuranViewScreen.tsx:510.
 * AFFECTS: Redux state.quran (showTranslation, fontSize, readingMode, textStyle) â€” NOT persisted (quranSlice not in persist whitelist); Redux state.settings (nightMode, mushafSplit, playBasmala) â€” PERSISTED to AsyncStorage via redux-persist. Downstream readers: quran values in QuranViewScreen.tsx:108 (page-layout cache key includes textStyle/headerVisible/fs, localDB.ts:20-24); settings in QuranViewScreen.tsx:110/117, VerseDisplay.tsx:11-12, MushafPageView.tsx:50-52, FlowingText.tsx:11-12, AnnotationToolbar.tsx:88, DashboardScreen.tsx:28.
 * NOTES: QARI IS NOT A SETTING HERE â€” no qari control exists on this screen. Qari lives in audioSlice.currentQari ('Mishary Al-Afasy' default, audioSlice.ts:5), set via QariSelector modal from AudioPlayerBar in QuranView; audio slice IS persisted. translationTextSize exists in settingsSlice (settingsSlice.ts:7,19) but has NO UI here and NO dispatcher/reader anywhere (dead state). quranSlice settings reset on every app restart (not whitelisted): showTranslation/fontSize/readingMode/textStyle default back to false/'medium'/'page'/'lateef'. The brightness sliders were removed from this UI â€” textBrightness/bgBrightness stay in settingsSlice untouched and persist at their last values (default 255), they just have no control here anymore. Whole screen adapts to nightMode via inline card/row/switch colors; the Quran Script preview keeps a fixed dark-navy backdrop with gold/cream text in both modes.
 */
const SettingsScreen = ({ onClose }: { onClose?: () => void } = {}) => {
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const [scriptModal, setScriptModal] = useState(false);
  const { showTranslation, fontSize, readingMode, textStyle } = useSelector((state: RootState) => state.quran);
  const { nightMode, mushafSplit, playBasmala } = useSelector((state: RootState) => state.settings);

  const bg = nightMode ? '#121212' : '#ffffff';
  const cardBg = nightMode ? '#1a1a2e' : '#f5f6ff';
  const cardBorder = nightMode ? '#2a2a4a' : '#e4e6f4';
  const labelColor = nightMode ? '#fff' : '#1a1a1a';
  const btnBorder = nightMode ? '#3a3a5e' : '#d8dae8';
  const inactiveText = nightMode ? '#b0b0c8' : '#7a7a90';
  const switchFalse = nightMode ? '#333' : '#d0d0d6';

  return (
    <View style={[styles(nightMode).wrapper, { backgroundColor: bg }]}>
      <ScreenHeader title="Settings" subtitle="Reading & appearance" onBack={onClose} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles(nightMode).content}>
        <View style={[styles(nightMode).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={styles(nightMode).sectionTitle}>Reading Settings</Text>

          <View style={styles(nightMode).row}>
            <Text style={[styles(nightMode).label, { color: labelColor }]}>Show Translation</Text>
            <Switch value={showTranslation} onValueChange={() => { dispatch(toggleTranslation()); }} trackColor={{ false: switchFalse, true: nightMode ? '#7BA7DB' : '#1C3D72' }} />
          </View>

          <Text style={[styles(nightMode).label, { color: labelColor }]}>Reading Mode</Text>
          <View style={styles(nightMode).modeContainer}>
            {['ayah', 'continuous', 'page'].map((mode) => (
              <TouchableOpacity key={mode} style={[styles(nightMode).modeBtn, { borderColor: btnBorder }, readingMode === mode && styles(nightMode).activeBtn]} onPress={() => dispatch(setReadingMode(mode))}>
                <Text style={readingMode === mode ? styles(nightMode).activeText : [styles(nightMode).inactiveText, { color: inactiveText }]}>{mode === 'ayah' ? 'Ayah List' : mode === 'continuous' ? 'Continuous' : 'Page Swipe'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles(nightMode).label, { color: labelColor }]}>Arabic Font Size</Text>
          <View style={styles(nightMode).sizeContainer}>
            {['small', 'medium', 'large', 'xl'].map((size) => (
              <TouchableOpacity key={size} style={[styles(nightMode).sizeBtn, { borderColor: btnBorder }, fontSize === size && styles(nightMode).activeBtn]} onPress={() => dispatch(setFontSize(size))}>
                <Text style={fontSize === size ? styles(nightMode).activeText : [styles(nightMode).inactiveText, { color: inactiveText }]}>{size.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles(nightMode).label, { color: labelColor }]}>Quran Script</Text>
          <TouchableOpacity style={styles(nightMode).previewWrap} activeOpacity={0.9} onPress={() => setScriptModal(true)}>
            <View style={styles(nightMode).previewBox}>
              <Text style={[styles(nightMode).previewText, { fontFamily: getArabicFont(textStyle) }]}>{SCRIPT_SAMPLE}</Text>
              <View style={styles(nightMode).previewBadge}>
                <Text style={styles(nightMode).previewBadgeText}>{scriptLabel(textStyle)}</Text>
              </View>
            </View>
            <View style={[styles(nightMode).scriptRow, { borderColor: btnBorder }]}>
              <Text style={[styles(nightMode).scriptRowLabel, { color: labelColor }]}>{scriptLabel(textStyle)}</Text>
              <Text style={styles(nightMode).chevron}>⌄</Text>
            </View>
            <Text style={styles(nightMode).legend}>Tap to switch script</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles(nightMode).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={styles(nightMode).sectionTitle}>Appearance</Text>
          <View style={styles(nightMode).row}>
            <View style={styles(nightMode).settingInfo}><Text style={[styles(nightMode).settingTitle, { color: labelColor }]}>Dark mode</Text><Text style={styles(nightMode).settingDesc}>Use dark background and light text</Text></View>
            <Switch value={nightMode} onValueChange={() => { dispatch(toggleNightMode()); }} trackColor={{ false: switchFalse, true: nightMode ? '#7BA7DB' : '#1C3D72' }} />
          </View>
        </View>

        <View style={[styles(nightMode).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={styles(nightMode).sectionTitle}>Reading Preferences</Text>
          {width >= SPLIT_MIN_WIDTH && (
            <View style={styles(nightMode).row}>
              <View style={styles(nightMode).settingInfo}><Text style={[styles(nightMode).settingTitle, { color: labelColor }]}>Spread view (two pages side by side)</Text><Text style={styles(nightMode).settingDesc}>Show two mushaf pages side by side on tablets</Text></View>
              <Switch value={mushafSplit} onValueChange={(v) => { dispatch(setMushafSplit(v)); }} trackColor={{ false: switchFalse, true: nightMode ? '#7BA7DB' : '#1C3D72' }} />
            </View>
          )}
          <View style={styles(nightMode).row}>
            <View style={styles(nightMode).settingInfo}><Text style={[styles(nightMode).settingTitle, { color: labelColor }]}>Bismillah before verse 1</Text><Text style={styles(nightMode).settingDesc}>Play the Bismillah before the first verse of a surah (except Al-Fatiha and At-Tawbah)</Text></View>
            <Switch value={playBasmala} onValueChange={() => { dispatch(togglePlayBasmala()); }} trackColor={{ false: switchFalse, true: nightMode ? '#7BA7DB' : '#1C3D72' }} />
          </View>
        </View>
      </ScrollView>

      <Modal visible={scriptModal} transparent animationType="slide" onRequestClose={() => setScriptModal(false)}>
        <TouchableOpacity style={styles(nightMode).modalOverlay} activeOpacity={1} onPress={() => setScriptModal(false)}>
          <View style={[styles(nightMode).sheet, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={styles(nightMode).sheetTitle}>Choose Script</Text>
            {SCRIPT_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.key} style={[styles(nightMode).optionRow, { borderColor: btnBorder }]} onPress={() => { dispatch(setTextStyle(opt.key as any)); setScriptModal(false); }}>
                <Text style={[styles(nightMode).optionLabel, { color: labelColor }]}>{opt.label}</Text>
                <Text style={[styles(nightMode).optionSample, { fontFamily: getArabicFont(opt.key) }]}>{SCRIPT_WORD}</Text>
                {textStyle === opt.key && <Text style={styles(nightMode).optionCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles(nightMode).cancelBtn} onPress={() => setScriptModal(false)}>
              <Text style={styles(nightMode).cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <CollapsibleBannerAd />
    </View>
  );
};

const styles = (nightMode: boolean) => StyleSheet.create({
  wrapper: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  section: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: nightMode ? '#7BA7DB' : '#1C3D72', marginBottom: 18, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  label: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  modeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modeBtn: { padding: 10, borderWidth: 1, borderRadius: 8, width: '32%', alignItems: 'center' },
  activeBtn: { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72', borderColor: nightMode ? '#7BA7DB' : '#1C3D72' },
  activeText: { color: '#121212', fontWeight: 'bold' },
  inactiveText: { fontWeight: '500' },
  sizeContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  sizeBtn: { padding: 10, borderWidth: 1, borderRadius: 8, width: '23%', alignItems: 'center' },
  previewWrap: { marginBottom: 4 },
  previewBox: { minHeight: 90, borderRadius: 12, backgroundColor: PREVIEW_BG, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 18, overflow: 'hidden' },
  previewText: { fontSize: 26, lineHeight: 44, color: PREVIEW_TEXT, textAlign: 'center' },
  previewBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: (nightMode ? `rgba(123,167,219,${0.6})` : `rgba(28,61,114,${0.6})`), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  previewBadgeText: { color: nightMode ? '#7BA7DB' : '#1C3D72', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  scriptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  scriptRowLabel: { fontSize: 15, fontWeight: '600' },
  chevron: { color: nightMode ? '#7BA7DB' : '#1C3D72', fontSize: 18, fontWeight: 'bold' },
  legend: { fontSize: 12, color: '#8a8a8a', marginTop: 8, textAlign: 'center' },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  settingDesc: { fontSize: 14, color: '#888', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, paddingBottom: 34 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: nightMode ? '#7BA7DB' : '#1C3D72', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 14 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  optionSample: { fontSize: 22, color: '#d4a24e', marginLeft: 12 },
  optionCheck: { color: nightMode ? '#7BA7DB' : '#1C3D72', fontSize: 18, fontWeight: 'bold', width: 24, textAlign: 'right', marginLeft: 12 },
  cancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: (nightMode ? `rgba(123,167,219,${0.12})` : `rgba(28,61,114,${0.12})`) },
  cancelText: { color: nightMode ? '#7BA7DB' : '#1C3D72', fontSize: 15, fontWeight: '700' },
});
export default memo(SettingsScreen);
