import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import Slider from '@react-native-community/slider';
import { toggleNightMode, setTextBrightness, setBgBrightness, toggleShowPageInfo } from '../store/settingsSlice';
import { setFontSize, setReadingMode, setTextStyle } from '../store/quranSlice';
import { COLORS, SPACING, RADIUS, scaleFont } from '../utils/theme';
export default function SettingsScreen() {
  const dispatch = useDispatch();
  const { nightMode, textBrightness, bgBrightness, showPageInfo } = useSelector((s: any) => s.settings);
  const { fontSize, readingMode, textStyle } = useSelector((s: any) => s.quran);
  const Section = ({ title, children }: any) => (<View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.sectionContent}>{children}</View></View>);
  const Row = ({ label, children }: any) => (<View style={styles.row}><Text style={styles.rowLabel}>{label}</Text>{children}</View>);
  const Pills = ({ options, value, onChange }: any) => (<View style={styles.pillRow}>{options.map((o: any) => (<TouchableOpacity key={o.value} style={[styles.pill, value === o.value && styles.pillActive]} onPress={() => onChange(o.value)} activeOpacity={0.7}><Text style={[styles.pillText, value === o.value && styles.pillTextActive]}>{o.label}</Text></TouchableOpacity>))}</View>);
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.title}>⚙️ Settings</Text>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl }} showsVerticalScrollIndicator={false}>
        <Section title="Appearance">
          <Row label="Night Mode"><Switch value={nightMode} onValueChange={() => dispatch(toggleNightMode())} trackColor={{ true: COLORS.primary, false: '#555' }} thumbColor="#fff" /></Row>
          <Row label={`Text Brightness: ${textBrightness}`}><Slider style={styles.slider} value={textBrightness} minimumValue={50} maximumValue={255} onValueChange={(v: number) => dispatch(setTextBrightness(Math.round(v)))} minimumTrackTintColor={COLORS.primary} maximumTrackTintColor="#444" thumbTintColor={COLORS.primary} /></Row>
          <Row label={`Background: ${bgBrightness}`}><Slider style={styles.slider} value={bgBrightness} minimumValue={0} maximumValue={60} onValueChange={(v: number) => dispatch(setBgBrightness(Math.round(v)))} minimumTrackTintColor={COLORS.primary} maximumTrackTintColor="#444" thumbTintColor={COLORS.primary} /></Row>
        </Section>
        <Section title="Arabic Text">
          <Row label="Font Size"><Pills options={[{ label: 'S', value: 'small' }, { label: 'M', value: 'medium' }, { label: 'L', value: 'large' }, { label: 'XL', value: 'xl' }]} value={fontSize} onChange={(v: string) => dispatch(setFontSize(v))} /></Row>
          <Row label="Script Style"><Pills options={[{ label: 'IndoPak', value: 'indopak' }, { label: 'Uthmani', value: 'uthmani' }, { label: 'Naskh', value: 'naskh' }]} value={textStyle} onChange={(v: string) => dispatch(setTextStyle(v))} /></Row>
        </Section>
        <Section title="Reading Mode"><Pills options={[{ label: '📋 Ayah', value: 'ayah' }, { label: '📜 Continuous', value: 'continuous' }, { label: '📖 Page', value: 'page' }]} value={readingMode} onChange={(v: string) => dispatch(setReadingMode(v))} /></Section>
        <Section title="Other"><Row label="Show Page Info"><Switch value={showPageInfo} onValueChange={() => dispatch(toggleShowPageInfo())} trackColor={{ true: COLORS.primary, false: '#555' }} thumbColor="#fff" /></Row></Section>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  title: { fontSize: scaleFont(24), fontWeight: '800', color: COLORS.textPrimary, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.sm },
  section: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, marginBottom: SPACING.lg, overflow: 'hidden' },
  sectionTitle: { color: COLORS.primary, fontSize: scaleFont(13), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  sectionContent: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderDark },
  rowLabel: { color: COLORS.textPrimary, fontSize: scaleFont(15) }, slider: { width: 160, height: 40 },
  pillRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  pill: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'transparent' },
  pillActive: { backgroundColor: 'rgba(0,212,170,0.15)', borderColor: COLORS.primary },
  pillText: { color: COLORS.textSecondary, fontSize: scaleFont(14), fontWeight: '600' }, pillTextActive: { color: COLORS.primary },
});
