import React, { useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../components/common/ScreenHeader';
import SurahList from '../components/quran/SurahList';
import { SURAH_PAGE_RANGE } from '../utils/surahMeta';
import { getThemeColors } from '../utils/theme';

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
      <ScreenHeader
        title="Surah Index"
        subtitle={studentName || 'Select Surah'}
        onBack={handleBack}
      />
      <SurahList
        inline
        visible
        onClose={handleBack}
        onSelect={(id) => {
          const startPage = SURAH_PAGE_RANGE[id - 1]?.[0] || 1;
          pick({ page: startPage });
        }}
        onSelectPage={(page) => pick({ page })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

