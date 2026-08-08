/**
 * FILE: src/screens/BookmarksScreen.tsx
 * ROLE: Lists the current student's bookmarks (newest first) plus a pinned "LAST READ" card;
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
import { formatDate, formatTime, getJuzForVerse, toMillis } from '../utils/format';
import { getVersePagesDB } from '../database/localDB';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';

const ACCENT = '#00d4aa';
const pageKey = (surah: number, verse: number) => `${surah}_${verse}`;

// Module-level session cache for mushaf pages: verse->page mappings never change during a
// session, so a bookmark list page number resolved today is still correct at the next visit.
// This makes page-enriched first frames instant on every open AFTER the first-ever query and
// avoids re-issuing the batched SQLite lookup on each screen mount.
const sessionPageCache: Record<string, number> = {};

/**
 * WHAT: Small labeled meta chip for the card info grid (Surah # / Juz / Page / Ayat).
 * CALLS: none. AFFECTS: UI only.
 */
const MetaChip = ({ label, value, nightMode }: { label: string; value: string; nightMode: boolean }) => (
  <View style={[styles.metaChip, nightMode ? styles.metaChipDark : styles.metaChipLight]}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={[styles.metaValue, nightMode ? styles.metaValueDark : styles.metaValueLight]}>{value}</Text>
  </View>
);

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
 *       5) renders pinned "LAST READ" card if lastRead exists, else empty state or FlatList.
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

  // Per-card display data (surah name, juz, Date/Time strings) is computed ONCE per bookmark
  // set instead of inside every card render — pageMap flips (which re-render visible cards)
  // now never re-parse dates, and the juz linear-scan happens once per bookmark, not per frame.
  const cardMeta = React.useMemo(() => {
    const out: Record<string, { name: string; juz: number; date: string; time: string }> = {};
    for (const b of sortedBookmarks as any[]) {
      const key = pageKey(b.surah, b.verse);
      const ts = toMillis(b.createdAt);
      out[key] = {
        name: surahNames?.[b.surah] || `Surah ${b.surah}`,
        juz: getJuzForVerse(b.surah, b.verse),
        date: formatDate(ts),
        time: formatTime(ts),
      };
    }
    return out;
  }, [sortedBookmarks, surahNames]);

  const pinnedMeta = React.useMemo(() => {
    if (lrSurah <= 0) return null;
    const ts = toMillis(lastRead.updatedAt || lastRead.createdAt);
    return {
      name: surahNames?.[lrSurah] || `Surah ${lrSurah}`,
      juz: getJuzForVerse(lrSurah, lrVerse),
      date: ts ? formatDate(ts) : '',
      time: ts ? formatTime(ts) : '',
      ts,
    };
  }, [lastRead, lrSurah, lrVerse, surahNames]);

  const renderBookmark = React.useCallback(({ item }: any) => {
    const meta = cardMeta[pageKey(item.surah, item.verse)];
    const page = pageMap[pageKey(item.surah, item.verse)];
    return (
      <TouchableOpacity
        style={[styles.card, nightMode ? styles.cardDark : styles.cardLight]}
        onPress={() => handleNavigate(item.surah, item.verse)}
        activeOpacity={0.7}
      >
        <View style={styles.topRow}>
          <View style={[styles.chip, styles.chipDate, nightMode ? styles.chipDateDark : styles.chipDateLight]}>
            <Text style={[styles.chipText, nightMode ? styles.chipDateTextDark : styles.chipDateTextLight]}>
              Date: {meta.date}
            </Text>
          </View>
          <View style={[styles.chip, styles.chipTime, nightMode ? styles.chipTimeDark : styles.chipTimeLight]}>
            <Text style={[styles.chipText, nightMode ? styles.chipTimeTextDark : styles.chipTimeTextLight]}>
              Time: {meta.time}
            </Text>
          </View>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.surahName}>{meta.name}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.metaRow}>
          <MetaChip label="Surah #" value={String(item.surah)} nightMode={nightMode} />
          <MetaChip label="Juz" value={String(meta.juz)} nightMode={nightMode} />
          <MetaChip label="Page" value={page !== undefined && page > 0 ? String(page) : '…'} nightMode={nightMode} />
          <MetaChip label="Ayat" value={String(item.verse)} nightMode={nightMode} />
        </View>
      </TouchableOpacity>
    );
  }, [cardMeta, pageMap, nightMode, handleNavigate]);

  const renderPinned = React.useCallback(() => {
    if (lrSurah <= 0 || !pinnedMeta) return null;
    const page = pageMap[pageKey(lrSurah, lrVerse)];
    const ts = pinnedMeta.ts;
    return (
      <TouchableOpacity
        style={[styles.card, nightMode ? styles.cardDark : styles.cardLight]}
        onPress={() => handleNavigate(lrSurah, lrVerse)}
        activeOpacity={0.7}
      >
        {ts ? (
          <View style={styles.topRow}>
            <View style={[styles.chip, styles.chipDate, nightMode ? styles.chipDateDark : styles.chipDateLight]}>
              <Text style={[styles.chipText, nightMode ? styles.chipDateTextDark : styles.chipDateTextLight]}>
                Date: {pinnedMeta.date}
              </Text>
            </View>
            <View style={[styles.chip, styles.chipTime, nightMode ? styles.chipTimeDark : styles.chipTimeLight]}>
              <Text style={[styles.chipText, nightMode ? styles.chipTimeTextDark : styles.chipTimeTextLight]}>
                Time: {pinnedMeta.time}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.titleRow}>
          <Text style={styles.lastReadTag}>LAST READ</Text>
          {!ts ? <Text style={styles.verseNum}>Ayat {lrVerse}</Text> : null}
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text style={styles.surahName}>{pinnedMeta.name}</Text>
        {ts ? (
          <View style={styles.metaRow}>
            <MetaChip label="Surah #" value={String(lrSurah)} nightMode={nightMode} />
            <MetaChip label="Juz" value={String(pinnedMeta.juz)} nightMode={nightMode} />
            <MetaChip label="Page" value={page !== undefined && page > 0 ? String(page) : '…'} nightMode={nightMode} />
            <MetaChip label="Ayat" value={String(lrVerse)} nightMode={nightMode} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [lastRead, pinnedMeta, pageMap, nightMode, handleNavigate]);

  return (
    <View style={[styles.container, nightMode ? styles.containerDark : styles.containerLight]}>
      <ScreenHeader title="Bookmarks" subtitle={`${sortedBookmarks.length} saved`} />
      {renderPinned()}
      {sortedBookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📌</Text>
          <Text style={styles.emptyText}>No bookmarks yet</Text>
          <Text style={styles.emptySub}>Long-press a verse to bookmark it</Text>
        </View>
      ) : (
        <FlatList
          data={sortedBookmarks}
          keyExtractor={(i: any, idx: number) => idx.toString()}
          contentContainerStyle={styles.list}
          renderItem={renderBookmark}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  containerDark: { backgroundColor: '#121212' },
  containerLight: { backgroundColor: '#f5f5f5' },
  list: { paddingBottom: 20 },
  card: { padding: 16, borderRadius: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardDark: { backgroundColor: '#1a1a2e', borderColor: '#2a2a4a' },
  cardLight: { backgroundColor: '#ffffff', borderColor: '#e5e7f2' },
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipDate: {},
  chipTime: {},
  chipDateDark: { backgroundColor: 'rgba(0,212,170,0.12)' },
  chipDateLight: { backgroundColor: '#e6f8f4' },
  chipTimeDark: { backgroundColor: 'rgba(139,92,246,0.14)' },
  chipTimeLight: { backgroundColor: '#f1ecfe' },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipDateTextDark: { color: '#2ee6bd' },
  chipDateTextLight: { color: '#0b8f77' },
  chipTimeTextDark: { color: '#a78bfa' },
  chipTimeTextLight: { color: '#7c3aed' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  surahName: { color: ACCENT, fontSize: 20, fontWeight: '800', marginTop: 2 },
  verseNum: { color: '#888', fontSize: 13, fontWeight: '600' },
  chevron: { color: ACCENT, fontSize: 26, fontWeight: '400', opacity: 0.7, marginTop: -2 },
  lastReadTag: { alignSelf: 'flex-start', color: ACCENT, backgroundColor: 'rgba(0,212,170,0.12)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  metaChipDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' },
  metaChipLight: { backgroundColor: '#f4f5fb', borderColor: '#e5e7f2' },
  metaLabel: { color: '#9aa0b5', fontSize: 9, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  metaValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  metaValueDark: { color: '#ffffff' },
  metaValueLight: { color: '#1a1a2e' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#555', fontSize: 12, marginTop: 4 },
});
