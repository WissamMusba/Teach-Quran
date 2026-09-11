import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { formatDate, formatTime, getJuzForVerse, toMillis } from '../utils/format';
import { getVersePagesDB, getManifest, saveManifestLocal, saveStudentData } from '../database/localDB';
import { getVersePage } from '../database/quranData';
import { setStudentData } from '../store/studentSlice';
import { addPendingChange } from '../store/syncSlice';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';
import { getThemeColors } from '../utils/theme';

const pageKey = (surah: number, verse: number) => `${surah}_${verse}`;
const sessionPageCache: Record<string, number> = {};

// Module-level cache to retain loaded bookmarks, dailyMarkItem, cardMeta across screen re-entries
const studentBookmarksCache: Record<string, {
  regularBookmarks: any[];
  dailyMarkItem: any;
  cardMeta: Record<string, { name: string; juz: number; date: string; time: string }>;
}> = {};

const IconBookmark = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

const IconTrash = ({ c, size = 15 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

export default function BookmarksScreen({ onClose, navigation: navProp }: { onClose?: () => void; navigation?: any } = {}) {
  const dispatch = useDispatch();
  const navigation = navProp || useNavigation<any>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const currentStudent = useSelector((s: any) => s.student.currentStudent);
  const studentData = useSelector((s: any) => s.student.studentData);
  const bookmarks = studentData?.bookmarks;
  const lastRead = studentData?.lastRead;
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

  const dailyMarkItem = useMemo(() => {
    if (lrSurah > 0 && lrVerse > 0) {
      return { surah: lrSurah, verse: lrVerse, __lastRead: true };
    }
    return null;
  }, [lrSurah, lrVerse]);

  const regularBookmarks = useMemo(() => {
    const out: any[] = [];
    for (const b of sortedBookmarks as any[]) {
      if (lrSurah === Number(b.surah) && lrVerse === Number(b.verse)) continue;
      out.push(b);
    }
    return out;
  }, [lrSurah, lrVerse, sortedBookmarks]);

  // Prevent false empty state while hydrating
  const currentStudentId = currentStudent?.id || '';
  const cached = currentStudentId ? studentBookmarksCache[currentStudentId] : null;

  const isHydrating = !studentData || studentData.bookmarks === undefined;
  const prevRegularBookmarksRef = useRef<any[]>(cached?.regularBookmarks || []);
  const prevDailyMarkRef = useRef<any>(cached?.dailyMarkItem || null);
  const prevCardMetaRef = useRef<Record<string, { name: string; juz: number; date: string; time: string }>>(cached?.cardMeta || {});

  const prevStudentIdRef = useRef<string>(currentStudentId);
  if (prevStudentIdRef.current !== currentStudentId) {
    prevStudentIdRef.current = currentStudentId;
    const c = currentStudentId ? studentBookmarksCache[currentStudentId] : null;
    prevRegularBookmarksRef.current = c?.regularBookmarks || [];
    prevDailyMarkRef.current = c?.dailyMarkItem || null;
    prevCardMetaRef.current = c?.cardMeta || {};
  }

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

  // Retain loaded bookmarks, dailyMarkItem, cardMeta across renders and screen re-entries
  if (regularBookmarks.length > 0) {
    prevRegularBookmarksRef.current = regularBookmarks;
  }
  if (dailyMarkItem) {
    prevDailyMarkRef.current = dailyMarkItem;
  }
  if (Object.keys(cardMeta).length > 0) {
    prevCardMetaRef.current = cardMeta;
  }
  if (currentStudentId && !isHydrating) {
    if (regularBookmarks.length > 0 || dailyMarkItem) {
      studentBookmarksCache[currentStudentId] = {
        regularBookmarks,
        dailyMarkItem,
        cardMeta: Object.keys(cardMeta).length > 0
          ? cardMeta
          : (studentBookmarksCache[currentStudentId]?.cardMeta || prevCardMetaRef.current),
      };
    }
  }

  useEffect(() => {
    if (!isHydrating) {
      prevRegularBookmarksRef.current = regularBookmarks;
      prevDailyMarkRef.current = dailyMarkItem;
      if (Object.keys(cardMeta).length > 0) {
        prevCardMetaRef.current = cardMeta;
      }
      if (currentStudentId) {
        studentBookmarksCache[currentStudentId] = {
          regularBookmarks,
          dailyMarkItem,
          cardMeta: Object.keys(cardMeta).length > 0
            ? cardMeta
            : (studentBookmarksCache[currentStudentId]?.cardMeta || prevCardMetaRef.current),
        };
      }
    }
  }, [isHydrating, regularBookmarks, dailyMarkItem, cardMeta, currentStudentId]);

  useEffect(() => {
    if (!studentData && currentStudentId) {
      getManifest(currentStudentId).then((m) => {
        if (m?.data && (m.data.bookmarks || m.data.lastRead)) {
          dispatch(setStudentData({
            ...(studentData || {}),
            bookmarks: m.data.bookmarks || {},
            lastRead: m.data.lastRead || null,
          }));
        }
      }).catch(() => {});
    }
  }, [studentData, currentStudentId, dispatch]);

  const effectiveRegularBookmarks = (regularBookmarks.length > 0 || !isHydrating)
    ? regularBookmarks
    : prevRegularBookmarksRef.current;

  const effectiveDailyMark = (dailyMarkItem || !isHydrating)
    ? dailyMarkItem
    : prevDailyMarkRef.current;

  const effectiveCardMeta = Object.keys(cardMeta).length > 0
    ? cardMeta
    : prevCardMetaRef.current;

  const [pageMap, setPageMap] = useState<Record<string, number>>(() => ({ ...sessionPageCache }));
  const [undoItem, setUndoItem] = useState<{ key: string; data: any } | null>(null);
  const undoTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

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

    if (effectiveDailyMark?.surah && effectiveDailyMark?.verse) {
      check(effectiveDailyMark.surah, effectiveDailyMark.verse);
    }
    for (const b of effectiveRegularBookmarks as any[]) {
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
  }, [effectiveRegularBookmarks, effectiveDailyMark, textStyle]);

  const handleNavigate = React.useCallback(
    (surah: number, verse: number, page?: number) => {
      const targetPage = page || pageMap[pageKey(surah, verse)];
      if (targetPage) {
        navigation.navigate('QuranView' as any, {
          page: targetPage,
          surahId: surah,
          scrollToVerse: verse,
          t: Date.now(),
        } as any);
        return;
      }
      getVersePage(surah, verse, textStyle)
        .then((resolvedPage) => {
          navigation.navigate('QuranView' as any, {
            page: resolvedPage || 1,
            surahId: surah,
            scrollToVerse: verse,
            t: Date.now(),
          } as any);
        })
        .catch(() => {
          navigation.navigate('QuranView' as any, {
            page: 1,
            surahId: surah,
            scrollToVerse: verse,
            t: Date.now(),
          } as any);
        });
    },
    [navigation, pageMap, textStyle],
  );

  const handleBack = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      navigation.goBack();
    }
  }, [onClose, navigation]);

  const handleDelete = useCallback((surah: number, verse: number) => {
    const vKey = `${surah}_${verse}`;
    const oldBookmark = bookmarks?.[vKey] || { surah, verse, createdAt: new Date().toISOString() };
    const newMarks = { ...(bookmarks || {}) };
    delete newMarks[vKey];

    const updatedStudentData = { ...(studentData || {}), bookmarks: newMarks };
    dispatch(setStudentData(updatedStudentData));

    if (currentStudent?.id) {
      getManifest(currentStudent.id).then(m => {
        m.data.bookmarks = newMarks;
        m.data.v++;
        m.data.deletedBookmarks = { ...(m.data.deletedBookmarks || {}), [vKey]: new Date().toISOString() };
        saveManifestLocal(currentStudent.id, m.data);
      }).catch(() => {});
      saveStudentData(currentStudent.id, updatedStudentData).catch(() => {});
      dispatch(addPendingChange());
    }

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoItem({ key: vKey, data: oldBookmark });
    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null);
    }, 5000);
  }, [bookmarks, studentData, currentStudent?.id, dispatch]);

  const handleUndo = useCallback(() => {
    if (!undoItem) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { key, data: restoredData } = undoItem;
    const newMarks = { ...(bookmarks || {}), [key]: restoredData };
    const updatedStudentData = { ...(studentData || {}), bookmarks: newMarks };

    dispatch(setStudentData(updatedStudentData));

    if (currentStudent?.id) {
      getManifest(currentStudent.id).then(m => {
        m.data.bookmarks = newMarks;
        m.data.v++;
        if (m.data.deletedBookmarks?.[key]) {
          delete m.data.deletedBookmarks[key];
        }
        saveManifestLocal(currentStudent.id, m.data);
      }).catch(() => {});
      saveStudentData(currentStudent.id, updatedStudentData).catch(() => {});
      dispatch(addPendingChange());
    }

    setUndoItem(null);
  }, [undoItem, bookmarks, studentData, currentStudent?.id, dispatch]);

  const displayData = useMemo(() => {
    if (isTablet && effectiveRegularBookmarks.length % 2 !== 0) {
      return [...effectiveRegularBookmarks, { __empty: true }];
    }
    return effectiveRegularBookmarks;
  }, [isTablet, effectiveRegularBookmarks]);

  const renderCard = useCallback((item: any, isHeader = false) => {
    const meta = effectiveCardMeta[pageKey(item.surah, item.verse)];
    const page = pageMap[pageKey(item.surah, item.verse)] ?? sessionPageCache[pageKey(item.surah, item.verse)];
    return (
      <TouchableOpacity
        style={[
          styles(nightMode, themeColors).card,
          isTablet && !isHeader && { flex: 1 },
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.border,
          }
        ]}
        onPress={() => handleNavigate(item.surah, item.verse, page)}
        activeOpacity={0.8}
      >
        <View style={styles(nightMode, themeColors).topRow}>
          {!item.__lastRead && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                handleDelete(item.surah, item.verse);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles(nightMode, themeColors).trashBtn}
            >
              <IconTrash c={nightMode ? '#FF6B6B' : '#DC2626'} size={15} />
            </TouchableOpacity>
          )}

          {item.__lastRead ? (
            <View style={[styles(nightMode, themeColors).dailyMarkBadge, { backgroundColor: themeColors.gold + '22', borderColor: themeColors.gold }]}>
              <Text style={[styles(nightMode, themeColors).dailyMarkText, { color: themeColors.gold }]}>
                Daily Recitation Mark
              </Text>
            </View>
          ) : null}

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

        <View style={[styles(nightMode, themeColors).metaGrid, { backgroundColor: nightMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: themeColors.border }]}>
          {/* Row 1: Juz (label left, value right) | Vertical Separator | Page (label left, value right) */}
          <View style={styles(nightMode, themeColors).metaRow}>
            <View style={styles(nightMode, themeColors).metaCell}>
              <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Juz</Text>
              <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{meta?.juz ?? '…'}</Text>
            </View>
            <View style={[styles(nightMode, themeColors).metaVertSeparator, { backgroundColor: themeColors.border }]} />
            <View style={styles(nightMode, themeColors).metaCell}>
              <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Page</Text>
              <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{page !== undefined ? page : '…'}</Text>
            </View>
          </View>

          {/* Horizontal Separator */}
          <View style={[styles(nightMode, themeColors).metaHorizSeparator, { backgroundColor: themeColors.border }]} />

          {/* Row 2: Surah (label left, value right) | Vertical Separator | Ayah (label left, value right) */}
          <View style={styles(nightMode, themeColors).metaRow}>
            <View style={styles(nightMode, themeColors).metaCell}>
              <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Surah</Text>
              <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{item.surah}</Text>
            </View>
            <View style={[styles(nightMode, themeColors).metaVertSeparator, { backgroundColor: themeColors.border }]} />
            <View style={styles(nightMode, themeColors).metaCell}>
              <Text style={[styles(nightMode, themeColors).metaLabel, { color: themeColors.subText }]}>Ayah</Text>
              <Text style={[styles(nightMode, themeColors).metaValue, { color: themeColors.text }]}>{item.verse}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [effectiveCardMeta, pageMap, handleNavigate, handleDelete, nightMode, themeColors, isTablet]);

  const renderBookmark = useCallback(({ item }: any) => {
    if (item.__empty) {
      return (
        <View
          style={[
            styles(nightMode, themeColors).card,
            { flex: 1, backgroundColor: 'transparent', borderColor: 'transparent', elevation: 0, shadowOpacity: 0 }
          ]}
        />
      );
    }
    return renderCard(item, false);
  }, [renderCard, nightMode, themeColors]);

  const renderHeader = useCallback(() => {
    if (!effectiveDailyMark) return null;
    return (
      <View style={{ width: '100%' }}>
        {renderCard(effectiveDailyMark, true)}
      </View>
    );
  }, [effectiveDailyMark, renderCard]);

  const totalCount = effectiveRegularBookmarks.length + (effectiveDailyMark ? 1 : 0);

  return (
    <View style={[styles(nightMode, themeColors).container, { backgroundColor: themeColors.bg }]}>
      <ScreenHeader
        title="Bookmarks"
        subtitle={totalCount === 1 ? '1 bookmark' : `${totalCount} bookmarks`}
        onBack={handleBack}
      />

      {undoItem && (
        <View style={[styles(nightMode, themeColors).undoToast, { backgroundColor: themeColors.cardBg, borderColor: themeColors.accent }]}>
          <Text style={[styles(nightMode, themeColors).undoText, { color: themeColors.text }]} numberOfLines={1}>Bookmark removed</Text>
          <TouchableOpacity onPress={handleUndo} style={[styles(nightMode, themeColors).undoBtn, { backgroundColor: themeColors.accent }]} activeOpacity={0.7}>
            <Text style={styles(nightMode, themeColors).undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {totalCount === 0 ? (
        <View style={styles(nightMode, themeColors).emptyState}>
          <IconBookmark c={themeColors.accent} size={44} />
          <Text style={[styles(nightMode, themeColors).emptyText, { color: themeColors.subText, marginTop: 12 }]}>No bookmarks yet</Text>
          <Text style={[styles(nightMode, themeColors).emptySub, { color: themeColors.subText }]}>Long-press a verse to bookmark it</Text>
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-2' : 'phone-1'}
          style={{ flex: 1 }}
          data={displayData}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? { gap: 10 } : undefined}
          keyExtractor={(i: any, idx: number) => (i.__empty ? `__empty_${idx}` : `${i.surah}_${i.verse}_${i.__lastRead ? 'lr' : 'bm'}`)}
          contentContainerStyle={styles(nightMode, themeColors).list}
          ListHeaderComponent={renderHeader}
          renderItem={renderBookmark}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 10, paddingBottom: 12 },
  card: { padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  topRow: { flexDirection: 'row', gap: 6, marginBottom: 5, flexWrap: 'wrap', alignItems: 'center' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 9, fontWeight: '700' },
  surahName: { fontSize: 15, fontWeight: '800', borderLeftWidth: 3, paddingLeft: 8, marginBottom: 5 },
  dailyMarkBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  dailyMarkText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  trashBtn: { paddingHorizontal: 4, paddingVertical: 2, marginRight: 2, justifyContent: 'center', alignItems: 'center' },
  undoToast: {
    position: 'absolute',
    right: 14,
    top: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 9999,
    gap: 10,
  },
  undoText: { fontSize: 13, fontWeight: '600' },
  undoBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  undoBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  metaGrid: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaCell: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
  },
  metaLabel: { fontSize: 11, fontWeight: '600' },
  metaValue: { fontSize: 12.5, fontWeight: '700' },
  metaVertSeparator: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', opacity: 0.6 },
  metaHorizSeparator: { height: StyleSheet.hairlineWidth, width: '100%', opacity: 0.6 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 12, marginTop: 4 },
});

