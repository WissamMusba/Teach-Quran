/**
 * FILE: src/components/quran/SurahList.tsx
 * ROLE: Full-screen modal surah picker with fuzzy search (name/number/juz/page) used from the Quran screen header.
 * DEPENDS ON: SURAH_META (utils/surahMeta.ts — bundled static 114-surah metadata); getStartJuzOfSurah + JUZ_MAP (utils/theme.ts)
 * USED BY: src/screens/QuranViewScreen.tsx, src/screens/SurahIndexScreen.tsx
 */
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SURAH_META } from '../../utils/surahMeta';
import { getArabicFont } from '../../utils/theme';

const normCache: Record<string, string> = {};
const norm = (s: string): string => {
  if (normCache[s] !== undefined) return normCache[s];
  const out = s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u06d6-\u06ed]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06ff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  normCache[s] = out;
  return out;
};

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

const isSubsequence = (q: string, name: string): boolean => {
  let i = 0;
  for (let j = 0; j < name.length && i < q.length; j++) if (name[j] === q[i]) i++;
  return i === q.length;
};

const scoreName = (name: string, q: string): number => {
  const n = norm(name);
  if (!n) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  const idx = n.indexOf(q);
  if (idx >= 0) return 80 - Math.min(idx, 10);
  const nc = n.replace(/\s+/g, '');
  const qc = q.replace(/\s+/g, '');
  const d = levenshtein(nc, qc);
  if (d <= 2) return 60 - d * 5;
  if (isSubsequence(qc, nc)) return 40;
  return 0;
};

