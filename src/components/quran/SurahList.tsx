import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { getSurahs } from '../../database/quranData';
import { getStartJuzOfSurah } from '../../utils/theme';

export default function SurahList({ visible, onClose, onSelect }: any) {
  const [surahs, setSurahs] = useState<any[]>([]);
  useEffect(() => { if (visible) getSurahs().then(s => setSurahs(s as any)); }, [visible]);
  const data = useMemo(() => surahs.map((s: any) => ({ ...s, startJuz: getStartJuzOfSurah(s.id) })), [surahs]);
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Surah</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>Close</Text></TouchableOpacity>
        </View>
        <FlatList data={data} keyExtractor={(item: any) => item.id.toString()}
          renderItem={({ item }: any) => (
            <TouchableOpacity style={styles.item} onPress={() => { onSelect(item.id); onClose(); }}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemNum}>{item.id}</Text>
                <View>
                  <Text style={styles.itemText}>{item.englishName}</Text>
                  <Text style={styles.itemJuz}>Juz {item.startJuz} · {item.verses} ayahs</Text>
                </View>
              </View>
              <Text style={styles.itemArabic}>{item.name}</Text>
            </TouchableOpacity>
          )} />
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#333' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  closeBtn: { color: '#0066FF', fontSize: 16 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#1e1e1e' },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  itemNum: { color: '#00d4aa', fontSize: 15, fontWeight: '700', width: 34 },
  itemText: { fontSize: 17, color: '#fff' },
  itemJuz: { fontSize: 12, color: '#8a8a8a', marginTop: 2 },
  itemArabic: { fontSize: 20, color: '#fff' },
});
