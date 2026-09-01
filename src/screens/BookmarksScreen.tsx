/**
 * FILE: src/screens/BookmarksScreen.tsx
 * ROLE: Lists the current student's bookmarks (newest first) with the reading mark (lastRead)
 *       as the FIRST row with pure vector SVG icons and theme integration.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { formatDate, formatTime, getJuzForVerse, toMillis } from '../utils/format';
import { getVersePagesDB } from '../database/localDB';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';
import { getThemeColors } from '../utils/theme';

const pageKey = (surah: number, verse: number) => `${surah}_${verse}`;
const sessionPageCache: Record<string, number> = {};

const IconBookmark = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

export default function BookmarksScreen({ onClose, navigation: navProp }: { onClose?: () => void; navigation?: any } = {}) {
  const navigation = navProp || useNavigation<any>();
  const bookmarks = useSelector((s: any) => s.student.studentData?.bookmarks);
  const lastRead = useSelector((s: any) => s.student.studentData?.lastRead);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  useStudentDataRefresh();

  const lrSurah = lastRead ? Number(lastRead.surah) : 0;
  const lrVerse = lastRead ? Number(lastRead.verse) : 0;

  const sortedBookmarks = React.useMemo(() => {
    const raw: any[] = bookmarks ? Object.values(bookmarks) : [];
    return raw.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [bookmarks]);

  const [pageMap, setPageMap] = useState<Record<string, number>>(() => ({ ...sessionPageCache }));

  useEffect(() => {
    let cancelled = false;
    const pendingKeys: [number, number][] = [];
    const seed: Record<string, number> = { ...pageMap };
    let seedChanged = false;

    const check = (s: number, v: number) => {
      const k = pageKey(s, v);
      if (sessionPageCache[k] !== undefined) {
        if (seed[k] !== sessionPageCache[k]) { seed[k] = sessionPageCache[k]; seedChanged = true; }
      } else {
        pendingKeys.push([s, v]);
      }
    };

    if (lrSurah > 0 && lrVerse > 0) check(lrSurah, lrVerse);
    for (const b of sortedBookmarks as any[]) {
      const s = Number(b.surah); const v = Number(b.verse);
      if (s > 0 && v > 0) check(s, v);
    }

    if (seedChanged) setPageMap({ ...seed });
    if (pendingKeys.length === 0) return;

    getVersePagesDB(pendingKeys).then((res) => {
      if (cancelled) return;
      const next = { ...seed };
      for (const [key, page] of Object.entries(res)) {
        sessionPageCache[key] = page;
        if (next[key] !== page) next[key] = page;
      }
      setPageMap({ ...next });
    });
    return () => { cancelled = true; };
  }, [sortedBookmarks, lrSurah, lrVerse, textStyle]);

  const handleNavigate = React.useCallback(
    (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any),
    [navigation],
  );

  const listData = React.useMemo(() => {
    const out: any[] = [];
    if (lrSurah > 0) out.push({ surah: lrSurah, verse: lrVerse, __lastRead: true });
    for (const b of sortedBookmarks as any[]) {
      if (lrSurah === Number(b.surah) && lrVerse === Number(b.verse)) continue;
      out.push(b);
    }
    return out;
  }, [lrSurah, lrVerse, sortedBookmarks]);

  const cardMeta = React.useMemo(() => {
    const out: Record<string, { name: string; juz: number; date: string; time: string }> = {};
    const tsOf = (b: any) => toMillis(b.createdAt || b.updatedAt);
    if (lrSurah > 0 && lastRead) {
      const ts = toMillis(lastRead.updatedAt || lastRead.createdAt);
      out[pageKey(lrSurah, lrVerse)] = {
        name: surahNames?.[lrSurah] || `Surah ${lrSurah}`,
        juz: getJuzForVerse(lrSurah, lrVerse),
        date: ts ? formatDate(ts) : '',
        time: ts ? formatTime(ts) : '',
      };
    }
    for (const b of sortedBookmarks as any[]) {
      const key = pageKey(b.surah, b.verse);
      const ts = tsOf(b);
      out[key] = {
        name: surahNames?.[b.surah] || `Surah ${b.surah}`,
        juz: getJuzForVerse(b.surah, b.verse),
        date: formatDate(ts),
        time: formatTime(ts),
      };
    }
    return out;
  }, [sortedBookmarks, surahNames, lastRead, lrSurah, lrVerse]);

  const renderBookmark = React.useCallback(({ item }: any) => {
    const meta = cardMeta[pageKey(item.surah, item.verse)];
    const page = pageMap[pageKey(item.surah, item.verse)];
    return (
      <TouchableOpacity
        style={[
          styles(nightMode, themeColors).card,
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.border,
          }
        ]}
        onPress={() => handleNavigate(item.surah, item.verse)}
        activeOpacity={0.8}
      >
        <View style={styles(nightMode, themeColors).topRow}>
          {item.__lastRead ? <Text style={[styles(nightMode, themeColors).lastReadTag, { color: themeColors.accent }]}>LAST READ</Text> : null}
          {meta?.date ? (
            <View style={[styles(nightMode, themeColors).chip, { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderColor: themeColors.border }]}>
              <Text style={[styles(nightMode, themeColors).chipText, { color: themeColors.text }]}>Date: {meta.date}</Text>
            </View>
          ) : null}
          {meta?.time ? (
            <View style={[styles(nightMode, themeColors).chip, { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderColor: themeColors.border }]}>
              <Text style={[styles(nightMode, themeColors).chipText, { color: themeColors.text }]}>Time: {meta.time}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles(nightMode, themeColors).surahName, { color: themeColors.text, borderLeftColor: themeColors.accent }]}>
          {meta?.name || `Surah ${item.surah}`}
        </Text>

        <View style={[styles(nightMode, themeColors).metaStack, { backgroundColor: nightMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: themeColors.border }]}>
          <View style={styles(nightMode, themeColors).metaItem}>
            <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Surah</Text>
            <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{item.surah}</Text>
          </View>
          <View style={styles(nightMode, themeColors).metaSeparator} />
          <View style={styles(nightMode, themeColors).metaItem}>
            <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Ayah</Text>
            <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{item.verse}</Text>
          </View>
          <View style={styles(nightMode, themeColors).metaSeparator} />
          <View style={styles(nightMode, themeColors).metaItem}>
            <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Juz</Text>
            <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{meta?.juz ?? '…'}</Text>
          </View>
          <View style={styles(nightMode, themeColors).metaSeparator} />
          <View style={styles(nightMode, themeColors).metaItem}>
            <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Page</Text>
            <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{page !== undefined ? page : '…'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [cardMeta, pageMap, handleNavigate, nightMode, themeColors]);

  return (
    <View style={[styles(nightMode, themeColors).container, { backgroundColor: themeColors.bg }]}>
      <ScreenHeader title="Bookmarks" subtitle={`${listData.length} bookmarks`} onBack={onClose} />
      {listData.length === 0 ? (
        <View style={styles(nightMode, themeColors).emptyState}>
          <IconBookmark c={themeColors.accent} size={44} />
          <Text style={[styles(nightMode, themeColors).emptyText, { color: themeColors.subText, marginTop: 12 }]}>No bookmarks yet</Text>
          <Text style={[styles(nightMode, themeColors).emptySub, { color: themeColors.subText }]}>Long-press a verse to bookmark it</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={listData}
          keyExtractor={(i: any, idx: number) => idx.toString()}
          contentContainerStyle={styles(nightMode, themeColors).list}
          renderItem={renderBookmark}
        />
      )}
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flex: 1, padding: 10 },
  list: { paddingBottom: 12 },
  card: { padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  topRow: { flexDirection: 'row', gap: 6, marginBottom: 5, flexWrap: 'wrap', alignItems: 'center' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 9, fontWeight: '700' },
  surahName: { fontSize: 15, fontWeight: '800', borderLeftWidth: 3, paddingLeft: 8, marginBottom: 5 },
  lastReadTag: { alignSelf: 'flex-start', fontSize: 8, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  metaStack: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10 },
  metaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  metaLabel: { fontSize: 10, fontWeight: '600' },
  metaValue: { fontSize: 10, fontWeight: '700' },
  metaSeparator: { height: StyleSheet.hairlineWidth, opacity: 0.5, backgroundColor: '#888' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 12, marginTop: 4 },
});
