/**
 * FILE: src/screens/StudentHubScreen.tsx
 * ROLE: Per-student hub opened from a Dashboard student card — 6 rows (RESUME =
 *       local last page VIEWED, BOOKMARKS & NOTES split row, DAILY RECITATION =
 *       the lastRead reading mark, JUZ/PARA INDEX, SURAH INDEX, GO TO PAGE #)
 *       that deep-link into QuranView / Bookmarks / Notes.
 * DEPENDS ON: src/database/localDB.ts (getStudentData), src/database/quranData.ts
 *             (getVersePage), src/utils/theme.ts (JUZ_MAP), Redux student/settings/
 *             quran/sync slices, react-native-svg.
 * USED BY: registered as stack screen "StudentHub" in App.tsx; reached from
 *          DashboardScreen.tsx (student card tap).
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Keyboard } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { getStudentData, getLastPageSeenLocal, getManifest } from '../database/localDB';
import { setStudentData } from '../store/studentSlice';
import { getVersePage } from '../database/quranData';
import { JUZ_MAP } from '../utils/theme';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';

/** Epoch-ms normalization for any timestamp-ish value (ISO string / ms / Firestore Timestamp). */
const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?._seconds === 'number') return v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6);
  return 0;
};

/** "Just now" / "5 mins ago" / "3 hrs ago" / "2 days ago"; '' for missing timestamps. */
const timeAgo = (ts: any): string => {
  const t = toMillis(ts);
  if (!t) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

/** 1-30: the juz containing a surah+verse (linear scan of JUZ_MAP — mirror of src/utils/format.ts getJuzForVerse). */
const getJuzForVerse = (surahId: number, verseNum: number): number => {
  let juz = 1;
  for (const entry of JUZ_MAP) {
    if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) juz = entry.j;
  }
  return juz;
};

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
);

const ArrowRight = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);

/**
 * WHAT: Per-student hub screen — shows live counts + the student's reading position
 *       straight from SQLite, refreshed on focus and after every completed sync, and
 *       deep-links into the reader / list screens.
 * FLOW: 1) useStudentDataRefresh keeps studentData fresh (focus reload gated while a
 *       pull is in flight — a mid-pull reload would show PARTIAL data — plus a
 *       syncing->synced watcher); 2) RESUME resolves the LOCAL last-viewed page
 *       (lastPageSeen in local_student_state — never synced) -> page via
 *       getVersePage (script-aware) + juz via JUZ_MAP scan, falling back to
 *       lastRead, else page 1; 3) DAILY RECITATION = the lastRead reading mark;
 *       4) rows navigate with the same { surahId, scrollToVerse } / { page }
 *       params QuranViewScreen consumes.
 * CALLS: getStudentData, getLastPageSeenLocal (localDB), getVersePage (quranData), navigation.navigate.
 * CALLED BY: React Navigation (registered in the root stack; opened via DashboardScreen).
 * AFFECTS: s.student.studentData (focus re-hydration); navigation.
 * NOTES: RESUME is always enabled — header w/ no saved page yet falls back to
 *        lastRead, else page 1 / Al-Fatiha (surah 1 verse 1); DAILY RECITATION
 *        greys out only when the student has no reading mark (lastRead) at all.
 */
