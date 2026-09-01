/**
 * FILE: src/screens/JuzIndexScreen.tsx
 * ROLE: Standalone juz/para index (30 entries) with full theme palette support.
 */
import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { JUZ_MAP, JUZ_NAMES, getArabicFont, getThemeColors } from '../utils/theme';

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
);

export default function JuzIndexScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const studentName = useSelector((s: any) => s.student.currentStudent?.name);
  const isDark = !!nightMode;
  const isTablet = useWindowDimensions().width >= 600;
  const arabicFont = getArabicFont(textStyle);

  const themeColors = useMemo(() => getThemeColors(colorTheme, isDark), [colorTheme, isDark]);

  const renderItem = ({ item }: any) => {
    const juzInfo = JUZ_NAMES[item.j - 1] || { ur: '', en: '' };
    const surahName = surahNames?.[item.s] || `Surah ${item.s}`;

    return (
      <TouchableOpacity
        style={[
          styles(isDark, themeColors).row,
          {
            backgroundColor: themeColors.cardBg,
            borderBottomColor: themeColors.border,
            paddingVertical: isTablet ? 14 : 10,
          }
        ]}
        onPress={() => navigation.navigate('QuranView' as any, { surahId: item.s, scrollToVerse: item.v } as any)}
        activeOpacity={0.7}
      >
        <View style={[styles(isDark, themeColors).numBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
          <Text style={[styles(isDark, themeColors).rowNum, { color: themeColors.accent }]}>{item.j}</Text>
        </View>

        <View style={styles(isDark, themeColors).rowBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles(isDark, themeColors).rowLabel, { color: themeColors.text }]}>
              Para {item.j}
            </Text>
            {juzInfo.en ? (
              <Text style={[styles(isDark, themeColors).rowTranslit, { color: themeColors.subText }]}>
                {' · '}{juzInfo.en}
              </Text>
            ) : null}
          </View>
          <Text style={[styles(isDark, themeColors).rowSub, { color: themeColors.subText }]}>
            Starts at {surahName} (Ayat {item.v})
          </Text>
        </View>

        {juzInfo.ur ? (
          <Text style={[styles(isDark, themeColors).rowUrdu, { fontFamily: arabicFont, color: themeColors.gold }]}>
            {juzInfo.ur}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles(isDark, themeColors).container, { backgroundColor: themeColors.bg }]}>
      <View style={[styles(isDark, themeColors).header, { backgroundColor: themeColors.headerBg, borderBottomColor: themeColors.headerBorder, paddingTop: Math.max(10, insets.top + 8) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles(isDark, themeColors).backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c={themeColors.accent} />
        </TouchableOpacity>
        <View style={styles(isDark, themeColors).headerTextWrap}>
          <Text style={[styles(isDark, themeColors).headerTitle, { color: themeColors.text }]}>Juz / Para Index</Text>
          <Text style={[styles(isDark, themeColors).headerSubtitle, { color: themeColors.subText }]}>{studentName || 'All 30 Paras'}</Text>
        </View>
      </View>

      <FlatList
        data={JUZ_MAP}
        keyExtractor={(item) => `juz-${item.j}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      />
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  headerTextWrap: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 13, marginTop: 1, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1 },
  numBadge: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowNum: { fontSize: 14, fontWeight: '800' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15.5, fontWeight: '700' },
  rowTranslit: { fontSize: 13.5, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowUrdu: { fontSize: 21, fontWeight: 'bold', marginLeft: 10 },
});
