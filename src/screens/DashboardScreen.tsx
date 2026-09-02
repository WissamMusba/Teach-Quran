/**
 * FILE: src/screens/DashboardScreen.tsx
 * ROLE: Post-login hub — lists students with individual Quran progress rings, My Quran Hero card,
 *       student activity status dots, streak counter, physical rolling wheel FAB (counter-clockwise on focus),
 *       vector SVG menu icons, and dynamic themes.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Image, Animated, Pressable, Easing } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Circle, Path } from 'react-native-svg';
import { getStudents, createStudent, deleteStudent, updateStudent, ensureMyQuranStudent } from '../api/student';
import { setStudents, addStudent, removeStudent, updateStudent as updateStudentSlice, setCurrentStudent } from '../store/studentSlice';
import { logoutUser } from '../api/auth';
import { logout } from '../store/authSlice';
import { setSurah } from '../store/quranSlice';
import { setToolbarExpanded } from '../store/drawingSlice';
import SyncStatus from '../components/common/SyncStatus';
import AlertModal from '../components/common/AlertModal';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import DashboardFooter from '../components/common/DashboardFooter';
import { getVersePage } from '../database/quranData';
import { JUZ_MAP, getThemeColors } from '../utils/theme';
import { getManifest, purgeLocalStudent, getStudentFace, saveStudentFace, clearStudentFace, getLastPageSeenLocal } from '../database/localDB';
import ImagePicker from 'react-native-image-crop-picker';
import { processSyncQueue } from '../api/sync';
import { setSyncing, setSynced, setOffline } from '../store/syncSlice';
import { formatDate, formatTime, toMillis } from '../utils/format';
import { emitTutorialEvent, startTutorial } from '../tutorial/tutorialRuntime';
import { setTutorialDone } from '../store/settingsSlice';
import TutorialAnchor from '../tutorial/TutorialAnchor';
import SettingsScreen from './SettingsScreen';

const IconMenuSettings = ({ c }: { c: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 12 }}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

const IconMenuCloud = ({ c }: { c: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 12 }}>
    <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </Svg>
);

const IconMenuLogout = ({ c }: { c: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 12 }}>
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <Path d="M16 17l5-5-5-5" />
    <Path d="M21 12H9" />
  </Svg>
);

const IconMenuHelp = ({ c }: { c: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 12 }}>
    <Circle cx="12" cy="12" r="10" />
    <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <Path d="M12 17h.01" />
  </Svg>
);

const ArrowRightSmall = ({ c = '#FFFFFF', size = 13 }: { c?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
    <Path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
);

const IconGallery = ({ c = '#FFFFFF', size = 14 }: { c?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
    <Path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
  </Svg>
);

const IconCamera = ({ c = '#FFFFFF', size = 14 }: { c?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <Circle cx="12" cy="13" r="4" />
  </Svg>
);

const ProgressCircle = ({ pct, color, bgTrack }: { pct: number; color: string; bgTrack: string }) => {
  const r = 16;
  const stroke = 3.2;
  const circ = 2 * Math.PI * r;
  const strokeDashoffset = circ - (pct / 100) * circ;
  return (
    <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}>
      <Svg width={40} height={40} viewBox="0 0 40 40">
        <Circle cx="20" cy="20" r={r} stroke={bgTrack} strokeWidth={stroke} fill="none" />
        <Circle
          cx="20"
          cy="20"
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </Svg>
      <Text style={{ position: 'absolute', fontSize: 9.5, fontWeight: '800', color }}>{pct}%</Text>
    </View>
  );
};

const StudentProgressRing = ({ pct, color, bgTrack }: { pct: number; color: string; bgTrack: string }) => {
  const r = 13;
  const stroke = 2.6;
  const circ = 2 * Math.PI * r;
  const strokeDashoffset = circ - (pct / 100) * circ;
  return (
    <View style={{ width: 34, height: 34, justifyContent: 'center', alignItems: 'center', marginRight: 4 }}>
      <Svg width={34} height={34} viewBox="0 0 34 34">
        <Circle cx="17" cy="17" r={r} stroke={bgTrack} strokeWidth={stroke} fill="none" />
        <Circle
          cx="17"
          cy="17"
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 17 17)"
        />
      </Svg>
      <Text style={{ position: 'absolute', fontSize: 8.5, fontWeight: '800', color }}>{pct}%</Text>
    </View>
  );
};

export default function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const statusBarPad = insets.top;
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', buttons: undefined as any });
  const [manifests, setManifests] = useState<Record<string, any>>({});
  const [studentPages, setStudentPages] = useState<Record<string, number>>({});
  const [faces, setFaces] = useState<Record<string, string | null>>({});
  const dispatch = useDispatch();
  const students = useSelector((s: any) => s.student.list);
  const pendingChanges = useSelector((s: any) => s.sync.pendingChanges);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const colorTheme = useSelector((s: any) => s.settings.colorTheme || 'classic');
  const syncStatus = useSelector((s: any) => s.sync.status);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const adCollapsed = useSelector((s: any) => s.settings?.adCollapsed === true);
  const prevSyncStatus = useRef<string | null>(null);

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  // Rolling Wheel FAB animation — shows + circle for 3 seconds, then rolls out smoothly to pill
  const fabAnim = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      fabAnim.setValue(0);
      const timer = setTimeout(() => {
        Animated.timing(fabAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }, 3000);
      return () => clearTimeout(timer);
    }, [fabAnim])
  );

  const fabWidth = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 102] });
  const fabRotate = fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const fabTextOpacity = fabAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const fabTextTranslate = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  const isMyQuranStudent = (s: any) => s?.isMyQuran === true || s?.name === 'My Quran';
  const myQuranStudent = useMemo(() => {
    const list: any[] = students ? [...students] : [];
    return list.find((s: any) => isMyQuranStudent(s)) || null;
  }, [students]);
  const nonMyQuranStudents = useMemo(() => {
    const list: any[] = students ? [...students] : [];
    return list.filter((s: any) => !isMyQuranStudent(s));
  }, [students]);
  const sortedStudents = useMemo(() => {
    return [...nonMyQuranStudents].sort((a: any, b: any) => toMillis(a?.createdAt) - toMillis(b?.createdAt));
  }, [nonMyQuranStudents]);

  useEffect(() => {
    let active = true;
    const ids = (students || []).map((s: any) => s?.id).filter(Boolean);
    if (ids.length === 0) { setFaces({}); return; }
    ids.forEach((id: string) => {
      getStudentFace(id).then((path) => { if (active) setFaces((prev) => ({ ...prev, [id]: path })); }).catch(() => {});
    });
    return () => { active = false; };
  }, [students]);

  useEffect(() => {
    let active = true;
    const ids = (students || []).map((s: any) => s?.id).filter(Boolean);
    if (ids.length === 0) { setManifests({}); setStudentPages({}); return; }
    ids.forEach((id: string) => {
      getManifest(id)
        .then(async (res: any) => {
          if (active && res?.data) {
            setManifests((prev) => ({ ...prev, [id]: res.data }));
            const lr = res.data.lastRead;
            if (lr?.surah && lr?.verse) {
              const pg = await getVersePage(Number(lr.surah), Number(lr.verse), textStyle).catch(() => 1);
              if (active) setStudentPages((prev) => ({ ...prev, [id]: pg }));
            }
          }
        })
        .catch(() => {});
    });
    return () => { active = false; };
  }, [students, textStyle]);

  const [myQuranResumeInfo, setMyQuranResumeInfo] = useState<{ page: number; juz: number; surah: number; verse: number } | null>(null);
  const [myQuranLastSeenAt, setMyQuranLastSeenAt] = useState<string>('');
  const myQuranLastRead = useMemo(() => {
    if (!myQuranStudent?.id) return null;
    return manifests[myQuranStudent.id]?.lastRead || null;
  }, [myQuranStudent?.id, manifests]);

  const getJuzForVerseLocal = useCallback((surahId: number, verseNum: number): number => {
    let j = 1;
    for (const entry of JUZ_MAP) {
      if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) j = entry.j as number;
    }
    return j;
  }, []);

  const myQuranTimeAgo = useCallback((ts: any): string => {
    const ms = toMillis(ts);
    if (!ms) return '';
    const mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }, []);

  const getActivityColor = useCallback((ts: any): string => {
    const ms = toMillis(ts);
    if (!ms) return '#8E95A8';
    const hrs = Math.floor((Date.now() - ms) / (1000 * 60 * 60));
    if (hrs < 24) return '#4CAF50';
    if (hrs < 96) return '#FFB300';
    return '#8E95A8';
  }, []);

  useFocusEffect(useCallback(() => {
    const sid = myQuranStudent?.id;
    if (!sid) { setMyQuranResumeInfo(null); setMyQuranLastSeenAt(''); return; }
    let cancelled = false;
    const lrSurah = myQuranLastRead ? Number(myQuranLastRead.surah) : 0;
    const lrVerse = myQuranLastRead ? Number(myQuranLastRead.verse) : 0;
    const choose = (seen: any) => {
      if (!cancelled && seen?.at) setMyQuranLastSeenAt(String(seen.at));
      else if (!cancelled && !seen?.at && myQuranLastRead?.updatedAt) setMyQuranLastSeenAt(String(myQuranLastRead.updatedAt));
      if (seen && Number(seen.surah) > 0 && Number(seen.verse) > 0) return { surah: Number(seen.surah), verse: Number(seen.verse) };
      if (lrSurah > 0 && lrVerse > 0) return { surah: lrSurah, verse: lrVerse };
      return null;
    };
    const apply = (src: any) => {
      if (cancelled) return;
      if (!src) { setMyQuranResumeInfo({ page: 1, juz: 1, surah: 1, verse: 1 }); return; }
      getVersePage(src.surah, src.verse, textStyle).then(pg => {
        if (!cancelled) setMyQuranResumeInfo({ page: pg, juz: getJuzForVerseLocal(src.surah, src.verse), surah: src.surah, verse: src.verse });
      }).catch(() => { if (!cancelled) setMyQuranResumeInfo({ page: 1, juz: getJuzForVerseLocal(src.surah, src.verse), surah: src.surah, verse: src.verse }); });
    };
    getLastPageSeenLocal(sid).then(seen => apply(choose(seen))).catch(() => apply(choose(null)));
    return () => { cancelled = true; };
  }, [myQuranStudent?.id, myQuranLastRead, textStyle, getJuzForVerseLocal]));

  useEffect(() => {
    const ids = (students || []).map((s: any) => s?.id).filter(Boolean);
    if (ids.length) startStartupPrefetch(ids);
  }, [students]);

  useFocusEffect(useCallback(() => {
    getStudents().then(async (res: any) => {
      if (res?.success && Array.isArray(res.students)) {
        const list: any[] = res.students;
        const hasMyQuran = list.some((s: any) => s?.isMyQuran === true || s?.name === 'My Quran');
        if (!hasMyQuran) {
          try { await ensureMyQuranStudent(); } catch {}
          try {
            const again = await getStudents();
            if (again?.success && Array.isArray(again.students)) dispatch(setStudents(again.students));
            else dispatch(setStudents(list));
          } catch { dispatch(setStudents(list)); }
          return;
        }
        dispatch(setStudents(list));
      }
    });
  }, [dispatch]));

  useEffect(() => {
    const prev = prevSyncStatus.current;
    prevSyncStatus.current = syncStatus;
    if (prev === 'syncing' && syncStatus !== 'syncing') {
      getStudents().then(async (res: any) => {
        if (res?.success && Array.isArray(res.students)) {
          const list: any[] = res.students;
          const hasMyQuran = list.some((s: any) => s?.isMyQuran === true || s?.name === 'My Quran');
          if (!hasMyQuran) {
            try { await ensureMyQuranStudent(); } catch {}
            const again = await getStudents();
            if (again?.success) { dispatch(setStudents(again.students)); return; }
          }
          dispatch(setStudents(list));
        }
      });
    }
  }, [syncStatus, dispatch]);

  const showAlert = useCallback((title: string, message: string, buttons?: any) => {
    setAlertModal({ visible: true, title, message, buttons });
  }, []);

  const handleCreate = useCallback(async () => {
    if (isCreating || !name.trim()) return;
    setIsCreating(true);
    try {
      const res = await createStudent(name.trim());
      if (res.success) {
        dispatch(addStudent({ id: res.studentId, name: name.trim() }));
        setAddModal(false);
        setName('');
        emitTutorialEvent('student_created', res.studentId);
      } else {
        showAlert('Error', res.error);
      }
    } finally {
      setIsCreating(false);
    }
  }, [name, isCreating, showAlert, dispatch]);

  const handleManualSync = useCallback(async () => {
    dispatch(setSyncing()); setIsSyncing(true);
    try {
      const result = await processSyncQueue({ pull: true });
      if (result.success) {
        dispatch(setSynced());
        showAlert('Sync Complete', `Pushed: ${result.pushed ?? 0}` + (typeof result.pulled === 'number' ? ` | Pulled: ${result.pulled}` : ''), [{ text: 'OK' }]);
      } else {
        dispatch(setOffline());
        showAlert('Sync Failed', result.error || 'Unknown error', [{ text: 'OK' }]);
      }
    } catch (e: any) {
      dispatch(setOffline());
      showAlert('Sync Failed', e?.message || 'Unknown error', [{ text: 'OK' }]);
    } finally {
      setIsSyncing(false);
    }
  }, [dispatch, showAlert]);

  const handleLongPress = useCallback((item: any) => {
    if (isMyQuranStudent(item)) {
      showAlert('My Quran', 'My Quran cannot be deleted or renamed.', [{ text: 'OK' }]);
      return;
    }
    showAlert(item.name, 'Choose an action:', [
      { text: 'Edit Name', onPress: () => { setEditId(item.id); setEditName(item.name); setEditModal(true); } },
      { text: 'Delete', style: 'destructive' as const, onPress: async () => {
        await deleteStudent(item.id); await purgeLocalStudent(item.id); dispatch(removeStudent(item.id));
      }},
    ]);
  }, [showAlert, dispatch]);

  const handleEdit = useCallback(async () => {
    if (!editName.trim()) return;
    const cur = (students || []).find((s: any) => s?.id === editId);
    if (cur && isMyQuranStudent(cur)) { showAlert('My Quran', 'My Quran cannot be renamed.', [{ text: 'OK' }]); return; }
    const res = await updateStudent(editId, editName.trim());
    if (res.success) { dispatch(updateStudentSlice({ id: editId, name: editName.trim() })); setEditModal(false); }
    else showAlert('Error', res.error);
  }, [editId, editName, students, showAlert, dispatch]);

  const pickPhoto = useCallback(async (fromCamera: boolean) => {
    if (!editId) return;
    try {
      const img: any = fromCamera
        ? await ImagePicker.openCamera({ width: 400, height: 400, cropping: true, cropperCircleOverlay: true, compressImageQuality: 0.8, includeBase64: false })
        : await ImagePicker.openPicker({ width: 400, height: 400, cropping: true, cropperCircleOverlay: true, compressImageQuality: 0.8, mediaType: 'photo' });
      if (!img?.path) return;
      const asset = { uri: img.path };
      const RNFS = require('react-native-fs').default || require('react-native-fs');
      const dir = `${RNFS.DocumentDirectoryPath}/student_faces`;
      if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);
      const dest = `${dir}/${editId}.jpg`;
      if (await RNFS.exists(dest)) await RNFS.unlink(dest);
      await RNFS.copyFile(asset.uri.replace('file://', ''), dest);
      await saveStudentFace(editId, dest);
      setFaces((prev) => ({ ...prev, [editId]: dest }));
    } catch (e: any) {
      if (e?.code === 'E_PICKER_CANCELLED') return;
      showAlert('Photo', e?.message || 'Could not save photo', [{ text: 'OK' }]);
    }
  }, [editId, showAlert]);

  const removePhoto = useCallback(async () => {
    if (!editId) return;
    try {
      const RNFS = require('react-native-fs').default || require('react-native-fs');
      const dest = `${RNFS.DocumentDirectoryPath}/student_faces/${editId}.jpg`;
      if (await RNFS.exists(dest)) await RNFS.unlink(dest);
      await clearStudentFace(editId);
      setFaces((prev) => ({ ...prev, [editId]: null }));
    } catch {}
  }, [editId]);

  const renderItem = useCallback(({ item, index }: any) => {
    const manifest = manifests[item.id];
    const lr = manifest?.lastRead;
    const studentPage = studentPages[item.id] || (lr?.surah ? 1 : 0);
    // Real Quran display page: Surah Fatiha starts on Page 2 (+1 offset)
    const displayPage = studentPage > 0 ? studentPage + 1 : 0;
    const studentPct = studentPage > 0 ? Math.min(100, Math.max(1, Math.round((studentPage / 610) * 100))) : 0;

    let readingLine: string;
    let dateLine: string | null = null;
    let activityColor = '#8E95A8';

    if (manifest && lr?.surah) {
      const ls = Number(lr.surah);
      const nm = surahNames?.[ls] || `Surah ${ls}`;
      readingLine = displayPage > 0 ? `${nm} · Page ${displayPage}` : `${nm}`;
      dateLine = lr.updatedAt ? `${formatDate(lr.updatedAt)} · ${formatTime(lr.updatedAt)}` : '';
      activityColor = getActivityColor(lr.updatedAt);
    } else {
      readingLine = manifest ? 'Not read yet' : '…';
    }
    const initial = (item.name || '?').charAt(0).toUpperCase();

    return (
      <TutorialAnchor id={index === 0 ? 'student-card' : `student-card-${item.id}`}>
      <TouchableOpacity
        style={[
          styles(nightMode, themeColors).card,
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.border,
          }
        ]}
        onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); dispatch(setToolbarExpanded(false)); emitTutorialEvent('student_opened'); navigation.navigate('StudentHub'); }}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.75}
        delayLongPress={400}
      >
        <View style={styles(nightMode, themeColors).cardRow}>
          {/* Avatar with Activity Dot */}
          <View style={{ position: 'relative' }}>
            {faces[item.id] ? (
              <Image source={{ uri: `file://${faces[item.id]}` }} style={styles(nightMode, themeColors).avatarImage} resizeMode="cover" />
            ) : (
              <View style={[styles(nightMode, themeColors).avatar, { backgroundColor: nightMode ? '#28334E' : '#E6DEC8', borderColor: nightMode ? '#3C4D75' : '#D0C4A4', borderWidth: 1 }]}>
                <Text style={[styles(nightMode, themeColors).avatarText, { color: themeColors.accent }]}>{initial}</Text>
              </View>
            )}
            <View style={[styles(nightMode, themeColors).activityDot, { backgroundColor: activityColor }]} />
          </View>

          <View style={styles(nightMode, themeColors).cardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles(nightMode, themeColors).studentName, { color: themeColors.text }]} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Text style={[styles(nightMode, themeColors).readingLine, { color: themeColors.accent }]} numberOfLines={1}>{readingLine}</Text>
            </View>
            {dateLine ? <Text style={[styles(nightMode, themeColors).dateLine, { color: themeColors.subText }]} numberOfLines={1}>{dateLine}</Text> : null}
          </View>

          {/* Student Progress Ring */}
          {studentPct > 0 ? (
            <StudentProgressRing pct={studentPct} color={themeColors.accent} bgTrack={nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
          ) : null}

          <Text style={[styles(nightMode, themeColors).chevron, { color: themeColors.subText }]}>›</Text>
        </View>
      </TouchableOpacity>
      </TutorialAnchor>
    );
  }, [navigation, nightMode, manifests, studentPages, surahNames, faces, handleLongPress, dispatch, themeColors, getActivityColor]);

  const handleMyQuranPress = useCallback(() => {
    if (!myQuranStudent?.id) return;
    dispatch(setCurrentStudent(myQuranStudent));
    dispatch(setSurah({ surahId: 1, verses: [] }));
    dispatch(setToolbarExpanded(false));
    const page = myQuranResumeInfo?.page ?? 1;
    emitTutorialEvent('quran_opened');
    navigation.navigate('QuranView' as any, { page } as any);
  }, [myQuranStudent, myQuranResumeInfo, dispatch, navigation]);

  const currentSurahTitle = useMemo(() => {
    if (!myQuranResumeInfo?.surah) return 'Surah Al-Fatihah';
    return surahNames?.[myQuranResumeInfo.surah] || `Surah ${myQuranResumeInfo.surah}`;
  }, [myQuranResumeInfo, surahNames]);

  const progressPct = useMemo(() => {
    const pg = myQuranResumeInfo?.page ?? 1;
    return Math.min(100, Math.max(1, Math.round((pg / 610) * 100)));
  }, [myQuranResumeInfo?.page]);

  return (
    <View style={[styles(nightMode, themeColors).container, { backgroundColor: themeColors.bg, paddingBottom: insets.bottom }]}>
      {/* Top Header */}
      <View style={[styles(nightMode, themeColors).header, { backgroundColor: themeColors.cardBg, borderBottomColor: themeColors.border, paddingTop: 14 + statusBarPad }]}>
        <View style={styles(nightMode, themeColors).titleRow}>
          <View style={[styles(nightMode, themeColors).titleDot, { backgroundColor: themeColors.accent }]} />
          <Text style={[styles(nightMode, themeColors).title, { color: themeColors.text }]}>Students</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TutorialAnchor id="sync-pill"><SyncStatus /></TutorialAnchor>

          {/* 3-Line / 3-Dot Menu Button */}
          <TouchableOpacity
            style={[styles(nightMode, themeColors).menuBtn, { backgroundColor: nightMode ? '#222738' : '#E8E3D5' }]}
            onPress={() => setMenuModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles(nightMode, themeColors).menuLine, { backgroundColor: themeColors.accent }]} />
            <View style={[styles(nightMode, themeColors).menuLine, { backgroundColor: themeColors.accent, width: 15 }]} />
            <View style={[styles(nightMode, themeColors).menuLine, { backgroundColor: themeColors.accent }]} />
            {pendingChanges > 0 && <View style={styles(nightMode, themeColors).menuPendingDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Student Cards List */}
      <FlatList
        style={{ flex: 1 }}
        data={sortedStudents}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 }}
        renderItem={renderItem}
      />

      {/* Featured "My Quran" Hero Card — Pinned at the bottom */}
      <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 }}>
        {myQuranStudent ? (
          <TutorialAnchor id="my-quran-resume">
            <TouchableOpacity
              style={[
                styles(nightMode, themeColors).card,
                styles(nightMode, themeColors).heroCard,
                {
                  backgroundColor: themeColors.heroBg,
                  borderColor: themeColors.heroBorder,
                  marginBottom: 0,
                }
              ]}
              onPress={handleMyQuranPress}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles(nightMode, themeColors).heroBadge, { backgroundColor: themeColors.primary }]}>
                    <Text style={styles(nightMode, themeColors).heroBadgeText}>MY QURAN</Text>
                  </View>
                  {myQuranLastSeenAt ? (
                    <Text style={[styles(nightMode, themeColors).heroTimeAgo, { color: themeColors.subText }]}>
                      {myQuranTimeAgo(myQuranLastSeenAt)}
                    </Text>
                  ) : null}
                </View>

                {/* Progress Ring & Continue Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ProgressCircle pct={progressPct} color={themeColors.accent} bgTrack={nightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} />
                  <View style={[styles(nightMode, themeColors).continueBtn, { backgroundColor: themeColors.primary, marginLeft: 10, flexDirection: 'row', alignItems: 'center' }]}>
                    <Text style={[styles(nightMode, themeColors).continueBtnText, { color: '#FFFFFF' }]}>Continue</Text>
                    <ArrowRightSmall c="#FFFFFF" size={13} />
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={[styles(nightMode, themeColors).heroTitle, { color: themeColors.text }]}>
                  {currentSurahTitle}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                  <View style={[styles(nightMode, themeColors).heroPill, { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={[styles(nightMode, themeColors).heroPillText, { color: themeColors.accent }]}>
                      Page {myQuranResumeInfo ? myQuranResumeInfo.page : 1}
                    </Text>
                  </View>
                  <View style={[styles(nightMode, themeColors).heroPill, { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', marginLeft: 6 }]}>
                    <Text style={[styles(nightMode, themeColors).heroPillText, { color: themeColors.accent }]}>
                      Juz {myQuranResumeInfo ? myQuranResumeInfo.juz : 1}
                    </Text>
                  </View>
                  {myQuranResumeInfo?.verse ? (
                    <View style={[styles(nightMode, themeColors).heroPill, { backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', marginLeft: 6 }]}>
                      <Text style={[styles(nightMode, themeColors).heroPillText, { color: themeColors.accent }]}>
                        Ayat {myQuranResumeInfo.verse}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          </TutorialAnchor>
        ) : (
          <View style={[styles(nightMode, themeColors).card, { backgroundColor: themeColors.heroBg, borderColor: themeColors.heroBorder, opacity: 0.7, marginBottom: 0 }]}>
            <Text style={[styles(nightMode, themeColors).readingLine, { textAlign: 'center', paddingVertical: 12, color: themeColors.accent }]}>Setting up My Quran…</Text>
          </View>
        )}
      </View>

      {/* Silky Smooth Rolling Wheel Animated FAB */}
      <TutorialAnchor id="dashboard-fab" style={{ position: 'absolute', right: 14, bottom: (myQuranStudent ? 120 : 64) + (adCollapsed ? 60 : 100) + Math.max(0, insets.bottom) }}>
        <Animated.View style={[styles(nightMode, themeColors).fabContainer, { width: fabWidth }]}>
          <TouchableOpacity
            style={[styles(nightMode, themeColors).fabTouchable, { backgroundColor: themeColors.primary }]}
            onPress={() => setAddModal(true)}
            activeOpacity={0.85}
          >
            <Animated.Text
              style={[
                styles(nightMode, themeColors).fabPlus,
                {
                  color: '#FFFFFF',
                  transform: [
                    { rotate: fabRotate },
                  ],
                }
              ]}
            >
              +
            </Animated.Text>
            <Animated.View
              style={[
                styles(nightMode, themeColors).fabTextWrap,
                {
                  opacity: fabTextOpacity,
                  transform: [{ translateX: fabTextTranslate }],
                }
              ]}
            >
              <Text style={styles(nightMode, themeColors).fabTextLine}>New</Text>
              <Text style={styles(nightMode, themeColors).fabTextLine}>Student</Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </TutorialAnchor>

      {/* 3-Line Menu Modal with Vector SVG Icons */}
      <Modal visible={menuModalVisible} transparent animationType="fade" onRequestClose={() => setMenuModalVisible(false)}>
        <Pressable style={styles(nightMode, themeColors).menuBackdrop} onPress={() => setMenuModalVisible(false)}>
          <View style={[styles(nightMode, themeColors).menuDropdown, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, top: statusBarPad + 58 }]}>
            <TouchableOpacity
              style={styles(nightMode, themeColors).menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                setSettingsModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <IconMenuSettings c={themeColors.accent} />
              <Text style={[styles(nightMode, themeColors).menuItemText, { color: themeColors.text }]}>Settings</Text>
            </TouchableOpacity>

            <View style={[styles(nightMode, themeColors).menuDivider, { backgroundColor: themeColors.border }]} />

            <TouchableOpacity
              style={styles(nightMode, themeColors).menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                handleManualSync();
              }}
              disabled={isSyncing}
              activeOpacity={0.7}
            >
              <IconMenuCloud c={themeColors.accent} />
              <Text style={[styles(nightMode, themeColors).menuItemText, { color: themeColors.text }]}>Sync with Cloud</Text>
              {pendingChanges > 0 && (
                <View style={[styles(nightMode, themeColors).badgePill, { marginLeft: 'auto', backgroundColor: themeColors.primary }]}>
                  <Text style={styles(nightMode, themeColors).badgePillText}>{pendingChanges}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={[styles(nightMode, themeColors).menuDivider, { backgroundColor: themeColors.border }]} />

            <TouchableOpacity
              style={styles(nightMode, themeColors).menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                dispatch(setTutorialDone(false));
                dispatch(startTutorial());
              }}
              activeOpacity={0.7}
            >
              <IconMenuHelp c={themeColors.accent} />
              <Text style={[styles(nightMode, themeColors).menuItemText, { color: themeColors.text }]}>Tutorial Walkthrough</Text>
            </TouchableOpacity>

            <View style={[styles(nightMode, themeColors).menuDivider, { backgroundColor: themeColors.border }]} />

            <TouchableOpacity
              style={styles(nightMode, themeColors).menuItem}
              onPress={async () => {
                setMenuModalVisible(false);
                await logoutUser();
                dispatch(logout());
                navigation.replace('Login');
              }}
              activeOpacity={0.7}
            >
              <IconMenuLogout c="#FF4444" />
              <Text style={[styles(nightMode, themeColors).menuItemText, { color: '#FF4444' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Settings Screen Modal */}
      {settingsModalVisible && (
        <Modal visible={settingsModalVisible} animationType="slide" onRequestClose={() => setSettingsModalVisible(false)}>
          <View style={{ flex: 1 }}>
            <SettingsScreen onClose={() => setSettingsModalVisible(false)} />
          </View>
        </Modal>
      )}

      {/* Add Student Modal */}
      <Modal visible={addModal} transparent animationType="fade" onRequestClose={() => setAddModal(false)}>
        <View style={styles(nightMode, themeColors).modalOverlay}>
          <View style={[styles(nightMode, themeColors).modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <Text style={[styles(nightMode, themeColors).modalTitle, { color: themeColors.text }]}>Add Student</Text>
            <TextInput
              style={[styles(nightMode, themeColors).input, { color: themeColors.text, backgroundColor: nightMode ? '#121520' : '#F0EBE0', borderColor: themeColors.border }]}
              placeholder="Student name"
              placeholderTextColor={nightMode ? '#757E9E' : '#999080'}
              onChangeText={setName}
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <TouchableOpacity style={[styles(nightMode, themeColors).cancelBtn, { backgroundColor: nightMode ? '#2A2E40' : '#E2DCD0' }]} onPress={() => setAddModal(false)}>
                <Text style={[styles(nightMode, themeColors).cancelText, { color: themeColors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles(nightMode, themeColors).saveBtn, { backgroundColor: themeColors.primary, opacity: isCreating || !name.trim() ? 0.6 : 1 }]}
                onPress={handleCreate}
                disabled={isCreating || !name.trim()}
              >
                <Text style={[styles(nightMode, themeColors).saveText, { color: '#FFFFFF' }]}>{isCreating ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Student Modal */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={styles(nightMode, themeColors).modalOverlay}>
          <View style={[styles(nightMode, themeColors).modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <Text style={[styles(nightMode, themeColors).modalTitle, { color: themeColors.text }]}>Edit Student</Text>
            <TextInput
              style={[styles(nightMode, themeColors).input, { color: themeColors.text, backgroundColor: nightMode ? '#121520' : '#F0EBE0', borderColor: themeColors.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Student name"
              placeholderTextColor={nightMode ? '#757E9E' : '#999080'}
              autoFocus
            />
            <View style={styles(nightMode, themeColors).photoRow}>
              {faces[editId] ? (
                <Image source={{ uri: `file://${faces[editId]}` }} style={styles(nightMode, themeColors).photoPreview} resizeMode="cover" />
              ) : (
                <View style={[styles(nightMode, themeColors).photoPreview, styles(nightMode, themeColors).photoPlaceholder]}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: themeColors.accent }}>{(editName || '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <TouchableOpacity style={[styles(nightMode, themeColors).photoBtn, { backgroundColor: themeColors.primary, flexDirection: 'row', alignItems: 'center' }]} onPress={() => pickPhoto(false)}>
                <IconGallery c="#FFFFFF" size={14} />
                <Text style={[styles(nightMode, themeColors).photoBtnText, { color: '#FFFFFF' }]}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles(nightMode, themeColors).photoBtn, { backgroundColor: themeColors.primary, flexDirection: 'row', alignItems: 'center' }]} onPress={() => pickPhoto(true)}>
                <IconCamera c="#FFFFFF" size={14} />
                <Text style={[styles(nightMode, themeColors).photoBtnText, { color: '#FFFFFF' }]}>Camera</Text>
              </TouchableOpacity>
              {faces[editId] ? (
                <TouchableOpacity style={[styles(nightMode, themeColors).photoBtn, { backgroundColor: '#FF4444' }]} onPress={removePhoto}>
                  <Text style={[styles(nightMode, themeColors).photoBtnText, { color: '#FFFFFF' }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <TouchableOpacity style={[styles(nightMode, themeColors).cancelBtn, { backgroundColor: nightMode ? '#2A2E40' : '#E2DCD0' }]} onPress={() => setEditModal(false)}>
                <Text style={[styles(nightMode, themeColors).cancelText, { color: themeColors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles(nightMode, themeColors).saveBtn, { backgroundColor: themeColors.primary }]} onPress={handleEdit}>
                <Text style={[styles(nightMode, themeColors).saveText, { color: '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal visible={alertModal.visible} title={alertModal.title} message={alertModal.message} buttons={alertModal.buttons} nightMode={nightMode} onClose={() => setAlertModal({ ...alertModal, visible: false })} />
      <DashboardFooter myQuran={myQuranStudent} navigation={navigation} />
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  menuBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 10, position: 'relative' },
  menuLine: { width: 19, height: 2.2, borderRadius: 1.5, marginVertical: 1.8 },
  menuPendingDot: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9800', borderWidth: 1.5, borderColor: '#171A24' },
  card: { padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 17, fontWeight: '800' },
  avatarImage: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  activityDot: { position: 'absolute', bottom: 1, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#1C202E' },
  cardBody: { flex: 1 },
  studentName: { fontSize: 15.5, fontWeight: '700', letterSpacing: 0.1 },
  readingLine: { fontSize: 12, fontWeight: '600' },
  dateLine: { fontSize: 10.5, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '600', marginLeft: 4 },
  heroCard: { padding: 14, borderRadius: 16, marginBottom: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6 },
  heroBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  heroBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  heroTimeAgo: { fontSize: 11, marginLeft: 8, fontWeight: '500' },
  heroTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.1 },
  heroPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  heroPillText: { fontSize: 11, fontWeight: '700' },
  continueBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  continueBtnText: { fontSize: 11.5, fontWeight: '700' },
  fabContainer: { height: 48, borderRadius: 24, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, overflow: 'hidden' },
  fabTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 12, paddingRight: 10, opacity: 0.82 },
  fabPlus: { fontSize: 24, fontWeight: '400', lineHeight: 26, width: 24, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  fabTextWrap: { marginLeft: 5, justifyContent: 'center' },
  fabTextLine: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', lineHeight: 12 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  menuDropdown: { position: 'absolute', right: 16, width: 230, borderRadius: 14, borderWidth: 1, paddingVertical: 6, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 14.5, fontWeight: '600' },
  menuDivider: { height: 1, marginHorizontal: 12 },
  badgePill: { backgroundColor: '#FF9800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { width: '84%', padding: 22, borderRadius: 18, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  photoPreview: { width: 52, height: 52, borderRadius: 26, marginRight: 10 },
  photoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  photoBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginLeft: 6 },
  photoBtnText: { fontWeight: '700', fontSize: 12 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 12, marginRight: 6 },
  cancelText: { fontWeight: '600', fontSize: 14 },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 12, marginLeft: 6 },
  saveText: { fontWeight: '700', fontSize: 14 },
});
