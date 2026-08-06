/**
 * FILE: src/components/audio/QariSelector.tsx
 * ROLE: Slide-in modal listing the 4 supported reciters grouped by Gapless/Gapped style; selection dispatches setQari and the chosen name lands in audioSlice.currentQari.
 * DEPENDS ON: props visible/onClose; Redux audioSlice.currentQari (for the ✓ checkmark); static QARIS array.
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
 */
const QariSelector = ({ visible, onClose }: any) => {
  const dispatch = useDispatch();
  const { currentQari } = useSelector((s: any) => s.audio);

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select a Qari</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
        </View>
        <SectionList
          sections={[
            { title: 'Gapless', data: QARIS.filter(q => q.style === 'gapless') },
            { title: 'Gapped', data: QARIS.filter(q => q.style === 'gapped') }
          ]}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>{section.title}</Text></View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.qariRow} onPress={() => { dispatch(setQari(item.name)); onClose(); }}>
              <Text style={styles.qariName}>{item.name}</Text>
              {currentQari === item.name && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#2a2a2a' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  closeBtn: { color: '#00d4aa', fontSize: 20 },
  sectionHeader: { padding: 15, backgroundColor: '#1a1a2e' },
  sectionHeaderText: { color: '#00d4aa', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  qariRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#1e1e1e' },
  qariName: { color: '#fff', fontSize: 16 },
  checkmark: { color: '#00d4aa', fontSize: 18, fontWeight: 'bold' }
});
export default memo(QariSelector);
