/**
 * FILE: src/screens/SettingsScreen.tsx
 * ROLE: Settings UI: reading toggles that dispatch to quranSlice (showTranslation, fontSize, readingMode, textStyle), display toggles that dispatch to settingsSlice (nightMode, textBrightness, bgBrightness, showPageInfo, mushafSplit), and logout.
 * DEPENDS ON: ../store/quranSlice (toggleTranslation/setFontSize/setReadingMode/setTextStyle, quranSlice.ts:16-21); ../store/settingsSlice (toggleNightMode/setTextBrightness/setBgBrightness/toggleShowPageInfo/setMushafSplit, settingsSlice.ts:16-21); ../utils/mushafLayout SPLIT_MIN_WIDTH (768, mushafLayout.ts:2); ../store RootState; @react-native-community/slider; ../api/auth (logoutUser); ../store/authSlice (logout). Redux only — quranSlice state is NOT persisted; settingsSlice state IS persisted (redux-persist whitelist ['auth','drawing','sync','settings','audio'], src/store/index.ts:16).
 * USED BY: QuranView toolbar `onSettings` (QuranViewScreen.tsx:510).
 */
import React, { memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, useWindowDimensions } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { toggleTranslation, setFontSize, setReadingMode, setTextStyle } from '../store/quranSlice'
import { toggleNightMode, setTextBrightness, setBgBrightness, toggleShowPageInfo, setMushafSplit, togglePlayBasmala } from '../store/settingsSlice'
import { logoutUser } from '../api/auth'
import { logout } from '../store/authSlice'
import { SPLIT_MIN_WIDTH } from '../utils/mushafLayout'
import Slider from '@react-native-community/slider'
import { RootState } from '../store'

/**
 * WHAT: Screen component: three sections of settings controls that dispatch Redux actions on change, plus a logout row. Wrapped in memo().
 * FLOW: 1) useSelector: from state.quran -> showTranslation, fontSize, readingMode, textStyle; from state.settings -> nightMode, textBrightness, bgBrightness, showPageInfo, mushafSplit. 2) "Reading Settings": Show Translation Switch -> toggleTranslation(); Reading Mode segmented ['ayah'|'continuous'|'page'] -> setReadingMode(mode); Arabic Font Size ['small'|'medium'|'large'|'xl'] -> setFontSize(size); Text Style ['saleem'|'uthmani'|'alqalam'|'lateef'] (labels INDOPAK 1/2/3 + UTHMANI) -> setTextStyle(style). 3) "Night Mode": Night mode Switch -> toggleNightMode(); Text brightness Slider 0-255 -> setTextBrightness(Math.round(v)); Background brightness Slider 0-255 -> setBgBrightness(Math.round(v)). 4) "Reading Preferences": Show page info Switch -> toggleShowPageInfo(); Spread view (two pages) Switch rendered ONLY when width >= SPLIT_MIN_WIDTH (768) -> setMushafSplit(v). 5) "Account": Logout button -> await logoutUser() (Firebase signOut) -> dispatch(logout()) (authSlice: user=null, isAuthenticated=false — tears down App.tsx's global sync effect/interval/listener) -> navigation.replace('Login') — mirror of DashboardScreen.tsx:226.
 * CALLS: toggleTranslation / setFontSize / setReadingMode / setTextStyle (quranSlice); toggleNightMode / setTextBrightness / setBgBrightness / toggleShowPageInfo / setMushafSplit (settingsSlice); logoutUser / logout (logout).
 * CALLED BY: React Navigation; via QuranViewScreen.tsx:510.
 * AFFECTS: Redux state.quran (showTranslation, fontSize, readingMode, textStyle) — NOT persisted (quranSlice not in persist whitelist); Redux state.settings (nightMode, textBrightness, bgBrightness, showPageInfo, mushafSplit) — PERSISTED to AsyncStorage via redux-persist; Firebase Auth session + authSlice (logout). Downstream readers: quran values in QuranViewScreen.tsx:108 (page-layout cache key includes textStyle/headerVisible/fs, localDB.ts:20-24); settings in QuranViewScreen.tsx:110/117, VerseDisplay.tsx:11-12, MushafPageView.tsx:50-52, FlowingText.tsx:11-12, AnnotationToolbar.tsx:88, DashboardScreen.tsx:28.
 * NOTES: QARI IS NOT A SETTING HERE — no qari control exists on this screen. Qari lives in audioSlice.currentQari ('Mishary Al-Afasy' default, audioSlice.ts:5), set via QariSelector modal from AudioPlayerBar in QuranView; audio slice IS persisted. showPageInfo toggle persists settingsSlice.showPageInfo but NO component reads it (dead setting; the header overlay renders unconditionally). translationTextSize exists in settingsSlice (settingsSlice.ts:7,19) but has NO UI here and NO dispatcher/reader anywhere (dead state). quranSlice settings reset on every app restart (not whitelisted): showTranslation/fontSize/readingMode/textStyle default back to false/'medium'/'page'/'lateef'. Text style labels are misleading: saleem="INDOPAK 2", alqalam="INDOPAK 1", lateef="INDOPAK 3"; uthmani renders "UTHMANI". Whole screen adapts to nightMode via inline backgroundColor + label colors, but sliders/rows keep fixed styles. Logout mirrors DashboardScreen: logoutUser() is intentionally NOT try/caught — on signOut failure the await rejects, the dispatch+replace do NOT run, and the user stays on Settings with the Firebase session intact (see temp_changes/auth.ts logoutUser NOTES).
 */
