/**
 * FILE: src/components/common/DashboardFooter.tsx
 * ROLE: Pinned thin footer on Dashboard (Students List) — exactly 3 buttons in
 *       order Surah Index | Bookmarks | Go to page, rendered above the AdMob banner.
 *       All three actions operate on the pinned "My Quran" student: dispatch
 *       setCurrentStudent(myQuran) before navigating so Bookmarks/SurahIndex/QuranView
 *       read the correct studentData.
 * DEPENDS ON: src/database/localDB.ts (no — purely nav), src/store/studentSlice.ts,
 *             react-native-safe-area-context (insets), react-native-svg (arrow).
 */
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, useWindowDimensions } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { setCurrentStudent } from '../../store/studentSlice';
import { getThemeColors } from '../../utils/theme';

const ArrowRight = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);

export default function DashboardFooter({ myQuran, navigation }: { myQuran: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings.colorTheme || 'classic');
  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);
  const [pageInput, setPageInput] = useState('');
  const n = pageInput !== '' ? parseInt(pageInput, 10) : 0;
  const pageValid = pageInput !== '' && n >= 1 && n <= 610;

  const ensureMyQuran = useCallback(() => {
    if (myQuran?.id) dispatch(setCurrentStudent(myQuran));
  }, [dispatch, myQuran]);

  const handlePageSubmit = useCallback(() => {
    if (!pageValid) return;
    ensureMyQuran();
    navigation.navigate('QuranView' as any, { page: Math.max(1, n - 1) } as any);
    setPageInput('');
    Keyboard.dismiss();
  }, [pageValid, n, ensureMyQuran, navigation]);

  const goSurah = useCallback(() => {
    ensureMyQuran();
    navigation.navigate('SurahIndex' as any);
  }, [ensureMyQuran, navigation]);

  const goBookmarks = useCallback(() => {
    ensureMyQuran();
    navigation.navigate('Bookmarks' as any);
  }, [ensureMyQuran, navigation]);

  const bg = themeColors.cardBg;
  const border = themeColors.border;
  const titleC = themeColors.text;
  const isTablet = useWindowDimensions().width >= 600;

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderTopColor: border, paddingBottom: Math.max(14, insets.bottom + 10), paddingTop: isTablet ? 8 : 4, minHeight: isTablet ? 64 : 54 }]}> 
      <TouchableOpacity style={styles.btn} onPress={goSurah} activeOpacity={0.7}>
        <Text style={[styles.label, { color: titleC, fontSize: isTablet ? 14 : 13 }]} numberOfLines={1}>Surah Index</Text>
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: border }]} />
      <TouchableOpacity style={styles.btn} onPress={goBookmarks} activeOpacity={0.7}>
        <Text style={[styles.label, { color: titleC, fontSize: isTablet ? 14 : 13 }]} numberOfLines={1}>Bookmarks</Text>
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: border }]} />
      <View style={styles.pageCell}>
        <TextInput
          value={pageInput}
          onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="1–610"
          placeholderTextColor={themeColors.subText}
          maxLength={3}
          returnKeyType="go"
          onSubmitEditing={handlePageSubmit}
          style={[styles.pageInput, { color: titleC, borderColor: border, backgroundColor: nightMode ? '#121520' : '#F0EBE0' }]}
        />
        <TouchableOpacity style={[styles.goBtn, { backgroundColor: themeColors.primary, opacity: pageValid ? 1 : 0.35 }]} onPress={handlePageSubmit} disabled={!pageValid} activeOpacity={0.7}>
          <ArrowRight c="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', minHeight: 54, alignItems: 'center', borderTopWidth: 1 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, minHeight: 44 },
  label: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  divider: { width: 1, alignSelf: 'stretch' },
  pageCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, minHeight: 44 },
  pageInput: { width: 82, height: 36, borderRadius: 16, borderWidth: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', paddingHorizontal: 6, includeFontPadding: false, textAlignVertical: 'center' },
  goBtn: { width: 32, height: 32, borderRadius: 16, marginLeft: 6, alignItems: 'center', justifyContent: 'center' },
});
