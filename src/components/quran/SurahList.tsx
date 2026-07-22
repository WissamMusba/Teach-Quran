import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { getSurahs } from '../../database/quranData';

export default function SurahList({ visible, onClose, onSelect }: any) {
  const [surahs, setSurahs] = useState([]);
  
  useEffect(() => { 
    if (visible) getSurahs().then(s => setSurahs(s as any)); 
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Surah</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>Close</Text></TouchableOpacity>
        </View>
        <FlatList 
          data={surahs} 
          keyExtractor={(item: any) => item.id.toString()} 
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
  item: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#1e1e1e' },
  itemText: { fontSize: 18, color: '#fff' }, 
  itemArabic: { fontSize: 20, color: '#fff' }
});