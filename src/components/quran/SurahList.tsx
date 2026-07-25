import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { getSurahs } from '../../database/quranData';
import { JUZ_MAP, COLORS, SPACING, RADIUS, scaleFont } from '../../utils/theme';

export default function SurahList({ visible, onClose, onSelect }: any) {
  const [surahs, setSurahs] = useState([]);

  useEffect(() => {
    if (visible) getSurahs().then(s => setSurahs(s as any));
  }, [visible]);

  const sections = useMemo(() => JUZ_MAP.map(({j,s}) => {
    const end = JUZ_MAP.find(x => x.j === j + 1)?.s || 115;
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
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.xl, borderBottomWidth: 1, borderColor: COLORS.borderDark },
  title: { fontSize: scaleFont(22), fontWeight: 'bold', color: COLORS.textPrimary },
  closeBtn: { color: COLORS.accent, fontSize: scaleFont(16) },
  sectionTitle: { fontSize: scaleFont(18), fontWeight: 'bold', color: COLORS.gold, padding: SPACING.lg, backgroundColor: COLORS.bgCardLight, borderBottomWidth: 1, borderColor: COLORS.borderDark },
  item: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.xl, borderBottomWidth: 1, borderColor: COLORS.borderDark },
  itemText: { fontSize: scaleFont(18), color: COLORS.textPrimary },
  itemArabic: { fontSize: scaleFont(20), color: COLORS.textPrimary }
});
