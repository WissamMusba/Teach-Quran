/**
 * FILE: src/screens/SettingsScreen.tsx
 * ROLE: Settings UI: reading toggles, appearance, theme palettes, preferences, and Offline Audio Downloads.
 */
import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Modal, useWindowDimensions, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { toggleTranslation, setFontSize, setReadingMode, setTextStyle } from '../store/quranSlice';
import { toggleNightMode, setColorTheme, setMushafSplit, togglePlayBasmala, setTutorialDone } from '../store/settingsSlice';
import { startTutorial } from '../tutorial/tutorialRuntime';
import { SPLIT_MIN_WIDTH } from '../utils/mushafLayout';
import { getArabicFont, getThemeColors } from '../utils/theme';
import { RootState } from '../store';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { SURAH_META } from '../utils/surahMeta';
import { downloadSurahAudio, isSurahDownloaded, deleteSurahAudio, clearAllAudioDownloads, cancelSurahDownload } from '../utils/audioDownloader';
import Svg, { Path } from 'react-native-svg';

const IconCheck = ({ c, size = 16 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const IconCheckCircle = ({ c = '#4CAF50', size = 18 }: { c?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Path d="M22 4L12 14.01l-3-3" />
  </Svg>
);

const IconDownload = ({ c = '#FFFFFF', size = 16 }: { c?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M7 10l5 5 5-5" />
    <Path d="M12 15V3" />
  </Svg>
);

const IconChevronDown = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

const PREVIEW_BG = '#16294d';
const PREVIEW_TEXT = '#f5d98a';
const SCRIPT_SAMPLE = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
const SCRIPT_WORD = 'بِسْمِ';

const SCRIPT_OPTIONS = [
  { key: 'uthmani', label: 'Uthmani' },
  { key: 'alqalam', label: 'Indopak' },
  { key: 'lateef', label: 'Tajweed' },
];

const THEME_OPTIONS = [
  { key: 'classic', label: 'Royal Navy', color: '#1C3D72', accent: '#7BA7DB' },
  { key: 'emerald', label: 'Madinah Emerald', color: '#0F4C3A', accent: '#52B788' },
  { key: 'obsidian', label: 'OLED Obsidian', color: '#111114', accent: '#8FA4C4' },
];

const scriptLabel = (key: string) => SCRIPT_OPTIONS.find((o) => o.key === key)?.label || key;

const SettingsScreen = ({ onClose }: { onClose?: () => void } = {}) => {
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const [scriptModal, setScriptModal] = useState(false);
  const [surahPickerModal, setSurahPickerModal] = useState(false);

  // Audio Download State
  const [selectedQari, setSelectedQari] = useState<'ar.alafasy' | 'ar.abdulbasit'>('ar.alafasy');
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [isCurrentDownloaded, setIsCurrentDownloaded] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);

  const { showTranslation, fontSize, readingMode, textStyle } = useSelector((state: RootState) => state.quran);
  const { nightMode, colorTheme = 'classic', mushafSplit, playBasmala } = useSelector((state: RootState) => state.settings);

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const bg = themeColors.bg;
  const cardBg = themeColors.cardBg;
  const cardBorder = themeColors.border;
  const labelColor = themeColors.text;
  const btnBorder = themeColors.border;
  const inactiveText = themeColors.subText;
  const switchFalse = nightMode ? '#333' : '#d0d0d6';

  const checkDownloadStatus = useCallback(async (qari: string, surah: number) => {
    const downloaded = await isSurahDownloaded(qari, surah);
    setIsCurrentDownloaded(downloaded);
  }, []);

  useEffect(() => {
    checkDownloadStatus(selectedQari, selectedSurah);
  }, [selectedQari, selectedSurah, checkDownloadStatus]);

  const handleStartDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: SURAH_META[selectedSurah - 1]?.verses || 1 });

    const result = await downloadSurahAudio(selectedQari, selectedSurah, (current, total) => {
      setDownloadProgress({ current, total });
    });

    setIsDownloading(false);
    setDownloadProgress(null);

    if (result.success) {
      setIsCurrentDownloaded(true);
      Alert.alert('Download Complete', `Surah ${SURAH_META[selectedSurah - 1]?.en || selectedSurah} is ready for offline playback.`);
    } else if (result.error !== 'Download cancelled') {
      Alert.alert('Download Error', result.error || 'Failed to download audio files.');
    }
  };

  const handleDeleteSurah = async () => {
    Alert.alert(
      'Delete Audio',
      `Delete downloaded audio for Surah ${SURAH_META[selectedSurah - 1]?.en}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSurahAudio(selectedQari, selectedSurah);
            setIsCurrentDownloaded(false);
          },
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Offline Audio',
      'This will delete all downloaded offline audio to free up storage space. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllAudioDownloads();
            setIsCurrentDownloaded(false);
            Alert.alert('Success', 'Offline audio cache cleared.');
          },
        },
      ]
    );
  };

  const currentSurahMeta = SURAH_META[selectedSurah - 1] || SURAH_META[0];

  return (
    <View style={[styles(nightMode, themeColors).wrapper, { backgroundColor: bg }]}>
      <ScreenHeader title="Settings" subtitle="Reading & themes" onBack={onClose} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles(nightMode, themeColors).content}>
        {/* Reading Settings */}
        {/* Reading Settings */}
        <View style={[styles(nightMode, themeColors).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={styles(nightMode, themeColors).sectionTitle}>Reading Settings</Text>

          <View style={[styles(nightMode, themeColors).row, readingMode === 'page' && { opacity: 0.5 }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles(nightMode, themeColors).label, { color: labelColor, marginBottom: 2 }]}>Show Translation</Text>
              {readingMode === 'page' && (
                <Text style={{ fontSize: 11, color: themeColors.accent, fontWeight: '600', marginTop: 2 }}>Only available in Ayah List and Continuous modes</Text>
              )}
            </View>
            <Switch
              value={readingMode === 'page' ? false : showTranslation}
              disabled={readingMode === 'page'}
              onValueChange={() => { dispatch(toggleTranslation()); }}
              trackColor={{ false: switchFalse, true: themeColors.accent }}
            />
          </View>

          <Text style={[styles(nightMode, themeColors).label, { color: labelColor }]}>Reading Mode</Text>
          <View style={styles(nightMode, themeColors).modeContainer}>
            {['ayah', 'continuous', 'page'].map((mode) => (
              <TouchableOpacity key={mode} style={[styles(nightMode, themeColors).modeBtn, { borderColor: btnBorder }, readingMode === mode && styles(nightMode, themeColors).activeBtn]} onPress={() => dispatch(setReadingMode(mode))}>
                <Text style={readingMode === mode ? styles(nightMode, themeColors).activeText : [styles(nightMode, themeColors).inactiveText, { color: inactiveText }]}>{mode === 'ayah' ? 'Ayah List' : mode === 'continuous' ? 'Continuous' : 'Page Swipe'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles(nightMode, themeColors).label, { color: labelColor }]}>Arabic Font Size</Text>
          <View style={styles(nightMode, themeColors).sizeContainer}>
            {['small', 'medium', 'large', 'xl'].map((size) => (
              <TouchableOpacity key={size} style={[styles(nightMode, themeColors).sizeBtn, { borderColor: btnBorder }, fontSize === size && styles(nightMode, themeColors).activeBtn]} onPress={() => dispatch(setFontSize(size))}>
                <Text style={fontSize === size ? styles(nightMode, themeColors).activeText : [styles(nightMode, themeColors).inactiveText, { color: inactiveText }]}>{size.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles(nightMode, themeColors).label, { color: labelColor }]}>Quran Script</Text>
          <TouchableOpacity style={styles(nightMode, themeColors).previewWrap} activeOpacity={0.9} onPress={() => setScriptModal(true)}>
            <View style={styles(nightMode, themeColors).previewBox}>
              <Text style={[styles(nightMode, themeColors).previewText, { fontFamily: getArabicFont(textStyle) }]}>{SCRIPT_SAMPLE}</Text>
              <View style={styles(nightMode, themeColors).previewBadge}>
                <Text style={styles(nightMode, themeColors).previewBadgeText}>{scriptLabel(textStyle)}</Text>
              </View>
            </View>
            <View style={[styles(nightMode, themeColors).scriptRow, { borderColor: btnBorder }]}>
              <Text style={[styles(nightMode, themeColors).scriptRowLabel, { color: labelColor }]}>{scriptLabel(textStyle)}</Text>
              <IconChevronDown c={themeColors.accent} size={18} />
            </View>
            <Text style={styles(nightMode, themeColors).legend}>Tap to switch script</Text>
          </TouchableOpacity>
        </View>

        {/* Reading Preferences (Spread View on Tablets) */}
        {width >= SPLIT_MIN_WIDTH && (
          <View style={[styles(nightMode, themeColors).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={styles(nightMode, themeColors).sectionTitle}>Reading Preferences</Text>
            <View style={styles(nightMode, themeColors).row}>
              <View style={styles(nightMode, themeColors).settingInfo}><Text style={[styles(nightMode, themeColors).settingTitle, { color: labelColor }]}>Spread view (two pages side by side)</Text><Text style={styles(nightMode, themeColors).settingDesc}>Show two mushaf pages side by side on tablets</Text></View>
              <Switch value={mushafSplit} onValueChange={(v) => { dispatch(setMushafSplit(v)); }} trackColor={{ false: switchFalse, true: themeColors.accent }} />
            </View>
          </View>
        )}

        {/* Tutorial */}
        <View style={[styles(nightMode, themeColors).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <TouchableOpacity style={styles(nightMode, themeColors).row} activeOpacity={0.7} onPress={() => { dispatch(setTutorialDone(false)); onClose?.(); requestAnimationFrame(() => dispatch(startTutorial())); }}>
            <View style={styles(nightMode, themeColors).settingInfo}><Text style={[styles(nightMode, themeColors).settingTitle, { color: labelColor }]}>Replay Tutorial</Text><Text style={styles(nightMode, themeColors).settingDesc}>Walkthrough of students, highlighting, notes, drawing and more</Text></View>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={themeColors.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 18l6-6-6-6" /></Svg>
          </TouchableOpacity>
        </View>

        {/* Appearance & Themes — Just Above Offline Audio Downloads */}
        <View style={[styles(nightMode, themeColors).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={styles(nightMode, themeColors).sectionTitle}>Appearance & Themes</Text>
          <View style={styles(nightMode, themeColors).row}>
            <View style={styles(nightMode, themeColors).settingInfo}>
              <Text style={[styles(nightMode, themeColors).settingTitle, { color: labelColor }]}>Dark mode</Text>
              <Text style={styles(nightMode, themeColors).settingDesc}>Use dark background and light text</Text>
            </View>
            <Switch value={nightMode} onValueChange={() => { dispatch(toggleNightMode()); }} trackColor={{ false: switchFalse, true: themeColors.accent }} />
          </View>

          <Text style={[styles(nightMode, themeColors).label, { color: labelColor, marginTop: 6 }]}>Color Theme Palette</Text>
          <View style={styles(nightMode, themeColors).modeContainer}>
            {THEME_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles(nightMode, themeColors).modeBtn,
                  { borderColor: btnBorder },
                  colorTheme === t.key && styles(nightMode, themeColors).activeBtn,
                ]}
                onPress={() => dispatch(setColorTheme(t.key))}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.accent, marginBottom: 4 }} />
                <Text numberOfLines={1} style={colorTheme === t.key ? styles(nightMode, themeColors).activeText : [styles(nightMode, themeColors).inactiveText, { color: inactiveText }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Offline Audio Downloads */}
        <View style={[styles(nightMode, themeColors).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={styles(nightMode, themeColors).sectionTitle}>Offline Audio Downloads</Text>
          <Text style={[styles(nightMode, themeColors).settingDesc, { marginBottom: 14 }]}>
            Download surahs for offline listening with zero internet required.
          </Text>

          {/* Qari Selection */}
          <Text style={[styles(nightMode, themeColors).label, { color: labelColor, fontSize: 14 }]}>Select Reciter (Qari)</Text>
          <View style={styles(nightMode, themeColors).modeContainer}>
            <TouchableOpacity
              style={[styles(nightMode, themeColors).modeBtn, { width: '48%', borderColor: btnBorder }, selectedQari === 'ar.alafasy' && styles(nightMode, themeColors).activeBtn]}
              onPress={() => setSelectedQari('ar.alafasy')}
            >
              <Text style={selectedQari === 'ar.alafasy' ? styles(nightMode, themeColors).activeText : [styles(nightMode, themeColors).inactiveText, { color: inactiveText }]}>
                Mishary Al-Afasy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles(nightMode, themeColors).modeBtn, { width: '48%', borderColor: btnBorder }, selectedQari === 'ar.abdulbasit' && styles(nightMode, themeColors).activeBtn]}
              onPress={() => setSelectedQari('ar.abdulbasit')}
            >
              <Text style={selectedQari === 'ar.abdulbasit' ? styles(nightMode, themeColors).activeText : [styles(nightMode, themeColors).inactiveText, { color: inactiveText }]}>
                Abdul Basit
              </Text>
            </TouchableOpacity>
          </View>

          {/* Surah Selector */}
          <Text style={[styles(nightMode, themeColors).label, { color: labelColor, fontSize: 14, marginTop: 4 }]}>Select Surah</Text>
          <TouchableOpacity
            style={[styles(nightMode, themeColors).scriptRow, { borderColor: btnBorder, marginTop: 2, marginBottom: 14 }]}
            onPress={() => setSurahPickerModal(true)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={[styles(nightMode, themeColors).scriptRowLabel, { color: labelColor }]}>
                {selectedSurah}. {currentSurahMeta.en}
              </Text>
              <Text style={[styles(nightMode, themeColors).settingDesc, { fontSize: 12 }]}>
                {currentSurahMeta.verses} ayahs · Juz {currentSurahMeta.startJuz}
              </Text>
            </View>
            <Text style={[styles(nightMode, themeColors).previewText, { fontSize: 20, lineHeight: 28, color: themeColors.gold }]}>
              {currentSurahMeta.ar}
            </Text>
          </TouchableOpacity>

          {/* Download Actions */}
          {isDownloading ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <ActivityIndicator color={themeColors.accent} size="small" />
              <Text style={[styles(nightMode, themeColors).settingDesc, { marginTop: 8, fontWeight: '700' }]}>
                Downloading: {downloadProgress?.current ?? 0} / {downloadProgress?.total ?? 0} ayahs
              </Text>
              <TouchableOpacity
                style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 4 }}
                onPress={() => cancelSurahDownload(selectedSurah)}
              >
                <Text style={{ color: '#FF5252', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : isCurrentDownloaded ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconCheckCircle c="#4CAF50" size={18} />
                <Text style={[styles(nightMode, themeColors).settingTitle, { color: '#4CAF50', fontSize: 14, marginBottom: 0 }]}>Downloaded (Offline Ready)</Text>
              </View>
              <TouchableOpacity style={[styles(nightMode, themeColors).deleteBtn, { backgroundColor: '#FF5252' }]} onPress={handleDeleteSurah}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles(nightMode, themeColors).downloadActionBtn, { backgroundColor: themeColors.primary }]}
              onPress={handleStartDownload}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <IconDownload c="#FFFFFF" size={16} />
                <Text style={[styles(nightMode, themeColors).downloadActionText, { color: '#FFFFFF' }]}>
                  Download Surah {currentSurahMeta.en}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Clear Storage */}
          <TouchableOpacity style={{ marginTop: 18, alignSelf: 'center' }} onPress={handleClearAll}>
            <Text style={{ color: '#888', fontSize: 12.5, textDecorationLine: 'underline' }}>
              Clear all offline audio downloads
            </Text>
          </TouchableOpacity>
        </View>

        {/* Audio Playback & Recitation Options (Bottom Last Option) */}
        <View style={[styles(nightMode, themeColors).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={styles(nightMode, themeColors).sectionTitle}>Audio Recitation Options</Text>
          <View style={[styles(nightMode, themeColors).row, { marginBottom: 0 }]}>
            <View style={styles(nightMode, themeColors).settingInfo}>
              <Text style={[styles(nightMode, themeColors).settingTitle, { color: labelColor }]}>Bismillah before verse 1</Text>
              <Text style={styles(nightMode, themeColors).settingDesc}>Play the Bismillah before the first verse of a surah (except Al-Fatiha and At-Tawbah)</Text>
            </View>
            <Switch value={playBasmala} onValueChange={() => { dispatch(togglePlayBasmala()); }} trackColor={{ false: switchFalse, true: themeColors.accent }} />
          </View>
        </View>
      </ScrollView>

      {/* Script Modal */}
      <Modal visible={scriptModal} transparent animationType="slide" onRequestClose={() => setScriptModal(false)}>
        <TouchableOpacity style={styles(nightMode, themeColors).modalOverlay} activeOpacity={1} onPress={() => setScriptModal(false)}>
          <View style={[styles(nightMode, themeColors).sheet, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={styles(nightMode, themeColors).sheetTitle}>Choose Script</Text>
            {SCRIPT_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.key} style={[styles(nightMode, themeColors).optionRow, { borderColor: btnBorder }]} onPress={() => { dispatch(setTextStyle(opt.key as any)); setScriptModal(false); }}>
                <Text style={[styles(nightMode, themeColors).optionLabel, { color: labelColor }]}>{opt.label}</Text>
                <Text style={[styles(nightMode, themeColors).optionSample, { fontFamily: getArabicFont(opt.key) }]}>{SCRIPT_WORD}</Text>
                {textStyle === opt.key && <IconCheck c={themeColors.accent} size={18} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles(nightMode, themeColors).cancelBtn} onPress={() => setScriptModal(false)}>
              <Text style={styles(nightMode, themeColors).cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Surah Picker Modal for Downloads */}
      <Modal visible={surahPickerModal} transparent animationType="slide" onRequestClose={() => setSurahPickerModal(false)}>
        <View style={styles(nightMode, themeColors).modalOverlay}>
          <View style={[styles(nightMode, themeColors).sheet, { backgroundColor: cardBg, borderColor: cardBorder, maxHeight: '80%' }]}>
            <Text style={styles(nightMode, themeColors).sheetTitle}>Select Surah to Download</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {SURAH_META.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles(nightMode, themeColors).optionRow, { borderColor: btnBorder }]}
                  onPress={() => {
                    setSelectedSurah(s.id);
                    setSurahPickerModal(false);
                  }}
                >
                  <Text style={[styles(nightMode, themeColors).optionLabel, { color: labelColor }]}>
                    {s.id}. {s.en} ({s.verses} ayahs)
                  </Text>
                  <Text style={[styles(nightMode, themeColors).optionSample, { color: themeColors.gold }]}>{s.ar}</Text>
                  {selectedSurah === s.id && <IconCheck c={themeColors.accent} size={18} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles(nightMode, themeColors).cancelBtn} onPress={() => setSurahPickerModal(false)}>
              <Text style={styles(nightMode, themeColors).cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CollapsibleBannerAd />
    </View>
  );
};

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  wrapper: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  section: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 16 },
  sectionTitle: { fontSize: 13.5, fontWeight: '800', color: theme.accent, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 15.5, fontWeight: '600', marginBottom: 10 },
  modeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  modeBtn: { padding: 10, borderWidth: 1, borderRadius: 10, width: '32%', alignItems: 'center', justifyContent: 'center' },
  activeBtn: { backgroundColor: theme.primary, borderColor: theme.primary },
  activeText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  inactiveText: { fontWeight: '600', fontSize: 12 },
  sizeContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  sizeBtn: { padding: 10, borderWidth: 1, borderRadius: 10, width: '23%', alignItems: 'center' },
  previewWrap: { marginBottom: 4 },
  previewBox: { minHeight: 90, borderRadius: 14, backgroundColor: theme.primary, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 18, overflow: 'hidden' },
  previewText: { fontSize: 26, lineHeight: 44, color: theme.gold, textAlign: 'center' },
  previewBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: theme.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  previewBadgeText: { color: theme.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  scriptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  scriptRowLabel: { fontSize: 15, fontWeight: '600' },
  chevron: { color: theme.accent, fontSize: 18, fontWeight: 'bold' },
  legend: { fontSize: 12, color: '#8a8a8a', marginTop: 8, textAlign: 'center' },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: { fontSize: 15.5, fontWeight: '600', marginBottom: 3 },
  settingDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
  downloadActionBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  downloadActionText: { fontWeight: '700', fontSize: 14 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, paddingBottom: 34 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: theme.accent, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 12 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  optionSample: { fontSize: 20, color: theme.gold, marginLeft: 12 },
  optionCheck: { color: theme.accent, fontSize: 18, fontWeight: 'bold', width: 24, textAlign: 'right', marginLeft: 12 },
  cancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
  cancelText: { color: theme.accent, fontSize: 15, fontWeight: '700' },
});

export default memo(SettingsScreen);
