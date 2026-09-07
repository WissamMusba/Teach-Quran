/**
 * FILE: src/components/quran/SurahList.tsx
 * ROLE: Full-screen modal surah picker with fuzzy search and full theme integration.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SURAH_META, SURAH_PAGE_RANGE } from '../../utils/surahMeta';
import { getArabicFont, getThemeColors, JUZ_MAP, JUZ_NAMES, JUZ_PAGE_START } from '../../utils/theme';

const normCache: Record<string, string> = {};
const norm = (s?: string | null): string => {
  if (!s || typeof s !== 'string') return '';
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
  if (d <= 2) return 60 - d * 10;
  if (isSubsequence(qc, nc)) return 40;
  return 0;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (surahId: number) => void;
  onSelectPage?: (page: number) => void;
  onSelectJuz?: (juzNum: number) => void;
  mode?: 'surah' | 'page' | 'juz';
  inline?: boolean;
}

export default function SurahList({ visible, onClose, onSelect, onSelectPage, onSelectJuz, mode = 'surah', inline = false }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const [query, setQuery] = useState('');
  const isDark = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const fontFamily = getArabicFont(textStyle);

  const themeColors = useMemo(() => getThemeColors(colorTheme, isDark), [colorTheme, isDark]);

  const isIndopak = textStyle === 'alqalam' || textStyle === 'lateef';
  const maxPages = isIndopak ? 610 : 604;

  const data = useMemo(() => {
    if (mode === 'page') {
      return Array.from({ length: maxPages }, (_, i) => ({ type: 'page', page: i + 1, label: `Page ${i + 1}` }));
    }
    if (mode === 'juz') {
      return Array.from({ length: 30 }, (_, i) => ({ type: 'juz', juz: i + 1, label: `Juz ${i + 1}`, ar: JUZ_NAMES[i]?.ur || '' }));
    }
    return SURAH_META.map((s) => ({ type: 'surah', ...s }));
  }, [mode, maxPages]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return data;
    const qNorm = norm(q);
    const numMatch = q.match(/\d+/);
    const qNum = numMatch ? parseInt(numMatch[0], 10) : NaN;
    const isExactNumber = /^\d+$/.test(q);
    const isPageSearch = /^(?:page|p)\s*\d+$/i.test(q);
    const isJuzSearch = /^(?:juz|j|para)\s*\d+$/i.test(q);

    const scored: { item: any; score: number }[] = [];

    // If in surah mode, allow searching/jumping to Surah, Page, and Juz directly when a number is entered
    if (mode === 'surah' && !isNaN(qNum) && qNum > 0) {
      if (isPageSearch) {
        if (qNum <= maxPages) {
          scored.push({ item: { type: 'page', page: qNum, label: `Page ${qNum}` }, score: 1000 });
        }
      } else if (isJuzSearch) {
        if (qNum <= 30) {
          scored.push({ item: { type: 'juz', juz: qNum, label: `Juz ${qNum}`, ar: JUZ_NAMES[qNum - 1]?.ur || '' }, score: 1000 });
        }
      } else if (isExactNumber) {
        // 1st Priority: Surah qNum (1..114)
        const matchedSurah = SURAH_META.find((s) => s.id === qNum);
        if (matchedSurah) {
          scored.push({ item: { type: 'surah', ...matchedSurah }, score: 1000 });
        }
        // 2nd Priority: Page qNum (1..maxPages)
        if (qNum <= maxPages) {
          scored.push({ item: { type: 'page', page: qNum, label: `Page ${qNum}` }, score: 900 });
        }
        // 3rd Priority: Juz qNum (1..30)
        if (qNum <= 30) {
          scored.push({ item: { type: 'juz', juz: qNum, label: `Juz ${qNum}`, ar: JUZ_NAMES[qNum - 1]?.ur || '' }, score: 800 });
        }
      }
    }

    data.forEach((item: any) => {
      if (item.type === 'page') {
        const pageNum = item.page;
        if (pageNum === qNum) {
          scored.push({ item, score: 100 });
        } else if (String(pageNum).startsWith(q)) {
          scored.push({ item, score: 85 - (String(pageNum).length - q.length) });
        } else if (String(pageNum).includes(q)) {
          scored.push({ item, score: 60 });
        }
      } else if (item.type === 'juz') {
        if (item.juz === qNum) {
          scored.push({ item, score: 100 });
        } else if (String(item.juz).startsWith(q)) {
          scored.push({ item, score: 85 - (String(item.juz).length - q.length) });
        } else if (String(item.juz).includes(q)) {
          scored.push({ item, score: 60 });
        }
      } else {
        // Skip duplicate exact surah added above
        if (isExactNumber && item.id === qNum) {
          return;
        }
        if (!isNaN(qNum) && qNum > 0 && String(item.id).startsWith(q)) {
          scored.push({ item, score: 700 - (String(item.id).length - q.length) * 10 });
          return;
        }
        const sEn = scoreName(item.en, qNorm);
        const sAr = scoreName(item.ar, qNorm);
        const sTrans = item.translation ? scoreName(item.translation, qNorm) : 0;
        const best = Math.max(sEn, sAr, sTrans);
        if (best > 0) scored.push({ item, score: best });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((x) => x.item);
  }, [data, query, mode, maxPages]);

  const content = (
    <View style={[styles.container, { backgroundColor: themeColors.bg, paddingTop: inline ? 0 : Math.max(10, insets.top + 6), paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { backgroundColor: themeColors.headerBg, borderBottomColor: themeColors.headerBorder }]}>
        {!inline ? (
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              {mode === 'page' ? 'Go to page' : mode === 'juz' ? 'Go to juz' : 'Select Surah'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeBtn, { color: themeColors.accent }]}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TextInput
          style={[styles.searchInput, { backgroundColor: themeColors.cardBg, color: themeColors.text, borderColor: themeColors.border, marginTop: inline ? 8 : 0 }]}
          value={query}
          onChangeText={setQuery}
          placeholder={mode === 'page' ? `Type a page number (1–${maxPages})...` : mode === 'juz' ? 'Type a juz number (1–30)...' : 'Search surah, number, page, or juz...'}
          placeholderTextColor={themeColors.subText}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {results.length === 0 && query.length > 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: themeColors.subText }]}>No results found</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item: any) => (item.type === 'page' ? `page-${item.page}` : item.type === 'juz' ? `juz-${item.juz}` : `surah-${item.id}`)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }: any) => {
            const isPage = item.type === 'page';
            const isJuz = item.type === 'juz';
            const isSurah = item.type === 'surah';
            const itemNum = isPage ? item.page : isJuz ? item.juz : item.id;
            const surahStartPage = isSurah ? (SURAH_PAGE_RANGE[item.id - 1]?.[0] || 1) : null;
            const juzArabic = isJuz ? (item.ar || JUZ_NAMES[item.juz - 1]?.ur || '') : null;

            return (
              <TouchableOpacity
                style={[
                  styles.item,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderBottomColor: themeColors.border,
                    paddingVertical: isTablet ? 14 : 11,
                  }
                ]}
                onPress={() => {
                  if (isPage) {
                    onSelectPage ? onSelectPage(item.page) : onSelect(item.page);
                  } else if (isJuz) {
                    const startPage = JUZ_PAGE_START[item.juz - 1] || 1;
                    if (onSelectJuz) {
                      onSelectJuz(item.juz);
                    } else if (onSelectPage) {
                      onSelectPage(startPage);
                    } else {
                      onSelect(item.juz);
                    }
                  } else {
                    const startPage = SURAH_PAGE_RANGE[item.id - 1]?.[0] || 1;
                    if (onSelectPage) {
                      onSelectPage(startPage);
                    } else {
                      onSelect(item.id);
                    }
                  }
                  if (!inline) {
                    onClose?.();
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.numBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={[styles.itemNum, { color: themeColors.accent }]}>
                      {itemNum}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.itemNameEn, { color: themeColors.text }]}>
                      {isPage ? item.label : isJuz ? item.label : item.en}
                    </Text>
                    {isSurah ? (
                      <Text style={[styles.itemMeta, { color: themeColors.subText }]}>
                        {item.verses} verses · Juz {item.startJuz} · Page {surahStartPage}
                      </Text>
                    ) : isPage ? (
                      <Text style={[styles.itemMeta, { color: themeColors.subText }]}>
                        Go to Page {item.page}
                      </Text>
                    ) : isJuz ? (
                      <Text style={[styles.itemMeta, { color: themeColors.subText }]}>
                        {JUZ_NAMES[item.juz - 1]?.en ? `${JUZ_NAMES[item.juz - 1].en} · ` : ''}Starts at Page {JUZ_PAGE_START[item.juz - 1] || 1}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {isSurah ? (
                  <Text style={[styles.itemNameAr, { fontFamily, color: themeColors.gold }]}>{item.ar}</Text>
                ) : isJuz && juzArabic ? (
                  <Text style={[styles.itemNameAr, { fontFamily, color: themeColors.gold }]}>{juzArabic}</Text>
                ) : isPage ? (
                  <Text style={[styles.itemNameAr, { fontFamily, color: themeColors.gold, fontSize: 16 }]}>
                    {`الصفحة ${item.page}`}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  if (inline) {
    return content;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
  closeBtn: { fontSize: 16, fontWeight: '700' },
  searchInput: { height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, fontWeight: '500' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  numBadge: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemNum: { fontSize: 14, fontWeight: '800' },
  itemNameEn: { fontSize: 15.5, fontWeight: '700' },
  itemMeta: { fontSize: 12, marginTop: 2 },
  itemNameAr: { fontSize: 21, fontWeight: 'bold', marginLeft: 10 },
});
