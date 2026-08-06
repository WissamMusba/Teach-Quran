/**
 * FILE: src/components/quran/SurahList.tsx
 * ROLE: Full-screen modal surah picker with fuzzy search (name/number/juz/page) used from the Quran screen header.
 * DEPENDS ON: getSurahs (database/quranData.ts:336 — SELECT * FROM surahs ORDER BY id); getStartJuzOfSurah + JUZ_MAP (utils/theme.ts)
 * USED BY: src/screens/QuranViewScreen.tsx:1215 (modal over the whole screen; header "list" button at :1072 sets showList)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { getSurahs } from '../../database/quranData';
import { getStartJuzOfSurah, JUZ_MAP } from '../../utils/theme';

// Search-normalization: lowercase, strip diacritics, unify alif/hamza/teh-marbuta, keep only ASCII+Arabic, collapse spaces; memoized by input.
// FLOW: NFD normalize → strip combining marks + Arabic tashkeel ranges → drop tatweel → fold أإآٱ→ا / ؤ→و / ئ→ي / ة→ه → filter chars → collapse whitespace → trim.
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

// Similarity scoring for name search: exact 100, prefix 90, substring 80-idx, levenshtein ≤2 → 60-5d, subsequence → 40.
// levenshtein early-exits when |len diff| > 2 (returns 3); isSubsequence scans greedily; scoreName normalizes both sides and combines.
// O(n·m) with n,m up to ~30 — negligible for 114 items.
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

// All juz numbers a surah spans, by scanning the 30 {j,s,v} JUZ_MAP boundaries; feeds "juz N" search matching and the list subtitle.
const juzsOfSurah = (s: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < JUZ_MAP.length; i++) {
    if (JUZ_MAP[i].s <= s && (i === JUZ_MAP.length - 1 || s <= JUZ_MAP[i + 1].s)) out.push(i + 1);
  }
  return out;
};

// Hardcoded 114-entry [startPage, endPage] pairs for the 610-page indopak pagination; feeds the "Pages a–b" subtitle and numeric page search.
// A rebuild should generate this from the indopak pages table instead of hardcoding.
const SURAH_PAGE_RANGE: [number, number][] = [[1,1],[2,49],[50,76],[77,106],[106,127],[128,150],[151,176],[177,186],[187,207],[208,221],[221,235],[235,248],[249,255],[255,261],[261,267],[267,281],[282,292],[293,305],[305,312],[312,321],[322,331],[331,341],[342,349],[350,359],[359,366],[366,376],[376,385],[385,396],[396,404],[404,411],[411,414],[415,417],[418,427],[428,434],[434,440],[440,445],[445,452],[452,458],[458,467],[467,476],[477,482],[483,489],[489,495],[495,498],[498,501],[502,506],[506,510],[511,515],[515,517],[518,520],[520,523],[523,525],[526,528],[528,531],[531,534],[534,537],[537,541],[542,545],[545,548],[549,551],[551,553],[553,554],[554,555],[556,557],[558,559],[560,561],[562,564],[564,567],[567,569],[569,571],[571,573],[573,576],[576,577],[578,580],[580,581],[582,584],[584,585],[586,587],[587,589],[589,590],[590,591],[591,592],[592,594],[594,595],[595,596],[596,596],[597,597],[597,598],[598,599],[600,600],[600,601],[601,602],[602,602],[602,602],[603,603],[603,604],[604,604],[604,605],[605,605],[605,606],[606,606],[606,606],[607,607],[607,607],[607,607],[608,608],[608,608],[608,608],[608,609],[609,609],[609,609],[609,609],[610,610],[610,610]];

/**
 * SurahList — full-screen modal surah picker with fuzzy search.
 * PROPS: visible (show/hide modal), onClose (dismiss), onSelect(id) (surah chosen), onSelectPage(pageNum) (page-type row chosen).
 * FLOW: 1) On visible→true: clear query, fetch surahs from SQLite. 2) data memo enriches each surah with startJuz / juzs / pageRange
 *        (pageRange falls back to null for out-of-range ids so a corrupt DB row cannot crash search/render).
 *       3) results memo scores every surah — exact surah id 110, juz containment 105, page-range digit-substring 70/65, name
 *          similarity via scoreName — sorts desc by score then id; pure-number queries also inject a synthetic { type:'page', page:N }
 *          row for 1..610 right after an exact id match. 4) FlatList rows (keyboardShouldPersistTaps) tap → onSelectPage/onSelect + onClose.
 * CALLED BY: QuranViewScreen.tsx:1215 — onSelect dispatches setSurah({surahId, verses:[]}); onSelectPage → handleSelectPage
 *            (QuranViewScreen.tsx:317 — switches readingMode to 'page' and scrolls the page-mode FlatList).
 * AFFECTS: redux quran.currentSurahId / readingMode; page-mode FlatList scroll position.
 * NOTES: Not memoized (plain function) — fine, it re-renders only when the parent re-renders. renderItem/keyExtractor are
 *        useCallback'd so typing only re-renders rows whose item object changed, not every visible row.
 */
