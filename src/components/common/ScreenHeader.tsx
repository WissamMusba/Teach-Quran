/**
 * FILE: src/components/common/ScreenHeader.tsx
 * ROLE: Shared premium top header for the sub-screens that previously used the
 *       default native stack header (Settings / Bookmarks / Mistakes / Notes).
 *       Shows a polished title + optional subtitle with a theme-aware back button.
 * DEPENDS ON: Redux s.settings.nightMode (self-reads the theme), react-navigation
 *             (onBack default = navigation.goBack()).
 * USED BY: SettingsScreen, BookmarksScreen, MistakesScreen, NotesScreen.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';

const ACCENT = (nightMode ? '#7BA7DB' : '#1C3D72');

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
  const navigation = useNavigation<any>();
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const goBack = onBack || (() => navigation.goBack());
  const bg = nightMode ? '#1a1a2e' : '#f5f5f5';
  const border = nightMode ? '#2a2a4a' : '#e0e0e4';
  const titleColor = nightMode ? '#fff' : '#1a1a1a';
  const subColor = nightMode ? '#8a8a8a' : '#777';

  return (
    <View style={[styles.container, { backgroundColor: bg, borderBottomColor: border }]}>
      <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.backBtn}>
        <IconBack c={ACCENT} />
      </TouchableOpacity>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.accentDot} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  textWrap: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  accentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT, marginRight: 14, opacity: 0.9 },
});

export default React.memo(ScreenHeader);