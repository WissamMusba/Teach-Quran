/**
 * FILE: src/screens/SurahIndexScreen.tsx
 * ROLE: Standalone surah picker host with full dynamic theme palette support.
 */
import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler } from 'react-native';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import SurahList from '../components/quran/SurahList';
import { getThemeColors } from '../utils/theme';

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
);

export default function SurahIndexScreen({ navigation }: any) {
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const studentName = useSelector((s: any) => s.student.currentStudent?.name);
  const isDark = !!nightMode;

  const themeColors = useMemo(() => getThemeColors(colorTheme, isDark), [colorTheme, isDark]);

  const pickedRef = useRef(false);
  const pick = (params: any) => { 
    pickedRef.current = true; 
    navigation.navigate('QuranView' as any, params as any); 
  };

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('StudentHub');
    }
    return true;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => sub.remove();
    }, [handleBack])
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <View style={[styles.header, { backgroundColor: themeColors.headerBg, borderBottomColor: themeColors.headerBorder }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c={themeColors.accent} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Teach Quran</Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.subText }]} numberOfLines={1}>{studentName || 'Select Surah'}</Text>
        </View>
      </View>
      <SurahList
        visible
        onClose={handleBack}
        onSelect={(id) => pick({ surahId: id, scrollToVerse: 1 })}
        onSelectPage={(page) => pick({ page })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  headerTextWrap: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 13, marginTop: 1, fontWeight: '500' },
});