export default function SurahList({ visible, onClose, onSelect, onSelectPage }: any) {
  const [surahs, setSurahs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => { if (visible) { setQuery(''); getSurahs().then(s => setSurahs(s as any)); } }, [visible]);
  const data = useMemo(() => surahs.map((s: any) => ({ ...s, startJuz: getStartJuzOfSurah(s.id), juzs: juzsOfSurah(s.id), pageRange: SURAH_PAGE_RANGE[s.id - 1] || null })), [surahs]);
  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return data;
    const juzMatch = /^juz ?(\d{1,2})$/.exec(q);
    const juzNum = juzMatch ? parseInt(juzMatch[1], 10) : 0;
    const qNum = /^\d+$/.test(q) ? parseInt(q, 10) : 0;
    const qDigits = q.replace(/\D+/g, '');
    const scored: { item: any; score: number }[] = [];
    for (const s of data) {
      let score = 0;
      if (qNum && s.id === qNum) score = Math.max(score, 110);
      if (juzNum && s.juzs.includes(juzNum)) score = Math.max(score, 105);
      if (qDigits && s.pageRange) {
        const [pStart, pEnd] = s.pageRange;
        for (let p = pStart; p <= pEnd; p++) {
          if (String(p).includes(qDigits)) {
            score = Math.max(score, p === pStart ? 70 : 65);
            break;
          }
        }
      }
      score = Math.max(score, scoreName(s.englishName, q), scoreName(s.name, q));
      if (score > 0) scored.push({ item: s, score });
    }
    scored.sort((a, b) => b.score - a.score || a.item.id - b.item.id);
    if (qNum > 0) {
      const out: any[] = [];
      const exactIdx = scored.findIndex(x => x.item.id === qNum);
      if (exactIdx >= 0) out.push(scored[exactIdx].item);
      if (qNum >= 1 && qNum <= 610) out.push({ type: 'page', id: qNum, page: qNum, englishName: `Page ${qNum}`, name: '' });
      scored.forEach((x, i) => { if (i !== exactIdx) out.push(x.item); });
      return out;
    }
    return scored.map(x => x.item);
  }, [data, query]);
  const keyExtractor = useCallback((item: any) => (item.type === 'page' ? `page-${item.page}` : `surah-${item.id}`), []);
  const renderItem = useCallback(({ item }: any) => (
    <TouchableOpacity style={styles.item} onPress={() => { if (item.type === 'page') { onSelectPage?.(item.page); } else { onSelect?.(item.id); } onClose(); }}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemNum}>{item.type === 'page' ? item.page : item.id}</Text>
        <View>
          <Text style={styles.itemText}>{item.englishName}</Text>
          {item.type === 'page' ? (
            <>
              <Text style={styles.pageTag}>PAGE</Text>
              <Text style={styles.itemJuz}>Go to page {item.page}</Text>
            </>
          ) : (
            <>
              <Text style={styles.itemJuz}>Juz {item.startJuz} · {item.verses} ayahs</Text>
              {item.pageRange ? <Text style={styles.itemPages}>Pages {item.pageRange[0]}–{item.pageRange[1]}</Text> : null}
            </>
          )}
        </View>
      </View>
      <Text style={styles.itemArabic}>{item.name}</Text>
    </TouchableOpacity>
  ), [onSelect, onSelectPage, onClose]);
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Select Surah</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>Close</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search surah, number, or juz..." placeholderTextColor="#8a8a8a" autoCapitalize="none" autoCorrect={false} />
        </View>
        {results.length === 0 && query.length > 0 ? (
          <View style={styles.emptyWrap}><Text style={styles.emptyText}>No surahs found</Text></View>
        ) : (
          <FlatList data={results} keyExtractor={keyExtractor} keyboardShouldPersistTaps="handled"
            renderItem={renderItem} />
        )}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, borderBottomWidth: 1, borderColor: '#333' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  closeBtn: { color: '#0066FF', fontSize: 16 },
  searchInput: { marginTop: 14, backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#8a8a8a', fontSize: 16 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#1e1e1e' },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  itemNum: { color: '#00d4aa', fontSize: 15, fontWeight: '700', width: 34 },
  itemText: { fontSize: 17, color: '#fff' },
  itemJuz: { fontSize: 12, color: '#8a8a8a', marginTop: 2 },
  itemPages: { fontSize: 12, color: '#8a8a8a', marginTop: 2 },
  pageTag: { color: '#00d4aa', fontSize: 10, fontWeight: '700', borderWidth: 1, borderColor: '#00d4aa', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2, alignSelf: 'flex-start' },
  itemArabic: { fontSize: 20, color: '#fff' },
});
