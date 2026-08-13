/**
 * FILE: src/components/audio/QariSelector.tsx
 * ROLE: Slide-in modal listing the 4 supported reciters grouped by Gapless/Gapped style; selection dispatches setQari and the chosen name lands in audioSlice.currentQari. Theme-aware: colors follow settings.nightMode.
 * DEPENDS ON: props visible/onClose; Redux audioSlice.currentQari (for the ✓ checkmark) + settings.nightMode (theme); static QARIS array.
 * USED BY: src/screens/QuranViewScreen.tsx:631 — `<QariSelector visible={showQariModal} onClose={...} />`, opened via AudioPlayerBar's onOpenQari (line 628).
 */
import React, { memo } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setQari } from '../../store/audioSlice';

// The 4 supported reciters. `style` ('gapped'/'gapless') is used ONLY for section grouping —
// it never influences playback behavior.
const QARIS = [
  { id: 'mishary', name: 'Mishary Al-Afasy', style: 'gapped' },
  { id: 'abdulbasit', name: 'Abd Al-Basit', style: 'gapless' },
  { id: 'ayyoub', name: 'Muhammad Ayyoub', style: 'gapped' },
  { id: 'suwaid', name: 'Dr. Ayman Suwaid', style: 'gapped' },
];

/**
 * QariSelector (memoized) — full-screen slide-in Modal with a SectionList of reciters.
 * WHAT: Groups QARIS into "Gapless" (Abd Al-Basit) and "Gapped" (Mishary, Ayyoub, Suwaid) sections;
 *       tapping a row dispatches setQari(item.name), closes the modal, and ✓ marks the current pick.
 * FLOW: 1) rows = QARIS filtered by style into two sections; 2) renderItem onPress -> dispatch(setQari(item.name)) + onClose();
 *       3) currentQari === item.name renders the ✓ checkmark.
 * PROPS: visible — modal visibility; onClose — dismiss callback.
 * CALLS: dispatch(setQari(item.name)) -> audioSlice.currentQari (store/audioSlice.ts:17).
 * CALLED BY: QuranViewScreen.tsx:631 (showQariModal toggled at line 628 via AudioPlayerBar's qari area / expand button).
 * AFFECTS: Redux audioSlice.currentQari (default 'Mishary Al-Afasy') — consumed by QuranViewScreen's playback
 *          (startPlayFromVerse/togglePlayAudio) to pick the reciter ID and displayed by AudioPlayerBar.
 * NOTES: Only the NAME is stored. The audio engine maps name -> qariId with a binary
 *        `currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit'` test (QuranViewScreen.tsx:452,475),
 *        so Ayyoub and Suwaid BOTH fall back to ar.abdulbasit — they always play Basit audio, and
 *        Abd Al-Basit maps correctly only by luck of that test. 4 selectable qaris, binary playback.
 *        Colors switch on settings.nightMode: dark uses '#121212'/#1a1a2e/#fff, light uses '#ffffff'/#f5f5f7/#1a1a1a.
 */
const QariSelector = ({ visible, onClose }: any) => {
  const dispatch = useDispatch();
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const { currentQari } = useSelector((s: any) => s.audio);

  const containerBg = nightMode ? '#121212' : '#ffffff';
  const headerBg = nightMode ? '#1a1a2e' : '#f5f5f7';
  const border = nightMode ? '#2a2a2a' : '#e8e8e4';
  const text = nightMode ? '#fff' : '#1a1a1a';
  const sectionBg = nightMode ? '#1a1a2e' : '#f0f2f7';
  const sectionText = nightMode ? '#7BA7DB' : '#006e5c';
  const rowColor = nightMode ? '#fff' : '#1a1a1a';
  const closeColor = nightMode ? '#7BA7DB' : '#006e5c';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles(nightMode).container, { backgroundColor: containerBg }]}>
        <View style={[styles(nightMode).header, { backgroundColor: headerBg, borderColor: border }]}>
          <Text style={[styles(nightMode).title, { color: text }]}>Select a Qari</Text>
          <TouchableOpacity onPress={onClose}><Text style={[styles(nightMode).closeBtn, { color: closeColor }]}>✕</Text></TouchableOpacity>
        </View>
        <SectionList
          sections={[
            { title: 'Gapless', data: QARIS.filter(q => q.style === 'gapless') },
            { title: 'Gapped', data: QARIS.filter(q => q.style === 'gapped') }
          ]}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={[styles(nightMode).sectionHeader, { backgroundColor: sectionBg }]}><Text style={[styles(nightMode).sectionHeaderText, { color: sectionText }]}>{section.title}</Text></View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles(nightMode).qariRow, { borderColor: border }]} onPress={() => { dispatch(setQari(item.name)); onClose(); }}>
              <Text style={[styles(nightMode).qariName, { color: rowColor }]}>{item.name}</Text>
              {currentQari === item.name && <Text style={styles(nightMode).checkmark}>✓</Text>}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
};

const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { fontSize: 20 },
  sectionHeader: { padding: 15 },
  sectionHeaderText: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  qariRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  qariName: { fontSize: 16 },
  checkmark: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), fontSize: 18, fontWeight: 'bold' }
});
export default memo(QariSelector);