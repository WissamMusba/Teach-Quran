/**
 * FILE: src/screens/JuzIndexScreen.tsx
 * ROLE: Standalone juz/para index (30 entries) opened from the StudentHub — tapping a
 *       para deep-links into QuranView at that para's start (surah/verse).
 * DEPENDS ON: src/utils/theme.ts (JUZ_MAP, JUZ_NAMES), Redux settings/student
 *             slices, react-native-svg.
 * USED BY: registered as stack screen "JuzIndex" in App.tsx; reached from
 *          StudentHubScreen.tsx (JUZ/PARA INDEX row).
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { JUZ_MAP, JUZ_NAMES, getArabicFont } from '../utils/theme';

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
);

export default function JuzIndexScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const studentName = useSelector((s: any) => s.student.currentStudent?.name);
  const isDark = !!nightMode;
  const isTablet = useWindowDimensions().width >= 600;
  const arabicFont = getArabicFont(textStyle);

  const renderItem = ({ item }: any) => {
    const juzInfo = JUZ_NAMES[item.j - 1] || { ur: '', en: '' };
    const surahName = surahNames?.[item.s] || `Surah ${item.s}`;

    return (
      <TouchableOpacity
        style={[
          styles(nightMode).row,
          {
            backgroundColor: isDark ? '#1C202E' : '#FAF7EE',
            borderBottomColor: isDark ? '#2B3145' : '#EAE4D4',
            paddingVertical: isTablet ? 14 : 10,
          }
        ]}
        onPress={() => navigation.navigate('QuranView' as any, { surahId: item.s, scrollToVerse: item.v } as any)}
        activeOpacity={0.7}
      >
        {/* Juz Number Badge */}
        <View style={[styles(nightMode).numBadge, { backgroundColor: isDark ? '#28334E' : '#E8E1CF' }]}>
          <Text style={[styles(nightMode).rowNum, { color: isDark ? '#93BCF0' : '#1C3D72' }]}>{item.j}</Text>
        </View>

        {/* English & Start Info */}
        <View style={styles(nightMode).rowBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles(nightMode).rowLabel, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
              Para {item.j}
            </Text>
            {juzInfo.en ? (
              <Text style={[styles(nightMode).rowTranslit, { color: isDark ? '#93A4C7' : '#5E6D8A' }]}>
                {' · '}{juzInfo.en}
              </Text>
            ) : null}
          </View>
          <Text style={[styles(nightMode).rowSub, { color: isDark ? '#8E95A8' : '#7D7667' }]}>
            Starts at {surahName} (Ayat {item.v})
          </Text>
        </View>

        {/* Urdu/Arabic Para Name */}
        {juzInfo.ur ? (
          <Text style={[styles(nightMode).urduName, { color: isDark ? '#E2C275' : '#8C6D15', fontFamily: arabicFont }]}>
            {juzInfo.ur}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles(nightMode).container, { backgroundColor: isDark ? '#10121A' : '#F3EFE4', paddingBottom: insets.bottom }]}>
      <View style={[styles(nightMode).header, { backgroundColor: isDark ? '#171A24' : '#FAF7EE', borderBottomColor: isDark ? '#242838' : '#E2DDD0', paddingTop: Math.max(10, insets.top + 8) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles(nightMode).backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c={(nightMode ? '#7BA7DB' : '#1C3D72')} />
        </TouchableOpacity>
        <View style={styles(nightMode).headerTextWrap}>
          <Text style={[styles(nightMode).headerTitle, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>Para Index</Text>
          <Text style={[styles(nightMode).headerSubtitle, { color: isDark ? '#8E95A8' : '#7D7667' }]} numberOfLines={1}>{studentName || 'Select Para'}</Text>
        </View>
      </View>
      <FlatList
        data={JUZ_MAP}
        keyExtractor={(item: any) => String(item.j)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 16, borderBottomWidth: 1 },
  numBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowNum: { fontSize: 16, fontWeight: '800' },
  rowBody: { flex: 1, justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '800' },
  rowTranslit: { fontSize: 13.5, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  urduName: { fontSize: 22, fontWeight: '700', marginLeft: 10, textAlign: 'right' },
});
