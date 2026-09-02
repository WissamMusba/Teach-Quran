/**
 * FILE: src/screens/StudentHubScreen.tsx
 * ROLE: Per-student hub screen with full theme integration, clean title case, vector SVG icons, and smooth navigation.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Keyboard, Image } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { setCurrentStudent } from '../store/studentSlice';
import TutorialAnchor from '../tutorial/TutorialAnchor';
import { emitTutorialEvent, setTutorialContext } from '../tutorial/tutorialRuntime';
import { getVersePage } from '../database/quranData';
import { getManifest, getStudentData, getStudentFace, getLastPageSeenLocal, getVersePagesDB } from '../database/localDB';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import Svg, { Path } from 'react-native-svg';
import { getThemeColors } from '../utils/theme';

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const ArrowRight = ({ c = '#FFFFFF' }: { c?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

const IconBookOpen = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Svg>
);

const IconBookmark = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

const IconNotes = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
    <Path d="M16 13H8" />
    <Path d="M16 17H8" />
    <Path d="M10 9H8" />
  </Svg>
);

const IconSparkle = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </Svg>
);

const IconLayers = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M12 2L2 7l10 5 10-5-10-5z" />
    <Path d="M2 17l10 5 10-5" />
    <Path d="M2 12l10 5 10-5" />
  </Svg>
);

const IconList = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
);

const IconHash = ({ c, size = 20 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
  </Svg>
);

const JUZ_PAGE_STARTS = [
  1, 22, 42, 62, 82, 102, 122, 142, 162, 182,
  202, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

function pageToJuz(p: number): number {
  for (let i = JUZ_PAGE_STARTS.length - 1; i >= 0; i--) {
    if (p >= JUZ_PAGE_STARTS[i]) return i + 1;
  }
  return 1;
}

const SURAH_JUZ_APPROX: Record<number, number> = {
  1: 1, 2: 1, 3: 3, 4: 4, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11,
  11: 11, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 15, 19: 16, 20: 16,
  21: 17, 22: 17, 23: 18, 24: 18, 25: 18, 26: 19, 27: 19, 28: 20, 29: 20, 30: 21,
  31: 21, 32: 21, 33: 21, 34: 22, 35: 22, 36: 22, 37: 23, 38: 23, 39: 23, 40: 24,
  41: 24, 42: 25, 43: 25, 44: 25, 45: 25, 46: 26, 47: 26, 48: 26, 49: 26, 50: 26,
  51: 26, 52: 27, 53: 27, 54: 27, 55: 27, 56: 27, 57: 27, 58: 28, 59: 28, 60: 28,
  61: 28, 62: 28, 63: 28, 64: 28, 65: 28, 66: 28, 67: 29, 68: 29, 69: 29, 70: 29,
  71: 29, 72: 29, 73: 29, 74: 29, 75: 29, 76: 29, 77: 29, 78: 30,
};

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const p = Date.parse(ts);
    return isNaN(p) ? 0 : p;
  }
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function formatTimeAgo(ts: any): string {
  const ms = toMillis(ts);
  if (!ms) return '';
  const diffMs = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function getJuzForVerse(surah: number, verse: number): number {
  if (surah === 2) {
    if (verse < 142) return 1;
    if (verse < 253) return 2;
    return 3;
  }
  if (surah === 3) {
    if (verse < 93) return 3;
    return 4;
  }
  if (surah === 4) {
    if (verse < 24) return 4;
    if (verse < 148) return 5;
    return 6;
  }
  if (surah === 5) {
    if (verse < 82) return 6;
    return 7;
  }
  return SURAH_JUZ_APPROX[surah] || 30;
}

export default function StudentHubScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const rawCurrentStudent = useSelector((s: any) => s.student?.currentStudent);
  const studentList = useSelector((s: any) => s.student?.list || []);
  const currentStudent = useMemo(() => {
    if (rawCurrentStudent?.id) return rawCurrentStudent;
    const nonMyQuran = studentList.filter((st: any) => !st?.isMyQuran && st?.name !== 'My Quran');
    return nonMyQuran[0] || studentList[0] || null;
  }, [rawCurrentStudent, studentList]);

  useEffect(() => {
    if (!rawCurrentStudent?.id && currentStudent?.id) {
      dispatch(setCurrentStudent(currentStudent));
    }
  }, [rawCurrentStudent, currentStudent, dispatch]);

  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const surahNames = useSelector((s: any) => s.quran?.surahNames);

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const textStyle = useSelector((s: any) => s.quran?.textStyle);
  const [studentData, setStudentData] = useState<any>(null);
  const [facePath, setFacePath] = useState<string | null>(null);
  const [resumeInfo, setResumeInfo] = useState<{ page: number; juz: number; surah: number; verse: number } | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string>('');
  const [dailyPage, setDailyPage] = useState<number>(0);
  const [dailyPageFor, setDailyPageFor] = useState<string>('');
  const [pageInput, setPageInput] = useState('');

  const loadData = useCallback(async () => {
    if (!currentStudent?.id) return;
    try {
      const [blob, m, fp, seen] = await Promise.all([
        getStudentData(currentStudent.id).catch(() => null),
        getManifest(currentStudent.id).catch(() => null),
        getStudentFace(currentStudent.id).catch(() => null),
        getLastPageSeenLocal(currentStudent.id).catch(() => null),
      ]);
      const mergedData = {
        ...(blob || {}),
        bookmarks: blob?.bookmarks || m?.data?.bookmarks || {},
        notes: blob?.notes || {},
        lastRead: blob?.lastRead || m?.data?.lastRead || null,
      };
      setStudentData(mergedData);
      setFacePath(fp);

      const lr = mergedData.lastRead;
      const lrSurah = lr ? Number(lr.surah) : 0;
      const lrVerse = lr ? Number(lr.verse) : 0;

      let target: { surah: number; verse: number } | null = null;
      if (seen?.at) setLastSeenAt(String(seen.at));
      else if (lr?.updatedAt) setLastSeenAt(String(lr.updatedAt));
      else setLastSeenAt('');

      if (seen && Number(seen.surah) > 0 && Number(seen.verse) > 0) {
        target = { surah: Number(seen.surah), verse: Number(seen.verse) };
      } else if (lrSurah > 0 && lrVerse > 0) {
        target = { surah: lrSurah, verse: lrVerse };
      }

      if (target) {
        try {
          const pg = await getVersePage(target.surah, target.verse, textStyle);
          setResumeInfo({ page: pg, juz: getJuzForVerse(target.surah, target.verse), surah: target.surah, verse: target.verse });
        } catch {
          setResumeInfo({ page: 1, juz: getJuzForVerse(target.surah, target.verse), surah: target.surah, verse: target.verse });
        }
      } else {
        setResumeInfo({ page: 1, juz: 1, surah: 1, verse: 1 });
      }

      if (lrSurah > 0 && lrVerse > 0) {
        getVersePage(lrSurah, lrVerse, textStyle).then((pg) => {
          setDailyPage(pg);
          setDailyPageFor(`${lrSurah}:${lrVerse}`);
        }).catch(() => {});
      } else {
        setDailyPage(0);
        setDailyPageFor('');
      }
    } catch {}
  }, [currentStudent?.id, textStyle]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const lrSurah = studentData?.lastRead?.surah || 0;
  const lrVerse = studentData?.lastRead?.verse || 0;

  useEffect(() => {
    if (resumeInfo) setTutorialContext('resumePage', String(resumeInfo.page + 1));
  }, [resumeInfo]);

  const resumeSubtitle = useMemo(() => {
    if (!resumeInfo) return 'Page 1 · Juz 1';
    const sName = surahNames?.[resumeInfo.surah] || `Surah ${resumeInfo.surah}`;
    const ago = formatTimeAgo(lastSeenAt || studentData?.lastRead?.updatedAt);
    const agoPart = ago ? ` · ${ago}` : '';
    return `Reading Page ${resumeInfo.page + 1} · Juz ${resumeInfo.juz} · ${sName}${agoPart}`;
  }, [resumeInfo, surahNames, lastSeenAt, studentData?.lastRead?.updatedAt]);

  const bookmarkCount = Object.keys(studentData?.bookmarks || {}).length;
  const noteCount = Object.values(studentData?.notes || {}).filter(Boolean).length;

  const dailyTarget = useMemo(() => (lrSurah > 0 && lrVerse > 0 ? { surah: lrSurah, verse: lrVerse } : null), [lrSurah, lrVerse]);
  const dailySubtitle = useMemo(() => {
    if (!dailyTarget) return 'No mark set yet — bookmark a verse while reading';
    const sName = surahNames?.[dailyTarget.surah] || `Surah ${dailyTarget.surah}`;
    const j = getJuzForVerse(dailyTarget.surah, dailyTarget.verse);
    const pgPart = dailyPage > 0 ? ` · Page ${dailyPage}` : '';
    const timeAgoStr = formatTimeAgo(studentData?.lastRead?.updatedAt);
    const timePart = timeAgoStr ? ` (${timeAgoStr})` : '';
    return `${sName} · Ayat ${dailyTarget.verse} · Juz ${j}${pgPart}${timePart}`;
  }, [dailyTarget, surahNames, dailyPage, studentData?.lastRead?.updatedAt]);

  const pageNum = pageInput !== '' ? parseInt(pageInput, 10) : 0;
  const pageValid = pageInput !== '' && pageNum >= 1 && pageNum <= 610;

  const handlePageSubmit = () => {
    if (!pageValid) return;
    navigation.navigate('QuranView' as any, { page: Math.max(1, pageNum - 1) } as any);
    setPageInput('');
    Keyboard.dismiss();
  };

  const openVerse = (surah: number, verse: number) => navigation.navigate('QuranView' as any, { surahId: surah, scrollToVerse: verse } as any);

  const bg = themeColors.bg;
  const rowBg = themeColors.cardBg;
  const border = themeColors.border;
  const titleC = themeColors.text;
  const subC = themeColors.subText;
  const cardBorder = themeColors.border;
  const inputBg = nightMode ? '#121520' : '#F0EBE0';
  const chevronC = themeColors.accent;

  return (
    <View style={[styles(nightMode, themeColors).container, { backgroundColor: bg }]}>
      {/* Top Header showing the Student's Name directly */}
      <View style={[styles(nightMode, themeColors).header, { backgroundColor: rowBg, borderBottomColor: border, paddingTop: Math.max(10, insets.top + 8) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles(nightMode, themeColors).backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c={chevronC} />
        </TouchableOpacity>
        {facePath ? <Image source={{ uri: `file://${facePath}` }} style={styles(nightMode, themeColors).faceAvatar} resizeMode="cover" /> : null}
        <View style={styles(nightMode, themeColors).headerTextWrap}>
          <Text style={[styles(nightMode, themeColors).headerTitle, { color: titleC }]} numberOfLines={1}>{currentStudent?.name || 'Student Hub'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles(nightMode, themeColors).scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles(nightMode, themeColors).card, { backgroundColor: rowBg, borderColor: cardBorder }]}>
          {/* 1 — Resume Reading */}
          <TutorialAnchor id="hub-resume">
            <TouchableOpacity
              style={[styles(nightMode, themeColors).row, styles(nightMode, themeColors).rowBorder, { borderBottomColor: border }]}
              onPress={() => { emitTutorialEvent('quran_opened'); resumeInfo && navigation.navigate('QuranView' as any, { page: resumeInfo.page } as any); }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconBookOpen c={themeColors.accent} size={20} />
                <Text style={[styles(nightMode, themeColors).rowLabel, { color: titleC }]}>Resume Reading</Text>
              </View>
              <Text style={[styles(nightMode, themeColors).rowSub, { color: subC }]} numberOfLines={1}>{resumeSubtitle}</Text>
            </TouchableOpacity>
          </TutorialAnchor>

          {/* 2 — Bookmarks & Notes (Side-by-Side Row: Bookmarks | Notes) */}
          <View style={[styles(nightMode, themeColors).splitRow, styles(nightMode, themeColors).rowBorder, { borderBottomColor: border }]}>
            <TouchableOpacity style={styles(nightMode, themeColors).half} onPress={() => navigation.navigate('Bookmarks')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                <IconBookmark c={themeColors.accent} size={17} />
                <Text style={[styles(nightMode, themeColors).halfLabel, { color: titleC, marginLeft: 6 }]}>Bookmarks</Text>
              </View>
              <Text style={[styles(nightMode, themeColors).halfCount, { color: themeColors.accent }]}>{bookmarkCount}</Text>
            </TouchableOpacity>

            <View style={[styles(nightMode, themeColors).vDivider, { backgroundColor: border }]} />

            <TouchableOpacity style={styles(nightMode, themeColors).half} onPress={() => navigation.navigate('Notes')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                <IconNotes c={themeColors.accent} size={17} />
                <Text style={[styles(nightMode, themeColors).halfLabel, { color: titleC, marginLeft: 6 }]}>Notes</Text>
              </View>
              <Text style={[styles(nightMode, themeColors).halfCount, { color: themeColors.accent }]}>{noteCount}</Text>
            </TouchableOpacity>
          </View>

          {/* 3 — Daily Recitation */}
          <TouchableOpacity
            style={[styles(nightMode, themeColors).row, styles(nightMode, themeColors).rowBorder, { borderBottomColor: border }, !dailyTarget && styles(nightMode, themeColors).rowDisabled]}
            onPress={() => dailyTarget && (dailyPage > 0 && dailyPageFor === `${dailyTarget.surah}:${dailyTarget.verse}`
              ? navigation.navigate('QuranView' as any, { page: dailyPage } as any)
              : openVerse(dailyTarget.surah, dailyTarget.verse))}
            disabled={!dailyTarget}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSparkle c={themeColors.accent} size={19} />
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: titleC }]}>Daily Recitation</Text>
            </View>
            <Text style={[styles(nightMode, themeColors).rowSub, { color: subC }]} numberOfLines={1}>{dailySubtitle}</Text>
          </TouchableOpacity>

          {/* 4 — Juz Index */}
          <TouchableOpacity
            style={[styles(nightMode, themeColors).row, styles(nightMode, themeColors).rowBorder, { borderBottomColor: border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => navigation.navigate('JuzIndex')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconLayers c={themeColors.accent} size={19} />
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: titleC }]}>Juz Index</Text>
            </View>
            <Text style={[styles(nightMode, themeColors).rowChevron, { color: subC }]}>›</Text>
          </TouchableOpacity>

          {/* 5 — Go to Page # */}
          <View style={[styles(nightMode, themeColors).row, styles(nightMode, themeColors).rowBorder, { borderBottomColor: border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconHash c={themeColors.accent} size={19} />
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: titleC }]}>Go to Page</Text>
            </View>
            <View style={styles(nightMode, themeColors).pageInputRow}>
              <TextInput
                style={[styles(nightMode, themeColors).pageInput, { backgroundColor: inputBg, color: titleC, borderColor: border }]}
                keyboardType="number-pad"
                placeholder="1–610"
                placeholderTextColor={subC}
                value={pageInput}
                onChangeText={setPageInput}
                onSubmitEditing={handlePageSubmit}
                maxLength={3}
                returnKeyType="go"
              />
              <TouchableOpacity
                style={[styles(nightMode, themeColors).pageGoBtn, { backgroundColor: themeColors.primary }, !pageValid && styles(nightMode, themeColors).pageGoDisabled]}
                onPress={handlePageSubmit}
                disabled={!pageValid}
                activeOpacity={0.7}
              >
                <ArrowRight c="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 6 — Surah Index */}
          <TouchableOpacity
            style={[styles(nightMode, themeColors).row, { borderBottomWidth: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => navigation.navigate('SurahIndex')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconList c={themeColors.accent} size={19} />
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: titleC }]}>Surah Index</Text>
            </View>
            <Text style={[styles(nightMode, themeColors).rowChevron, { color: subC }]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  faceAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerTextWrap: { flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { padding: 16 },
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  row: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  splitRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowDisabled: { opacity: 0.45 },
  rowLabel: { fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },
  rowSub: { fontSize: 12.5, marginTop: 4, paddingLeft: 30 },
  rowChevron: { fontSize: 20, fontWeight: '300' },
  half: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  halfLabel: { fontSize: 13, fontWeight: '600' },
  halfCount: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  vDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  pageInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 28 },
  pageInput: { width: 90, height: 38, borderRadius: 10, borderWidth: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', paddingHorizontal: 6 },
  pageGoBtn: { width: 38, height: 38, borderRadius: 10, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  pageGoDisabled: { opacity: 0.4 },
});
