/**
 * FILE: src/screens/BookmarksScreen.tsx
 * ROLE: Lists the current student's bookmarks (newest first) with the reading mark (lastRead)
 *       as the FIRST row (tagged "LAST READ", same card style — not pinned above the list);
 *       tapping any item deep-links back into QuranView at that verse.
 * DEPENDS ON: Redux s.student.studentData.bookmarks (keyed `surah_verse`) + studentData.lastRead
 *             (studentData is hydrated only by QuranViewScreen's mount effect via getStudentData
 *             in src/database/localDB.ts — this screen never calls SQLite itself), s.quran.surahNames,
 *             s.settings.nightMode, src/utils/format.ts (formatDate/formatTime/getJuzForVerse),
 *             src/database/localDB.ts (getVersePagesDB — ONE batched async page lookup for every
 *             bookmark + lastRead, cached in local state AND in a module-level session cache so a
 *             second visit renders real page numbers on the very first frame with zero SQLite
 *             traffic; pages render as "…" only on the first-ever session lookup).
 * USED BY: Opened from the QuranView toolbar `onBookmarks` (QuranViewScreen.tsx); NOT
 *          reachable from Dashboard.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { formatDate, formatTime, getJuzForVerse, toMillis } from '../utils/format';
import { getVersePagesDB } from '../database/localDB';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';

const pageKey = (surah: number, verse: number) => `${surah}_${verse}`;

// Module-level session cache for mushaf pages: verse->page mappings never change during a
// session, so a bookmark list page number resolved today is still correct at the next visit.
// This makes page-enriched first frames instant on every open AFTER the first-ever query and
// avoids re-issuing the batched SQLite lookup on each screen mount.
const sessionPageCache: Record<string, number> = {};

/**
 * WHAT: Screen component: derives the sorted bookmark list + last read from Redux, renders
 *       ScreenHeader (fixed, above the list), empty state, pinned card, or FlatList of
 *       premium bookmark cards.
* FLOW: 1) useSelector s.student.studentData (bookmarks + lastRead read via granular
 *          selectors so unrelated Redux churn never invalidates this screen), s.quran.surahNames,
 *          s.settings.nightMode;
 *       2) sortedBookmarks useMemo: Object.values(bookmarks) sorted desc by
 *          createdAt (sort() MUTATES the values array in place);
 *       3) pageMap local state: ONE background getVersePagesDB call (page lookups for every
 *          bookmark + lastRead batched into a single SQLite query) fills the map keyed
 *          `surah_verse`; cards render "…" until their row lands. The effect is keyed on
 *          the bookmark/lastRead set and deduped in-flight, so the DB is touched once per
 *          change — never per card render;
 *       4) renderBookmark: onPress → handleNavigate(item.surah, item.verse);
 *       5) renders the FlatList (reading mark first when it exists), else empty state.
 * CALLS: handleNavigate → navigation.navigate('QuranView', { surahId, scrollToVerse }) — THE
 *        deep-link contract (QuranViewScreen consumes these params); getJuzForVerse /
 *        formatDate / formatTime for badges + timestamps; getVersePagesDB (single batched
 *        SQLite query) for mushaf pages — runs in the BACKGROUND, never blocks first paint.
 * CALLED BY: React Navigation (registered in the root stack; opened via QuranViewScreen.tsx
 *            toolbar onBookmarks).
 * AFFECTS: Redux: none. Navigation: pushes QuranView with {surahId, scrollToVerse}.
 * NOTES: keyExtractor uses the array index — safe here (no reordering between renders) but
 *        fragile if deletes are added. If studentData is null (QuranView never mounted this
 *        session), both lists render empty — no loading/refresh path in this screen. The
 *        empty-state hint "Long-press a verse to bookmark it" refers to QuranViewScreen's
 *        handleBookmarkFlow, not to any action in this screen.
 * PERF: the whole screen paints instantly from Redux (no awaits before first render);
 *        the only SQLite work — the batched mushaf-page lookup — is deferred to a background
 *        effect that fills the "…" placeholders when the query resolves.
 */
