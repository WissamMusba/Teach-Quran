/**
 * FILE: src/screens/SurahIndexScreen.tsx
 * ROLE: Standalone surah picker opened from the StudentHub — hosts the shared SurahList
 *       modal (visible=true) so a teacher can jump students to any surah / page.
 * DEPENDS ON: src/components/quran/SurahList.tsx (visible/onClose/onSelect/onSelectPage),
 *             Redux settings/student slices, react-native-svg.
 * USED BY: registered as stack screen "SurahIndex" in App.tsx; reached from
 *          StudentHubScreen.tsx (SURAH INDEX row).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import SurahList from '../components/quran/SurahList';

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
);

/**
 * WHAT: Standalone surah picker host — renders SurahList visible (its own full-screen
 *       dark Modal opens over this screen) and forwards selections to QuranView.
 * FLOW: 1) inline header (back + "Teach Quran" + student name) consistent with the hub;
 *       2) SurahList visible=true: onSelect(id) -> QuranView { surahId, scrollToVerse: 1 }
 *       (verse 1 so the reader lands on the surah's actual start page — a bare
 *       { surahId } param resolves getVersePage(id, undefined) to page 1);
 *       onSelectPage(pg) -> QuranView { page }; onClose -> goBack (the modal's Close).
 * CALLS: navigation.navigate('QuranView', ...) — same params contract QuranViewScreen
 *        consumes (QuranViewScreen.tsx params effect).
 * CALLED BY: React Navigation (registered in the root stack; opened via StudentHubScreen).
 * AFFECTS: navigation only.
 * NOTES: SurahList this old version has NO `mode` prop — only {visible, onClose,
 *        onSelect, onSelectPage}. The modal covers the whole screen, so the inline
 *        header beneath it is cosmetic (shown during the slide-in/fade) but keeps the
 *        hub's look consistent.
 */
export default function SurahIndexScreen({ navigation }: any) {
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const studentName = useSelector((s: any) => s.student.currentStudent?.name);
  const isDark = nightMode;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5' }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#22223a' : '#ffffff', borderBottomColor: isDark ? '#2a2a4a' : '#e0e0e4' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c="#00d4aa" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#1a1a1a' }]}>Teach Quran</Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#8a8a8a' : '#777777' }]} numberOfLines={1}>{studentName || 'Select Surah'}</Text>
        </View>
      </View>
      <SurahList
        visible
        onClose={() => navigation.goBack()}
        onSelect={(id: number) => navigation.navigate('QuranView' as any, { surahId: id, scrollToVerse: 1 } as any)}
        onSelectPage={(pg: number) => navigation.navigate('QuranView' as any, { page: pg } as any)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
});