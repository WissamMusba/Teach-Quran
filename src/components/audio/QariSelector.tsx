import React, { memo } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setQari } from '../../store/audioSlice';
import { COLORS, SPACING, RADIUS, scaleFont } from '../../utils/theme';

const QARIS = [
  { id: 'mishary', name: 'Mishary Al-Afasy', style: 'gapped' },
  { id: 'abdulbasit', name: 'Abd Al-Basit', style: 'gapless' },
  { id: 'ayyoub', name: 'Muhammad Ayyoub', style: 'gapped' },
  { id: 'suwaid', name: 'Dr. Ayman Suwaid', style: 'gapped' },
];

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
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, borderBottomWidth: 1, borderColor: COLORS.borderDark },
  title: { fontSize: scaleFont(20), fontWeight: 'bold', color: COLORS.textPrimary },
  closeBtn: { color: COLORS.primary, fontSize: scaleFont(20) },
  sectionHeader: { padding: SPACING.lg, backgroundColor: COLORS.bgCard },
  sectionHeaderText: { color: COLORS.primary, fontSize: scaleFont(14), fontWeight: 'bold', textTransform: 'uppercase' },
  qariRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, borderBottomWidth: 1, borderColor: COLORS.borderDark },
  qariName: { color: COLORS.textPrimary, fontSize: scaleFont(16) },
  checkmark: { color: COLORS.primary, fontSize: scaleFont(18), fontWeight: 'bold' }
});
export default memo(QariSelector);