export default function BookmarksScreen() {
  useStudentDataRefresh();
  const navigation = useNavigation<any>();
  // Granular selectors: only re-render when bookmarks/lastRead actually change (never on
  // unrelated Redux churn), and never re-read the whole studentData blob on a pageMap flip.
  const bookmarks = useSelector((s: any) => s.student.studentData?.bookmarks);
  const lastRead = useSelector((s: any) => s.student.studentData?.lastRead);
  // Type-coerced reading mark (cloud round-trips can deliver string ids) — the pin,
  // the page-batch collect and the LAST READ card all derive from these.
  const lrSurah = lastRead ? Number(lastRead.surah) : 0;
  const lrVerse = lastRead ? Number(lastRead.verse) : 0;
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const nightMode = !!useSelector((s: any) => s.settings?.nightMode);

  const [pageMap, setPageMap] = useState<Record<string, number>>(() => ({ ...sessionPageCache }));
  const pageMapRef = useRef<Record<string, number>>(pageMap);
  const pendingPagesRef = useRef<Set<string>>(new Set());

  // Sort with a PRECOMPUTED epoch-ms map instead of `new Date(...)` inside the comparator
  // (which previously did ~2·n·log n Date parses synchronously at mount AND on every refresh
  // re-render — the dominant first-frame cost on phones with many bookmarks).
  const sortedBookmarks = React.useMemo(() => {
    const list: any[] = bookmarks ? (Object.values(bookmarks) as any[]) : [];
    const createdAtMs = new Map<string, number>();
    for (const b of list) createdAtMs.set(pageKey(b.surah, b.verse), toMillis(b.createdAt));
    return list.sort(
      (a: any, b: any) =>
        (createdAtMs.get(pageKey(b.surah, b.verse)) || 0) - (createdAtMs.get(pageKey(a.surah, a.verse)) || 0),
    );
  }, [bookmarks]);

  // ONE background getVersePagesDB call per bookmark/lastRead set — every mushaf-page lookup
  // is batched into a single SQLite query, and card renders never touch the DB. The in-flight
  // set dedupes a still-pending pair (canvas a re-run of this effect while a query is out), and
  // resolved pairs are skipped forever so re-renders / post-refresh re-fires cost nothing.
  useEffect(() => {
    const entries: [number, number][] = [];
    const collect = (surah: number, verse: number) => {
      const key = pageKey(surah, verse);
      if (pageMapRef.current[key] !== undefined || pendingPagesRef.current.has(key)) return;
      pendingPagesRef.current.add(key);
      entries.push([surah, verse]);
    };
    for (const b of sortedBookmarks) collect(b.surah, b.verse);
    if (lrSurah > 0) collect(lrSurah, lrVerse);
    if (!entries.length) return;
    let cancelled = false;
    getVersePagesDB(entries).then((pages) => {
      if (cancelled) return;
      const next = pageMapRef.current;
      for (const [key, page] of Object.entries(pages)) {
        pendingPagesRef.current.delete(key);
        sessionPageCache[key] = page; // seed the session cache so later visits skip this query
        if (next[key] !== page) next[key] = page;
      }
      setPageMap({ ...next });
    });
    return () => { cancelled = true; };
  }, [sortedBookmarks, lastRead?.surah, lastRead?.verse]);

  const handleNavigate = React.useCallback(
    (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any),
    [navigation],
  );

  // Unified list data: the reading mark (lastRead) is NOT pinned above the list — it is simply
  // the FIRST row (same card style, keeps its LAST READ tag), followed by the bookmarks sorted
  // newest-first by createdAt. A bookmark that IS the reading mark's verse is deduped (it would
  // otherwise appear both first and in its chronological position).
  const listData = React.useMemo(() => {
    const out: any[] = [];
    if (lrSurah > 0) out.push({ surah: lrSurah, verse: lrVerse, __lastRead: true });
    for (const b of sortedBookmarks as any[]) {
      if (lrSurah === Number(b.surah) && lrVerse === Number(b.verse)) continue;
      out.push(b);
    }
    return out;
  }, [lrSurah, lrVerse, sortedBookmarks]);

  // Per-card display data (surah name, juz, Date/Time strings) is computed ONCE per bookmark
  // set instead of inside every card render — pageMap flips (which re-render visible cards)
  // now never re-parse dates, and the juz linear-scan happens once per bookmark, not per frame.
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
        style={[styles(nightMode).card, nightMode ? styles(nightMode).cardDark : styles(nightMode).cardLight]}
        onPress={() => handleNavigate(item.surah, item.verse)}
        activeOpacity={0.7}
      >
        {/* One-line top row: [LAST READ tag] [Surah name] [Date] [Time] — the name flexes and
            truncates so the chips stay right-aligned; saves a full row per card. */}
        <View style={[styles(nightMode).topRow, styles(nightMode).topRowCompact]}>
          {item.__lastRead ? (
            <Text style={[styles(nightMode).lastReadTag, { marginBottom: 0 }]}>LAST READ</Text>
          ) : null}
          <Text style={[styles(nightMode).surahName, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>{meta.name}</Text>
          <View style={[styles(nightMode).chip, nightMode ? styles(nightMode).chipDateDark : styles(nightMode).chipDateLight]}>
            <Text style={[styles(nightMode).chipText, nightMode ? styles(nightMode).chipDateTextDark : styles(nightMode).chipDateTextLight]}>
              {meta.date}
            </Text>
          </View>
          <View style={[styles(nightMode).chip, nightMode ? styles(nightMode).chipTimeDark : styles(nightMode).chipTimeLight]}>
            <Text style={[styles(nightMode).chipText, nightMode ? styles(nightMode).chipTimeTextDark : styles(nightMode).chipTimeTextLight]}>
              {meta.time}
            </Text>
          </View>
        </View>
        <View style={[styles(nightMode).metaStack, nightMode ? styles(nightMode).metaStackDark : styles(nightMode).metaStackLight]}>
          <View style={styles(nightMode).metaItem}>
            <Text style={[styles(nightMode).metaLabel, { color: '#9aa0b5' }]}>Surah</Text>
            <Text style={[styles(nightMode).metaValue, nightMode ? styles(nightMode).metaValueDark : styles(nightMode).metaValueLight]}>{item.surah}</Text>
          </View>
          <View style={styles(nightMode).metaSeparator} />
          <View style={styles(nightMode).metaItem}>
            <Text style={[styles(nightMode).metaLabel, { color: '#9aa0b5' }]}>Ayah</Text>
            <Text style={[styles(nightMode).metaValue, nightMode ? styles(nightMode).metaValueDark : styles(nightMode).metaValueLight]}>{item.verse}</Text>
          </View>
          <View style={styles(nightMode).metaSeparator} />
          <View style={styles(nightMode).metaItem}>
            <Text style={[styles(nightMode).metaLabel, { color: '#9aa0b5' }]}>Juz</Text>
            <Text style={[styles(nightMode).metaValue, nightMode ? styles(nightMode).metaValueDark : styles(nightMode).metaValueLight]}>{meta.juz}</Text>
          </View>
          <View style={styles(nightMode).metaSeparator} />
          <View style={styles(nightMode).metaItem}>
            <Text style={[styles(nightMode).metaLabel, { color: '#9aa0b5' }]}>Page</Text>
            <Text style={[styles(nightMode).metaValue, nightMode ? styles(nightMode).metaValueDark : styles(nightMode).metaValueLight]}>{page !== undefined && page > 0 ? page : '…'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [cardMeta, pageMap, nightMode, handleNavigate]);

  return (
    <View style={[styles(nightMode).container, nightMode ? styles(nightMode).containerDark : styles(nightMode).containerLight]}>
      <ScreenHeader title="Bookmarks" subtitle={`${sortedBookmarks.length} saved`} />
      {listData.length === 0 ? (
        <View style={styles(nightMode).emptyState}>
          <Text style={styles(nightMode).emptyIcon}>📌</Text>
          <Text style={styles(nightMode).emptyText}>No bookmarks yet</Text>
          <Text style={styles(nightMode).emptySub}>Long-press a verse to bookmark it</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={listData}
          keyExtractor={(i: any, idx: number) => idx.toString()}
          contentContainerStyle={styles(nightMode).list}
          renderItem={renderBookmark}
        />
      )}
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1, padding: 10 },
  containerDark: { backgroundColor: '#121212' },
  containerLight: { backgroundColor: '#f5f5f5' },
  list: { paddingBottom: 12 },
  card: { padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardDark: { backgroundColor: '#1a1a2e', borderColor: '#2a2a4a' },
  cardLight: { backgroundColor: '#ffffff', borderColor: '#e5e7f2' },
  topRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  topRowCompact: { alignItems: 'center' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  chipDateDark: { backgroundColor: (nightMode ? `rgba(123,167,219,${0.12})` : `rgba(28,61,114,${0.12})`) },
  chipDateLight: { backgroundColor: '#e8edf7' },
  chipTimeDark: { backgroundColor: 'rgba(139,92,246,0.14)' },
  chipTimeLight: { backgroundColor: '#f1ecfe' },
  chipText: { fontSize: 9, fontWeight: '700' },
  chipDateTextDark: { color: '#9db9e4' },
  chipDateTextLight: { color: '#1C3D72' },
  chipTimeTextDark: { color: '#a78bfa' },
  chipTimeTextLight: { color: '#7c3aed' },
  surahName: { color: nightMode ? '#7BA7DB' : '#1C3D72', fontSize: 15, fontWeight: '800', borderLeftWidth: 3, borderLeftColor: nightMode ? '#7BA7DB' : '#1C3D72', paddingLeft: 8, marginBottom: 5 },
  lastReadTag: { alignSelf: 'flex-start', color: nightMode ? '#7BA7DB' : '#1C3D72', backgroundColor: (nightMode ? `rgba(123,167,219,${0.12})` : `rgba(28,61,114,${0.12})`), fontSize: 8, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginBottom: 3 },
  metaStack: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10 },
  metaStackDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' },
  metaStackLight: { backgroundColor: '#f4f5fb', borderColor: '#e5e7f2' },
  metaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  metaLabel: { fontSize: 10, fontWeight: '600' },
  metaValue: { fontSize: 10, fontWeight: '700' },
  metaValueDark: { color: '#ffffff' },
  metaValueLight: { color: '#1a1a2e' },
  metaSeparator: { height: StyleSheet.hairlineWidth, opacity: 0.5, backgroundColor: '#888' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