export default function StudentHubScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const currentStudent = useSelector((s: any) => s.student.currentStudent);
  const studentData = useSelector((s: any) => s.student.studentData);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const [pageInput, setPageInput] = useState('');

  useStudentDataRefresh();

  /**
   * DAILY RECITATION source — the SQLite MANIFEST's lastRead, re-read on every
   * focus (authoritative). Redux studentData.lastRead is ONLY a pre-read
   * fallback (undefined = not loaded yet): a stale reload clobbering the
   * optimistic mark must never grey out the row, and the reader now flushes
   * lastRead to SQLite immediately, so by the time the hub regains focus the
   * manifest is fresh. Reference-stable setState (JSON compare) so the focus
   * re-read never loops.
   */
  const [manifestLastRead, setManifestLastRead] = useState<any>(undefined);
  const lastRead = manifestLastRead === undefined ? studentData?.lastRead : manifestLastRead;
  const lrSurah = lastRead ? Number(lastRead.surah) : 0;
  const lrVerse = lastRead ? Number(lastRead.verse) : 0;

  /**
   * RESUME target — LOCAL last-viewed page (lastPageSeen), falling back to the
   * lastRead mark, else page 1. lastPageSeen is read from SQLite (per student,
   * never synced) and resolved script-aware to {page, juz, surah, verse}.
   * DAILY RECITATION reads the same lastRead below (the reading mark).
   * Runs on EVERY focus (not just mount): the reader writes saveLastPageSeenLocal
   * per page change, so returning from QuranView must re-read it here — a plain
   * useEffect keyed only on student/lastRead/textStyle would stay stale forever
   * (the mounted hub's deps don't change when the reader scrolls).
   */
  const [resumeInfo, setResumeInfo] = useState<{ page: number; juz: number; surah: number; verse: number } | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string>('');
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const choose = (seen: any) => {
      setLastSeenAt(seen?.at ? String(seen.at) : '');
      if (seen && Number(seen.surah) > 0 && Number(seen.verse) > 0) return { surah: Number(seen.surah), verse: Number(seen.verse) };
      if (lrSurah > 0 && lrVerse > 0) return { surah: lrSurah, verse: lrVerse };
      return null;
    };
    const apply = (src: any) => {
      if (cancelled) return;
      if (!src) { setResumeInfo({ page: 1, juz: 1, surah: 1, verse: 1 }); return; }
      getVersePage(src.surah, src.verse, textStyle).then(pg => {
        if (!cancelled) setResumeInfo({ page: pg, juz: getJuzForVerse(src.surah, src.verse), surah: src.surah, verse: src.verse });
      }).catch(() => { if (!cancelled) setResumeInfo({ page: 1, juz: getJuzForVerse(src.surah, src.verse), surah: src.surah, verse: src.verse }); });
    };
    if (currentStudent?.id) {
      getLastPageSeenLocal(currentStudent.id).then(seen => apply(choose(seen))).catch(() => apply(choose(null)));
      getManifest(currentStudent.id).then(m => {
        if (cancelled) return;
        const lr = m?.data?.lastRead || null;
        setManifestLastRead(prev => JSON.stringify(prev) === JSON.stringify(lr) ? prev : lr);
      }).catch(() => {});
    } else {
      apply(choose(null));
    }
    return () => { cancelled = true; };
  }, [currentStudent?.id, lrSurah, lrVerse, textStyle]));

  const resumeSubtitle = useMemo(() => {
    if (!resumeInfo) return '';
    const parts = [`Reading page ${resumeInfo.page + 1}`, `Para ${resumeInfo.juz}`];
    const t = lastSeenAt || (lastRead?.updatedAt ? String(lastRead.updatedAt) : '');
    const ago = timeAgo(t);
    if (ago) parts.push(ago);
    return parts.join(' · ');
  }, [lastRead, resumeInfo, lastSeenAt]);

  // DAILY RECITATION target: the reading mark (lastRead) — set via the
  // "Set Reading Mark" menu in the reader. Enabled only when it exists.
  const dailyTarget = lrSurah > 0 && lrVerse > 0 ? { surah: lrSurah, verse: lrVerse } : null;
  const [dailyPage, setDailyPage] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!dailyTarget) { setDailyPage(0); return; }
    getVersePage(lrSurah, lrVerse, textStyle).then(pg => {
      if (!cancelled) setDailyPage(pg);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [dailyTarget, lrSurah, lrVerse, textStyle]);
  const dailySubtitle = dailyTarget
    ? `${surahNames?.[lrSurah] || `Surah ${lrSurah}`} · Verse ${lrVerse}${dailyPage > 0 ? ` · Page ${dailyPage + 1}` : ''}${(lastRead?.updatedAt ? ` · ${timeAgo(String(lastRead.updatedAt))}` : '')}`
    : 'No reading mark yet';

  const bookmarkCount = Object.keys(studentData?.bookmarks || {}).length;
  const noteCount = Object.values(studentData?.notes || {}).filter(Boolean).length;

  const pageNum = pageInput !== '' ? parseInt(pageInput, 10) : 0;
  const pageValid = pageInput !== '' && pageNum >= 1 && pageNum <= 610;

  const handlePageSubmit = () => {
    if (!pageValid) return;
    navigation.navigate('QuranView' as any, { page: pageNum } as any);
    setPageInput('');
    Keyboard.dismiss();
  };

  const openVerse = (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any);

  const isDark = nightMode;
  const bg = isDark ? '#1a1a2e' : '#f5f5f5';
  const rowBg = isDark ? '#22223a' : '#ffffff';
  const border = isDark ? '#2a2a4a' : '#e0e0e4';
  const titleC = isDark ? '#ffffff' : '#1a1a1a';
  const subC = isDark ? '#8a8a8a' : '#777777';
  const cardBorder = isDark ? '#2a2a4a' : '#e0e0e4';
  const inputBg = isDark ? '#1a1a2e' : '#f5f5f5';

  return (
    <View style={[styles(nightMode).container, { backgroundColor: bg }]}>
      {/* inline header (back + title + student name), consistent with the Juz/Surah index screens */}
      <View style={[styles(nightMode).header, { backgroundColor: rowBg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles(nightMode).backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c={(nightMode ? '#7BA7DB' : '#1C3D72')} />
        </TouchableOpacity>
        <View style={styles(nightMode).headerTextWrap}>
          <Text style={[styles(nightMode).headerTitle, { color: titleC }]}>Teach Quran</Text>
          <Text style={[styles(nightMode).headerSubtitle, { color: subC }]} numberOfLines={1}>{currentStudent?.name || ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles(nightMode).scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles(nightMode).card, { backgroundColor: rowBg, borderColor: cardBorder }]}>
          {/* 1 — RESUME: local last page VIEWED (falls back to lastRead, else page 1). */}
          <TouchableOpacity style={[styles(nightMode).row, styles(nightMode).rowBorder, { borderBottomColor: border }]}
            onPress={() => resumeInfo && openVerse(resumeInfo.surah, resumeInfo.verse)} activeOpacity={0.7}>
            <Text style={[styles(nightMode).rowLabel, { color: titleC }]}>RESUME</Text>
            <Text style={[styles(nightMode).rowSub, { color: subC }]} numberOfLines={1}>{resumeSubtitle}</Text>
          </TouchableOpacity>

          {/* 2 — BOOKMARKS & NOTES: one row split in two halves (vertical divider) */}
          <View style={[styles(nightMode).row, styles(nightMode).rowBorder, { borderBottomColor: border, paddingLeft: 0, paddingRight: 0 }]}>
            <TouchableOpacity style={styles(nightMode).half} onPress={() => navigation.navigate('Bookmarks')} activeOpacity={0.7}>
              <Text style={[styles(nightMode).halfLabel, { color: titleC }]}>BOOKMARKS</Text>
              <Text style={styles(nightMode).halfCount}>{bookmarkCount}</Text>
            </TouchableOpacity>
            <View style={[styles(nightMode).vDivider, { backgroundColor: border }]} />
            <TouchableOpacity style={styles(nightMode).half} onPress={() => navigation.navigate('Notes')} activeOpacity={0.7}>
              <Text style={[styles(nightMode).halfLabel, { color: titleC }]}>NOTES</Text>
              <Text style={styles(nightMode).halfCount}>{noteCount}</Text>
            </TouchableOpacity>
          </View>

          {/* 3 — DAILY RECITATION (the lastRead reading mark; enabled only when it exists) */}
          <TouchableOpacity style={[styles(nightMode).row, styles(nightMode).rowBorder, { borderBottomColor: border }, !dailyTarget && styles(nightMode).rowDisabled]}
            onPress={() => dailyTarget && openVerse(dailyTarget.surah, dailyTarget.verse)} disabled={!dailyTarget} activeOpacity={0.7}>
            <Text style={[styles(nightMode).rowLabel, { color: titleC }]}>DAILY RECITATION</Text>
            <Text style={[styles(nightMode).rowSub, { color: subC }]} numberOfLines={1}>{dailySubtitle}</Text>
          </TouchableOpacity>

          {/* 4 — JUZ/PARA INDEX */}
          <TouchableOpacity style={[styles(nightMode).row, styles(nightMode).rowBorder, { borderBottomColor: border }]} onPress={() => navigation.navigate('JuzIndex')} activeOpacity={0.7}>
            <Text style={[styles(nightMode).rowLabel, { color: titleC }]}>JUZ/PARA INDEX</Text>
          </TouchableOpacity>

          {/* 5 — SURAH INDEX */}
          <TouchableOpacity style={[styles(nightMode).row, styles(nightMode).rowBorder, { borderBottomColor: border }]} onPress={() => navigation.navigate('SurahIndex')} activeOpacity={0.7}>
            <Text style={[styles(nightMode).rowLabel, { color: titleC }]}>SURAH INDEX</Text>
          </TouchableOpacity>

          {/* 6 — GO TO PAGE # (valid integer 1..610 -> QuranView { page }) */}
          <View style={[styles(nightMode).row, { borderBottomWidth: 0 }]}>
            <Text style={[styles(nightMode).rowLabel, { color: titleC }]}>GO TO PAGE #</Text>
            <View style={styles(nightMode).pageRowRight}>
              <TextInput style={[styles(nightMode).pageInput, { color: titleC, borderColor: border, backgroundColor: inputBg }]}
                value={pageInput} onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad" placeholder="1–610" placeholderTextColor={subC}
                maxLength={3} returnKeyType="go" onSubmitEditing={handlePageSubmit} />
              <TouchableOpacity style={[styles(nightMode).pageGo, { opacity: pageValid ? 1 : 0.35 }]} onPress={handlePageSubmit} disabled={!pageValid} activeOpacity={0.7}>
                <ArrowRight c="#121212" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      <CollapsibleBannerAd />
    </View>
  );
}
const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 16 },
  card: { borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  row: { minHeight: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, paddingRight: 16 },
  rowBorder: { borderBottomWidth: 1 },
  rowDisabled: { opacity: 0.45 },
  rowLabel: { fontSize: 21, fontWeight: '700' },
  rowSub: { fontSize: 12.5, marginTop: 4, maxWidth: '75%' },
  half: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center' },
  halfLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  halfCount: { fontSize: 24, fontWeight: '700', marginTop: 2, color: (nightMode ? '#7BA7DB' : '#1C3D72') },
  vDivider: { width: 1, alignSelf: 'stretch' },
  pageRowRight: { flexDirection: 'row', alignItems: 'center' },
  pageInput: { width: 92, height: 36, borderRadius: 18, borderWidth: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', paddingHorizontal: 8 },
  pageGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
});