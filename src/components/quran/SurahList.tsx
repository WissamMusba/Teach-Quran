import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { getSurahs } from '../../database/quranData';

const JUZ_DATA = [{j:1,s:1},{j:2,s:2},{j:3,s:2},{j:4,s:3},{j:5,s:4},{j:6,s:4},{j:7,s:5},{j:8,s:6},{j:9,s:7},{j:10,s:8},{j:11,s:9},{j:12,s:11},{j:13,s:12},{j:14,s:15},{j:15,s:17},{j:16,s:18},{j:17,s:21},{j:18,s:23},{j:19,s:25},{j:20,s:27},{j:21,s:29},{j:22,s:33},{j:23,s:36},{j:24,s:39},{j:25,s:41},{j:26,s:46},{j:27,s:51},{j:28,s:58},{j:29,s:67},{j:30,s:78}];

export default function SurahList({ visible, onClose, onSelect }: any) {
  const [surahs, setSurahs] = useState([]);
  
  useEffect(() => { 
    if (visible) getSurahs().then(s => setSurahs(s as any)); 
  }, [visible]);

  const sections = useMemo(() => JUZ_DATA.map(({j,s}) => {
    const end = JUZ_DATA.find(x => x.j === j + 1)?.s || 115;
    return { title: `Juz ${j}`, data: surahs.filter((su: any) => su.id >= s && su.id < end) };
  }).filter(sec => sec.data.length > 0), [surahs]);

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Surah</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>Close</Text></TouchableOpacity>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item: any) => item.id.toString()}
          renderSectionHeader={({ section }) => (
            <TouchableOpacity onPress={() => { const first = section.data[0]; if (first) { onSelect(first.id); onClose(); } }}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </TouchableOpacity>
          )}
          renderItem={({ item }: any) => (
            <TouchableOpacity style={styles.item} onPress={() => { onSelect(item.id); onClose(); }}>
              <Text style={styles.itemText}>{item.id}. {item.englishName}</Text>
              <Text style={styles.itemArabic}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#333' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' }, 
  closeBtn: { color: '#0066FF', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', padding: 15, backgroundColor: '#1e1e1e', borderBottomWidth: 1, borderColor: '#333' },
  item: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#1e1e1e' },
  itemText: { fontSize: 18, color: '#fff' }, 
  itemArabic: { fontSize: 20, color: '#fff' }
});