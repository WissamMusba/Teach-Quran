/**
 * FILE: src/components/audio/QariSelector.tsx
 * ROLE: Slide-in modal listing the 4 supported reciters with full theme palette support.
 */
import React, { memo, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setQari } from '../../store/audioSlice';
import { getThemeColors } from '../../utils/theme';

const QARIS = [
  { id: 'mishary', name: 'Mishary Al-Afasy', style: 'gapped' },
  { id: 'abdulbasit', name: 'Abd Al-Basit', style: 'gapless' },
  { id: 'ayyoub', name: 'Muhammad Ayyoub', style: 'gapped' },
  { id: 'suwaid', name: 'Dr. Ayman Suwaid', style: 'gapped' },
];

const QariSelector = ({ visible, onClose }: any) => {
  const dispatch = useDispatch();
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const { currentQari } = useSelector((s: any) => s.audio);

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const containerBg = themeColors.bg;
  const headerBg = themeColors.cardBg;
  const border = themeColors.border;
  const text = themeColors.text;
  const sectionBg = nightMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const sectionText = themeColors.accent;
  const rowColor = themeColors.text;
  const closeColor = themeColors.accent;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: containerBg }]}>
        <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: border }]}>
          <Text style={[styles.title, { color: text }]}>Select a Qari</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.closeBtn, { color: closeColor }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <SectionList
          sections={[
            { title: 'Gapless', data: QARIS.filter(q => q.style === 'gapless') },
            { title: 'Gapped', data: QARIS.filter(q => q.style === 'gapped') }
          ]}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: sectionBg }]}>
              <Text style={[styles.sectionHeaderText, { color: sectionText }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.qariRow, { borderBottomColor: border }]} onPress={() => { dispatch(setQari(item.name)); onClose(); }} activeOpacity={0.7}>
              <Text style={[styles.qariName, { color: rowColor }]}>{item.name}</Text>
              {currentQari === item.name && <Text style={[styles.checkmark, { color: themeColors.accent }]}>✓</Text>}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { fontSize: 20, fontWeight: '700' },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  qariRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  qariName: { fontSize: 16, fontWeight: '500' },
  checkmark: { fontSize: 18, fontWeight: 'bold' }
});

export default memo(QariSelector);
