/**
 * FILE: src/components/common/ScreenHeader.tsx
 * ROLE: Shared premium top header for sub-screens (Settings / Bookmarks / Mistakes / Notes / Indexes).
 *       Full dynamic theme integration (Classic, Emerald, Obsidian).
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { getThemeColors } from '../../utils/theme';

const IconBack = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 4.5L7.5 12l7.5 7.5" />
  </Svg>
);

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

const ScreenHeader = ({ title, subtitle, onBack }: Props) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const goBack = onBack || (() => navigation.goBack());
  const bg = themeColors.headerBg;
  const border = themeColors.headerBorder;
  const titleColor = themeColors.text;
  const subColor = themeColors.subText;
  const accent = themeColors.accent;

  return (
    <View style={[styles(nightMode, themeColors).container, { backgroundColor: bg, borderBottomColor: border, paddingTop: Math.max(10, insets.top + 8) }]}>
      <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles(nightMode, themeColors).backBtn}>
        <IconBack c={accent} />
      </TouchableOpacity>
      <View style={styles(nightMode, themeColors).textWrap}>
        <Text style={[styles(nightMode, themeColors).title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles(nightMode, themeColors).subtitle, { color: subColor }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[styles(nightMode, themeColors).accentDot, { backgroundColor: accent }]} />
    </View>
  );
};

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  textWrap: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  accentDot: { width: 10, height: 10, borderRadius: 5, marginRight: 14, opacity: 0.9 },
});

export default React.memo(ScreenHeader);
