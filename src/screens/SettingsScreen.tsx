import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { toggleTranslation, setFontSize, setReadingMode, setTextStyle } from '../store/quranSlice';
import { toggleNightMode, setTextBrightness, setBgBrightness, toggleShowPageInfo } from '../store/settingsSlice';
import Slider from '@react-native-community/slider';
import { RootState } from '../store';

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const { showTranslation, fontSize, readingMode, textStyle } = useSelector((state: RootState) => state.quran);
  const { nightMode, textBrightness, bgBrightness, showPageInfo } = useSelector((state: RootState) => state.settings);

  return (
    <ScrollView style={[styles.container, { backgroundColor: nightMode ? '#121212' : '#FFFFFF' }]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Settings</Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color: nightMode ? '#fff' : '#000' }]}>Show Translation</Text>
          <Switch value={showTranslation} onValueChange={() => dispatch(toggleTranslation())} trackColor={{ false: '#333', true: '#00d4aa' }} />
        </View>
        <Text style={[styles.label, { color: nightMode ? '#fff' : '#000' }]}>Reading Mode</Text>
        <View style={styles.modeContainer}>
          {['ayah', 'continuous', 'page'].map((mode) => (
            <TouchableOpacity key={mode} style={[styles.modeBtn, readingMode === mode && styles.activeMode]} onPress={() => dispatch(setReadingMode(mode))}>
              <Text style={readingMode === mode ? styles.activeText : styles.inactiveText}>{mode === 'ayah' ? 'Ayah List' : mode === 'continuous' ? 'Continuous' : 'Page Swipe'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.label, { color: nightMode ? '#fff' : '#000' }]}>Arabic Font Size</Text>
        <View style={styles.sizeContainer}>
          {['small', 'medium', 'large', 'xl'].map((size) => (
            <TouchableOpacity key={size} style={[styles.sizeBtn, fontSize === size && styles.activeSize]} onPress={() => dispatch(setFontSize(size))}>
              <Text style={fontSize === size ? styles.activeText : styles.inactiveText}>{size.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.label, { color: nightMode ? '#fff' : '#000' }]}>Text Style</Text>
        <View style={styles.modeContainer}>
          {['indopak', 'uthmani'].map((style) => (
            <TouchableOpacity key={style} style={[styles.modeBtnWide, textStyle === style && styles.activeMode]} onPress={() => dispatch(setTextStyle(style))}>
              <Text style={textStyle === style ? styles.activeText : styles.inactiveText}>{style}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Night Mode</Text>
        <View style={styles.row}>
          <View style={styles.settingInfo}><Text style={[styles.settingTitle, { color: nightMode ? '#fff' : '#000' }]}>Night mode</Text><Text style={styles.settingDesc}>Use dark background and light fonts</Text></View>
          <Switch value={nightMode} onValueChange={() => dispatch(toggleNightMode())} trackColor={{ false: '#333', true: '#00d4aa' }} />
        </View>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Text brightness</Text>
          <Slider style={{ flex: 1 }} value={textBrightness} onValueChange={(v) => dispatch(setTextBrightness(Math.round(v)))} minimumValue={0} maximumValue={255} minimumTrackTintColor="#00d4aa" thumbTintColor="#00d4aa" />
          <Text style={styles.sliderValue}>{textBrightness}</Text>
        </View>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Background brightness</Text>
          <Slider style={{ flex: 1 }} value={bgBrightness} onValueChange={(v) => dispatch(setBgBrightness(Math.round(v)))} minimumValue={0} maximumValue={255} minimumTrackTintColor="#00d4aa" thumbTintColor="#00d4aa" />
          <Text style={styles.sliderValue}>{bgBrightness}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Preferences</Text>
        <View style={styles.row}>
          <View style={styles.settingInfo}><Text style={[styles.settingTitle, { color: nightMode ? '#fff' : '#000' }]}>Show page info</Text><Text style={styles.settingDesc}>Overlay page number, surah name, and juz' number while reading</Text></View>
          <Switch value={showPageInfo} onValueChange={() => dispatch(toggleShowPageInfo())} trackColor={{ false: '#333', true: '#00d4aa' }} />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#00d4aa', marginBottom: 16, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 10 },
  modeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modeBtn: { padding: 10, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, width: '32%', alignItems: 'center' },
  modeBtnWide: { padding: 10, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, width: '48%', alignItems: 'center' },
  activeMode: { backgroundColor: '#00d4aa', borderColor: '#00d4aa' },
  sizeContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  sizeBtn: { padding: 10, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, width: '23%', alignItems: 'center' },
  activeSize: { backgroundColor: '#00d4aa', borderColor: '#00d4aa' },
  activeText: { color: '#121212', fontWeight: 'bold' }, inactiveText: { color: '#b0b0b0' },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  settingDesc: { fontSize: 14, color: '#888', lineHeight: 20 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  sliderLabel: { fontSize: 14, color: '#888', width: 120 },
  sliderValue: { fontSize: 14, color: '#00d4aa', width: 40, textAlign: 'right' }
});
export default memo(SettingsScreen);