export default function SurahList({ visible, onClose, onSelect, onSelectPage, onSelectJuz, mode = 'surah' }: any) {
  const insets = useSafeAreaInsets();
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const surahNames = useSelector((s: any) => s.quran?.surahNames);
  const isDark = !!nightMode;
  const isTablet = useWindowDimensions().width >= 600;
  const [query, setQuery] = useState('');
  const arabicFont = getArabicFont(textStyle);

  const data = useMemo(() => {
    return SURAH_META.map(m => ({
      id: m.id,
      name: m.ar,
      englishName: surahNames?.[m.id] || m.en,
      verses: m.verses,
      startJuz: m.startJuz,
      juzs: m.juzs,
      pageRange: m.pages,
    }));
  }, [surahNames]);

  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return data;
    const qNum = parseInt(q, 10);
    const scored: { item: any; score: number }[] = [];

    for (const item of data) {
      let score = 0;
      if (item.id === qNum) score = 110;
      else if (mode === 'juz' && item.juzs.includes(qNum)) score = 105;
      else if (qNum >= item.pageRange[0] && qNum <= item.pageRange[1]) score = 70;
      else {
        const enScore = scoreName(item.englishName, q);
        const arScore = scoreName(item.name, q);
        score = Math.max(enScore, arScore);
      }
      if (score > 0) scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score || a.item.id - b.item.id);

    const out: any[] = [];
    if (mode === 'juz' && qNum >= 1 && qNum <= 30) {
      out.push({ type: 'juz', juz: qNum, englishName: `Juz ${qNum}`, name: '' });
    }
    if (mode === 'page' && qNum >= 1 && qNum <= 610) {
      out.push({ type: 'page', id: qNum, page: Math.max(1, qNum - 1), englishName: `Page ${qNum}`, name: '' });
    }
    if (qNum > 0) {
      const exactIdx = scored.findIndex(x => x.item.id === qNum);
      if (exactIdx >= 0) out.push(scored[exactIdx].item);
      if (qNum >= 1 && qNum <= 610) out.push({ type: 'page', id: qNum, page: Math.max(1, qNum - 1), englishName: `Page ${qNum}`, name: '' });
      scored.forEach((x, i) => { if (i !== exactIdx) out.push(x.item); });
      return out;
    }
    return scored.map(x => x.item);
  }, [data, query, mode]);

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: isDark ? '#10121A' : '#F3EFE4', paddingTop: Math.max(10, insets.top + 6), paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { backgroundColor: isDark ? '#171A24' : '#FAF7EE', borderBottomColor: isDark ? '#242838' : '#E2DDD0' }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
              {mode === 'page' ? 'Go to page' : mode === 'juz' ? 'Go to juz' : 'Select Surah'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeBtn, { color: isDark ? '#7BA7DB' : '#1C3D72' }]}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.searchInput, { backgroundColor: isDark ? '#1F2433' : '#F0EBE0', color: isDark ? '#FFFFFF' : '#1A1A1A', borderColor: isDark ? '#323B52' : '#CDC4B0' }]}
            value={query}
            onChangeText={setQuery}
            placeholder={mode === 'page' ? 'Type a page number (1–610)...' : mode === 'juz' ? 'Type a juz number (1–30)...' : 'Search surah, number, or juz...'}
            placeholderTextColor={isDark ? '#757E9E' : '#999080'}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {results.length === 0 && query.length > 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: isDark ? '#757E9E' : '#999080' }]}>No surahs found</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item: any) => (item.type === 'page' ? `page-${item.page}` : item.type === 'juz' ? `juz-${item.juz}` : `surah-${item.id}`)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={[
                  styles.item,
                  {
                    backgroundColor: isDark ? '#1C202E' : '#FAF7EE',
                    borderBottomColor: isDark ? '#2B3145' : '#EAE4D4',
                    paddingVertical: isTablet ? 14 : 11,
                  }
                ]}
                onPress={() => {
                  if (item.type === 'page') { onSelectPage?.(item.page); }
                  else if (item.type === 'juz') { onSelectJuz?.(item.juz); }
                  else { onSelect(item.id); }
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.numBadge, { backgroundColor: isDark ? '#28334E' : '#E8E1CF' }]}>
                    <Text style={[styles.itemNum, { color: isDark ? '#93BCF0' : '#1C3D72' }]}>
                      {item.type === 'page' ? item.page + 1 : item.type === 'juz' ? item.juz : item.id}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.itemText, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>{item.englishName}</Text>
                    {item.type === 'page' ? (
                      <>
                        <Text style={[styles.pageTag, { color: isDark ? '#7BA7DB' : '#1C3D72', borderColor: isDark ? '#7BA7DB' : '#1C3D72' }]}>PAGE</Text>
                        <Text style={[styles.itemJuz, { color: isDark ? '#8E95A8' : '#7D7667' }]}>Go to page {item.page + 1}</Text>
                      </>
                    ) : item.type === 'juz' ? (
                      <>
                        <Text style={[styles.pageTag, { color: isDark ? '#7BA7DB' : '#1C3D72', borderColor: isDark ? '#7BA7DB' : '#1C3D72' }]}>JUZ</Text>
                        <Text style={[styles.itemJuz, { color: isDark ? '#8E95A8' : '#7D7667' }]}>Go to juz {item.juz}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.itemJuz, { color: isDark ? '#8E95A8' : '#7D7667' }]}>Juz {item.startJuz} · {item.verses} ayahs</Text>
                        <Text style={[styles.itemPages, { color: isDark ? '#8E95A8' : '#7D7667' }]}>Pages {item.pageRange[0]}–{item.pageRange[1]}</Text>
                      </>
                    )}
                  </View>
                </View>
                {item.name ? (
                  <Text style={[styles.itemArabic, { color: isDark ? '#E2C275' : '#8C6D15', fontFamily: arabicFont }]}>
                    {item.name}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 18, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  closeBtn: { fontSize: 16, fontWeight: '700' },
  searchInput: { marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: 1 },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  numBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemNum: { fontSize: 15, fontWeight: '800' },
  itemText: { fontSize: 16.5, fontWeight: '700' },
  itemJuz: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  itemPages: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  pageTag: { fontSize: 10, fontWeight: '800', borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2, alignSelf: 'flex-start' },
  itemArabic: { fontSize: 22, fontWeight: '700', textAlign: 'right' },
});
