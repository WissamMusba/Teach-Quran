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
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Keyboard } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { getStudentData, getLastPageSeenLocal } from '../database/localDB';
import { setStudentData } from '../store/studentSlice';
import { getVersePage } from '../database/quranData';
import { JUZ_MAP } from '../utils/theme';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';

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

  const lastRead = studentData?.lastRead;
  const lrSurah = lastRead ? Number(lastRead.surah) : 0;
  const lrVerse = lastRead ? Number(lastRead.verse) : 0;

  /**
   * RESUME target — LOCAL last-viewed page (lastPageSeen), falling back to the
   * lastRead mark, else page 1. lastPageSeen is read from SQLite (per student,
   * never synced) and resolved script-aware to {page, juz, surah, verse}.
   * DAILY RECITATION reads the same lastRead below (the reading mark).
   */
  const [resumeInfo, setResumeInfo] = useState<{ page: number; juz: number; surah: number; verse: number } | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string>('');
  useEffect(() => {
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
    } else {
      apply(choose(null));
    }
    return () => { cancelled = true; };
  }, [currentStudent?.id, lrSurah, lrVerse, textStyle]);

  const resumeSubtitle = useMemo(() => {
    if (!resumeInfo) return '';
    const parts = [`Reading page ${resumeInfo.page}`, `Para ${resumeInfo.juz}`];
    const t = lastSeenAt || (lastRead?.updatedAt ? String(lastRead.updatedAt) : '');
    const ago = timeAgo(t);
    if (ago) parts.push(ago);
    return parts.join(' · ');
  }, [lastRead, resumeInfo, lastSeenAt]);

  // DAILY RECITATION target: the reading mark (lastRead) — set via the
  // "Set Reading Mark" menu in the reader. Enabled only when it exists.
  const dailyTarget = lrSurah > 0 && lrVerse > 0 ? { surah: lrSurah, verse: lrVerse } : null;
  const dailySubtitle = dailyTarget
    ? `${surahNames?.[lrSurah] || `Surah ${lrSurah}`} · Verse ${lrVerse}`
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
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* inline header (back + title + student name), consistent with the Juz/Surah index screens */}
      <View style={[styles.header, { backgroundColor: rowBg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c="#00d4aa" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: titleC }]}>Teach Quran</Text>
          <Text style={[styles.headerSubtitle, { color: subC }]} numberOfLines={1}>{currentStudent?.name || ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: rowBg, borderColor: cardBorder }]}>
          {/* 1 — RESUME: local last page VIEWED (falls back to lastRead, else page 1). */}
          <TouchableOpacity style={[styles.row, styles.rowBorder, { borderBottomColor: border }]}
            onPress={() => resumeInfo && openVerse(resumeInfo.surah, resumeInfo.verse)} activeOpacity={0.7}>
            <Text style={[styles.rowLabel, { color: titleC }]}>RESUME</Text>
            <Text style={[styles.rowSub, { color: subC }]} numberOfLines={1}>{resumeSubtitle}</Text>
          </TouchableOpacity>

          {/* 2 — BOOKMARKS & NOTES: one row split in two halves (vertical divider) */}
          <View style={[styles.row, styles.rowBorder, { borderBottomColor: border, paddingLeft: 0, paddingRight: 0 }]}>
            <TouchableOpacity style={styles.half} onPress={() => navigation.navigate('Bookmarks')} activeOpacity={0.7}>
              <Text style={[styles.halfLabel, { color: titleC }]}>BOOKMARKS</Text>
              <Text style={styles.halfCount}>{bookmarkCount}</Text>
            </TouchableOpacity>
            <View style={[styles.vDivider, { backgroundColor: border }]} />
            <TouchableOpacity style={styles.half} onPress={() => navigation.navigate('Notes')} activeOpacity={0.7}>
              <Text style={[styles.halfLabel, { color: titleC }]}>NOTES</Text>
              <Text style={styles.halfCount}>{noteCount}</Text>
            </TouchableOpacity>
          </View>

          {/* 3 — DAILY RECITATION (the lastRead reading mark; enabled only when it exists) */}
          <TouchableOpacity style={[styles.row, styles.rowBorder, { borderBottomColor: border }, !dailyTarget && styles.rowDisabled]}
            onPress={() => dailyTarget && openVerse(dailyTarget.surah, dailyTarget.verse)} disabled={!dailyTarget} activeOpacity={0.7}>
            <Text style={[styles.rowLabel, { color: titleC }]}>DAILY RECITATION</Text>
            <Text style={[styles.rowSub, { color: subC }]} numberOfLines={1}>{dailySubtitle}</Text>
          </TouchableOpacity>

          {/* 4 — JUZ/PARA INDEX */}
          <TouchableOpacity style={[styles.row, styles.rowBorder, { borderBottomColor: border }]} onPress={() => navigation.navigate('JuzIndex')} activeOpacity={0.7}>
            <Text style={[styles.rowLabel, { color: titleC }]}>JUZ/PARA INDEX</Text>
          </TouchableOpacity>

          {/* 5 — SURAH INDEX */}
          <TouchableOpacity style={[styles.row, styles.rowBorder, { borderBottomColor: border }]} onPress={() => navigation.navigate('SurahIndex')} activeOpacity={0.7}>
            <Text style={[styles.rowLabel, { color: titleC }]}>SURAH INDEX</Text>
          </TouchableOpacity>

          {/* 6 — GO TO PAGE # (valid integer 1..610 -> QuranView { page }) */}
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={[styles.rowLabel, { color: titleC }]}>GO TO PAGE #</Text>
            <View style={styles.pageRowRight}>
              <TextInput style={[styles.pageInput, { color: titleC, borderColor: border, backgroundColor: inputBg }]}
                value={pageInput} onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad" placeholder="1–610" placeholderTextColor={subC}
                maxLength={3} returnKeyType="go" onSubmitEditing={handlePageSubmit} />
              <TouchableOpacity style={[styles.pageGo, { opacity: pageValid ? 1 : 0.35 }]} onPress={handlePageSubmit} disabled={!pageValid} activeOpacity={0.7}>
                <ArrowRight c="#121212" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
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
  halfCount: { fontSize: 24, fontWeight: '700', marginTop: 2, color: '#00d4aa' },
  vDivider: { width: 1, alignSelf: 'stretch' },
  pageRowRight: { flexDirection: 'row', alignItems: 'center' },
  pageInput: { width: 92, height: 36, borderRadius: 18, borderWidth: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', paddingHorizontal: 8 },
  pageGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#00d4aa', marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
});