const SettingsScreen = ({ navigation }: any) => {
  const dispatch = useDispatch()
  const { width } = useWindowDimensions()
  const { showTranslation, fontSize, readingMode, textStyle } = useSelector((state: RootState) => state.quran)
  const { nightMode, textBrightness, bgBrightness, showPageInfo, mushafSplit, playBasmala } = useSelector((state: RootState) => state.settings)

  return (
    <ScrollView style={[styles.container, { backgroundColor: nightMode ? '#121212' : '#FFFFFF' }]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Settings</Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color: nightMode ? '#fff' : '#000' }]}>Show Translation</Text>
          <Switch value={showTranslation} onValueChange={() => { dispatch(toggleTranslation()) }} trackColor={{ false: '#333', true: '#00d4aa' }} />
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
        <View style={styles.styleContainer}>
          {['saleem', 'uthmani', 'alqalam', 'lateef'].map((style) => (
            <TouchableOpacity key={style} style={[styles.styleBtn, textStyle === style && styles.activeMode]} onPress={() => dispatch(setTextStyle(style as any))}>
              <Text style={textStyle === style ? styles.activeText : styles.inactiveText}>{style === 'alqalam' ? 'INDOPAK 1'
    : style === 'saleem' ? 'INDOPAK 2'
    : style === 'lateef' ? 'INDOPAK 3'
    : style.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Night Mode</Text>
        <View style={styles.row}>
          <View style={styles.settingInfo}><Text style={[styles.settingTitle, { color: nightMode ? '#fff' : '#000' }]}>Night mode</Text><Text style={styles.settingDesc}>Use dark background and light fonts</Text></View>
          <Switch value={nightMode} onValueChange={() => { dispatch(toggleNightMode()) }} trackColor={{ false: '#333', true: '#00d4aa' }} />
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
          <Switch value={showPageInfo} onValueChange={() => { dispatch(toggleShowPageInfo()) }} trackColor={{ false: '#333', true: '#00d4aa' }} />
        </View>
        {width >= SPLIT_MIN_WIDTH && (
          <View style={styles.row}>
            <View style={styles.settingInfo}><Text style={[styles.settingTitle, { color: nightMode ? '#fff' : '#000' }]}>Spread view (two pages side by side)</Text><Text style={styles.settingDesc}>Show two mushaf pages side by side on tablets</Text></View>
            <Switch value={mushafSplit} onValueChange={(v) => { dispatch(setMushafSplit(v)) }} trackColor={{ false: '#333', true: '#00d4aa' }} />
          </View>
        )}
        <View style={styles.row}>
          <View style={styles.settingInfo}><Text style={[styles.settingTitle, { color: nightMode ? '#fff' : '#000' }]}>Basmala before verse 1</Text><Text style={styles.settingDesc}>Play the basmala before the first verse of a surah (except Al-Fatiha and At-Tawbah)</Text></View>
          <Switch value={playBasmala} onValueChange={() => { dispatch(togglePlayBasmala()) }} trackColor={{ false: '#333', true: '#00d4aa' }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          <View style={styles.settingInfo}><Text style={[styles.settingTitle, { color: nightMode ? '#fff' : '#000' }]}>Log out</Text><Text style={styles.settingDesc}>Sign out of this device</Text></View>
          <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await logoutUser(); dispatch(logout()); navigation.replace('Login') }} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#00d4aa', marginBottom: 16, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 10 },
  modeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modeBtn: { padding: 10, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, width: '32%', alignItems: 'center' },
  styleContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 20, gap: 8 },
  styleBtn: { padding: 10, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, width: '30%', alignItems: 'center', marginBottom: 8 },
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
  sliderValue: { fontSize: 14, color: '#00d4aa', width: 40, textAlign: 'right' },
  logoutBtn: { backgroundColor: '#ff4444', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' }
})
export default memo(SettingsScreen)
