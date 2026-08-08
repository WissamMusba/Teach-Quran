/**
 * FILE: src/screens/JuzIndexScreen.tsx
 * ROLE: Standalone juz/para index (30 entries) opened from the StudentHub — tapping a
 *       para deep-links into QuranView at that para's start (surah/verse).
 * DEPENDS ON: src/utils/theme.ts (JUZ_MAP — entries {j, s, v}), Redux settings/student
 *             slices, react-native-svg.
 * USED BY: registered as stack screen "JuzIndex" in App.tsx; reached from
 *          StudentHubScreen.tsx (JUZ/PARA INDEX row).
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { JUZ_MAP } from '../utils/theme';

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
);

/**
 * WHAT: Standalone juz/para index — a FlatList over the 30 JUZ_MAP boundaries. Tapping
 *       a para navigates to QuranView at its start verse ({ surahId, scrollToVerse }).
 * FLOW: 1) inline header (back + "Teach Quran" + student name) consistent with the hub;
 *       2) FlatList of JUZ_MAP — each row "Para {j}" / "Starts at Surah {s}, Verse {v}".
 * CALLS: navigation.navigate('QuranView', { surahId, scrollToVerse }).
 * CALLED BY: React Navigation (registered in the root stack; opened via StudentHubScreen).
 * AFFECTS: navigation only.
 * NOTES: Built inline — the shared SurahList has no juz mode, so the 30 paras are
 *        rendered here directly from JUZ_MAP.
 */
export default function JuzIndexScreen({ navigation }: any) {
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const studentName = useSelector((s: any) => s.student.currentStudent?.name);
  const isDark = nightMode;

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={[styles.row, { backgroundColor: isDark ? '#22223a' : '#ffffff', borderBottomColor: isDark ? '#2a2a4a' : '#e0e0e4' }]}
      onPress={() => navigation.navigate('QuranView' as any, { surahId: item.s, scrollToVerse: item.v } as any)} activeOpacity={0.7}>
      <Text style={styles.rowNum}>{item.j}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: isDark ? '#ffffff' : '#1a1a1a' }]}>Para {item.j}</Text>
        <Text style={[styles.rowSub, { color: isDark ? '#8a8a8a' : '#777777' }]}>Starts at Surah {item.s}, Verse {item.v}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5' }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#22223a' : '#ffffff', borderBottomColor: isDark ? '#2a2a4a' : '#e0e0e4' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c="#00d4aa" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#1a1a1a' }]}>Teach Quran</Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#8a8a8a' : '#777777' }]} numberOfLines={1}>{studentName || 'Select Para'}</Text>
        </View>
      </View>
      <FlatList data={JUZ_MAP} keyExtractor={(item: any) => String(item.j)} renderItem={renderItem} />
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
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowNum: { color: '#00d4aa', fontSize: 18, fontWeight: '700', width: 34 },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 18, fontWeight: '700' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
});