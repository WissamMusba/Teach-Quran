import React, { memo } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setQari } from '../../store/audioSlice';

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
