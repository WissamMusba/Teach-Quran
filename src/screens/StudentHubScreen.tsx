/**
 * FILE: src/screens/StudentHubScreen.tsx
 * ROLE: Per-student hub screen — shows live counts + the student's reading position
 *       with modern lowkey typography, vector SVG icons, and theme integration.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Keyboard, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { getVersePage } from '../database/quranData';
import { JUZ_MAP, getThemeColors } from '../utils/theme';
import { getLastPageSeenLocal, getStudentFace, getManifest } from '../database/localDB';
import { useStudentDataRefresh } from '../hooks/useStudentDataRefresh';
import { emitTutorialEvent, setTutorialContext } from '../tutorial/tutorialRuntime';
import TutorialAnchor from '../tutorial/TutorialAnchor';

const getJuzForVerse = (surahId: number, verseNum: number): number => {
  let juz = 1;
  for (const entry of JUZ_MAP) {
    if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) juz = entry.j;
  }
  return juz;
};

const ChevronLeft = ({ c }: { c: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>
);

const ArrowRight = ({ c }: { c: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);

const IconBookOpen = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Svg>
);

const IconBookmark = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

const IconNotes = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

const IconSparkle = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </Svg>
);

const IconLayers = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </Svg>
);

const IconList = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
);

const IconHash = ({ c, size = 18 }: { c: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    <Path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
  </Svg>
);

export default function StudentHubScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const currentStudent = useSelector((s: any) => s.student.currentStudent);
  React.useEffect(() => { if (!currentStudent) navigation.replace('Dashboard'); }, [currentStudent, navigation]);
  
  const [facePath, setFacePath] = useState<string | null>(null);
  useEffect(() => {
    const sid = currentStudent?.id;
    if (!sid) { setFacePath(null); return; }
    let active = true;
    getStudentFace(sid).then((p) => { if (active) setFacePath(p); }).catch(() => {});
    return () => { active = false; };
  }, [currentStudent?.id]);

  const studentData = useSelector((s: any) => s.student.studentData);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const [pageInput, setPageInput] = useState('');

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  useStudentDataRefresh();

  const [manifestLastRead, setManifestLastRead] = useState<any>(undefined);
  const lastRead = manifestLastRead === undefined ? studentData?.lastRead : manifestLastRead;
  const lrSurah = lastRead ? Number(lastRead.surah) : 0;
  const lrVerse = lastRead ? Number(lastRead.verse) : 0;

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
      getVersePage(src.surah, src.verse, textStyle).then((pg) => {
        if (!cancelled) setResumeInfo({ page: pg, juz: getJuzForVerse(src.surah, src.verse), surah: src.surah, verse: src.verse });
      }).catch(() => {
        if (!cancelled) setResumeInfo({ page: 1, juz: getJuzForVerse(src.surah, src.verse), surah: src.surah, verse: src.verse });
      });
    };
    if (currentStudent?.id) {
      getLastPageSeenLocal(currentStudent.id).then((seen) => apply(choose(seen))).catch(() => apply(choose(null)));
      getManifest(currentStudent.id).then((res: any) => {
        if (!cancelled && res?.data?.lastRead !== undefined) {
          const fresh = res.data.lastRead;
          setManifestLastRead((prev: any) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
        }
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [currentStudent?.id, lrSurah, lrVerse, textStyle]));

  useEffect(() => {
    if (resumeInfo?.page) setTutorialContext('resumePage', String(resumeInfo.page));
  }, [resumeInfo?.page]);

  const [dailyPage, setDailyPage] = useState(0);
  const [dailyPageFor, setDailyPageFor] = useState('');
  useEffect(() => {
    if (lrSurah > 0 && lrVerse > 0) {
      const key = `${lrSurah}:${lrVerse}`;
      getVersePage(lrSurah, lrVerse, textStyle).then((pg) => {
        setDailyPage(pg);
        setDailyPageFor(key);
      }).catch(() => { setDailyPage(0); setDailyPageFor(''); });
    } else {
      setDailyPage(0);
      setDailyPageFor('');
    }
  }, [lrSurah, lrVerse, textStyle]);

  const bookmarkCount = useMemo(() => Object.keys(studentData?.bookmarks || {}).length, [studentData?.bookmarks]);
  const noteCount = useMemo(() => Object.keys(studentData?.notes || {}).length, [studentData?.notes]);

  const resumeSubtitle = useMemo(() => {
    if (!resumeInfo) return 'Loading…';
    const sName = surahNames?.[resumeInfo.surah] || `Surah ${resumeInfo.surah}`;
    const seenPart = lastSeenAt ? ` · ${lastSeenAt}` : '';
    return `Page ${resumeInfo.page} · Juz ${resumeInfo.juz} · ${sName}${seenPart}`;
  }, [resumeInfo, surahNames, lastSeenAt]);

  const dailyTarget = useMemo(() => (lrSurah > 0 && lrVerse > 0 ? { surah: lrSurah, verse: lrVerse } : null), [lrSurah, lrVerse]);
  const dailySubtitle = useMemo(() => {
    if (!dailyTarget) return 'No mark set yet — bookmark a verse while reading';
    const sName = surahNames?.[dailyTarget.surah] || `Surah ${dailyTarget.surah}`;
    const j = getJuzForVerse(dailyTarget.surah, dailyTarget.verse);
    const pgPart = dailyPage > 0 ? ` · Page ${dailyPage}` : '';
    return `${sName} · Ayat ${dailyTarget.verse} · Juz ${j}${pgPart}`;
  }, [dailyTarget, surahNames, dailyPage]);

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
      {/* Top Header */}
      <View style={[styles(nightMode, themeColors).header, { backgroundColor: rowBg, borderBottomColor: border, paddingTop: Math.max(10, insets.top + 8) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles(nightMode, themeColors).backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft c={chevronC} />
        </TouchableOpacity>
        {facePath ? <Image source={{ uri: `file://${facePath}` }} style={styles(nightMode, themeColors).faceAvatar} resizeMode="cover" /> : null}
        <View style={styles(nightMode, themeColors).headerTextWrap}>
          <Text style={[styles(nightMode, themeColors).headerTitle, { color: titleC }]}>Teach Quran</Text>
          <Text style={[styles(nightMode, themeColors).headerSubtitle, { color: subC }]} numberOfLines={1}>{currentStudent?.name || ''}</Text>
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

          {/* 2 — Bookmarks & Notes (Split Row) */}
          <View style={[styles(nightMode, themeColors).row, styles(nightMode, themeColors).rowBorder, { borderBottomColor: border, paddingVertical: 0, paddingHorizontal: 0 }]}>
            <TouchableOpacity style={styles(nightMode, themeColors).half} onPress={() => navigation.navigate('Bookmarks')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <IconBookmark c={themeColors.accent} size={17} />
                <Text style={[styles(nightMode, themeColors).halfLabel, { color: titleC }]}>Bookmarks</Text>
              </View>
              <Text style={[styles(nightMode, themeColors).halfCount, { color: themeColors.accent }]}>{bookmarkCount}</Text>
            </TouchableOpacity>

            <View style={[styles(nightMode, themeColors).vDivider, { backgroundColor: border }]} />

            <TouchableOpacity style={styles(nightMode, themeColors).half} onPress={() => navigation.navigate('Notes')} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <IconNotes c={themeColors.accent} size={17} />
                <Text style={[styles(nightMode, themeColors).halfLabel, { color: titleC }]}>Notes</Text>
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
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  faceAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  headerTextWrap: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 13, marginTop: 1, fontWeight: '500' },
  scrollContent: { padding: 14 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1 },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  rowSub: { fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  rowChevron: { fontSize: 20, fontWeight: '600', marginLeft: 6 },
  half: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  halfLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  halfCount: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  vDivider: { width: 1, height: '70%', alignSelf: 'center' },
  pageInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pageInput: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontWeight: '600' },
  pageGoBtn: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  pageGoDisabled: { opacity: 0.4 },
});
