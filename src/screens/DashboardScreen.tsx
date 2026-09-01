/**
 * FILE: src/screens/DashboardScreen.tsx
 * ROLE: Post-login hub — lists students (cache-first with background refresh), CRUD via
 *       modals + long-press, manual sync of the offline queue, logout, settings entry, and entry point
 *       into QuranView for a selected student.
 * DEPENDS ON: src/api/student.ts, src/api/auth.ts, src/api/sync.ts, src/database/localDB.ts,
 *             src/utils/format.ts (formatDate/formatTime/toMillis),
 *             src/store/{studentSlice,authSlice,quranSlice,syncSlice,drawingSlice}.ts,
 *             src/components/common/{AlertModal,SyncStatus}.tsx,
 *             src/components/sync/SyncIndicator.tsx
 * USED BY: registered as stack screen "Dashboard" in App.tsx; reached from
 *          SplashScreen.tsx / LoginScreen.tsx (replace) and via "back" from QuranViewScreen.tsx
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Image, Animated, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
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
import { JUZ_MAP } from '../utils/theme';
import { getManifest, purgeLocalStudent, getStudentFace, saveStudentFace, clearStudentFace, getLastPageSeenLocal } from '../database/localDB';
import ImagePicker from 'react-native-image-crop-picker';
import { processSyncQueue } from '../api/sync';
import { setSyncing, setSynced, setOffline } from '../store/syncSlice';
import { formatDate, formatTime, toMillis } from '../utils/format';
import { startStartupPrefetch } from '../utils/startupPrefetch';
import { emitTutorialEvent } from '../tutorial/tutorialRuntime';
import TutorialAnchor from '../tutorial/TutorialAnchor';
import SettingsScreen from './SettingsScreen';

export default function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const statusBarPad = insets.top;
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', buttons: undefined as any });
  // last-read cache: { studentId -> manifest } resolved asynchronously from SQLite.
  const [manifests, setManifests] = useState<Record<string, any>>({});
  // v97: device-only student photos ({ studentId -> local file path }); never synced.
  const [faces, setFaces] = useState<Record<string, string | null>>({});
  const dispatch = useDispatch();
  const students = useSelector((s: any) => s.student.list);
  const pendingChanges = useSelector((s: any) => s.sync.pendingChanges);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const syncStatus = useSelector((s: any) => s.sync.status);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const adCollapsed = useSelector((s: any) => s.settings?.adCollapsed === true);
  const prevSyncStatus = useRef<string | null>(null);

  // Rolling FAB animation on mount
  const fabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fabAnim, {
      toValue: 1,
      duration: 650,
      delay: 350,
      useNativeDriver: false,
    }).start();
  }, [fabAnim]);

  const fabWidth = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [52, 148] });
  const fabRotate = fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const fabTextOpacity = fabAnim.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, 1] });
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
    if (ids.length === 0) { setManifests({}); return; }
    ids.forEach((id: string) => {
      getManifest(id)
        .then((res: any) => { if (active) setManifests((prev) => ({ ...prev, [id]: res.data })); })
        .catch(() => {});
    });
    return () => { active = false; };
  }, [students]);

  const textStyle = useSelector((s: any) => s.quran.textStyle);
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
    const res = await createStudent(name);
    if (res.success) { dispatch(addStudent({ id: res.studentId, name })); setAddModal(false); setName(''); emitTutorialEvent('student_created', res.studentId); }
    else showAlert('Error', res.error);
  }, [name, showAlert, dispatch]);

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
    let readingLine: string;
    let dateLine: string | null = null;
    if (manifest && lr?.surah) {
      const ls = Number(lr.surah);
      const lv = Number(lr.verse);
      const nm = surahNames?.[ls] || `Surah ${ls}`;
      readingLine = `${nm} · Ayat ${lv}`;
      dateLine = lr.updatedAt ? `${formatDate(lr.updatedAt)} · ${formatTime(lr.updatedAt)}` : '';
    } else { readingLine = manifest ? 'Not read yet' : '…'; }
    const initial = (item.name || '?').charAt(0).toUpperCase();

    return (
      <TutorialAnchor id={index === 0 ? 'student-card' : `student-card-${item.id}`}>
      <TouchableOpacity
        style={[
          styles(nightMode).card,
          {
            backgroundColor: nightMode ? (index % 2 === 0 ? '#1b1d28' : '#161822') : (index % 2 === 0 ? '#FAF7EE' : '#F4EFE2'),
            borderColor: nightMode ? (index % 2 === 0 ? '#2c3044' : '#222536') : (index % 2 === 0 ? '#E2DDD0' : '#D8D1BF'),
          }
        ]}
        onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); dispatch(setToolbarExpanded(false)); emitTutorialEvent('student_opened'); navigation.navigate('StudentHub'); }}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.75}
        delayLongPress={400}
      >
        <View style={styles(nightMode).cardRow}>
          {faces[item.id] ? (
            <Image source={{ uri: `file://${faces[item.id]}` }} style={styles(nightMode).avatarImage} resizeMode="cover" />
          ) : (
            <View style={[styles(nightMode).avatar, { backgroundColor: nightMode ? '#28334E' : '#E6DEC8', borderColor: nightMode ? '#3C4D75' : '#D0C4A4', borderWidth: 1 }]}>
              <Text style={[styles(nightMode).avatarText, { color: nightMode ? '#93BCF0' : '#1C3D72' }]}>{initial}</Text>
            </View>
          )}
          <View style={styles(nightMode).cardBody}>
            <Text style={[styles(nightMode).studentName, { color: nightMode ? '#FFFFFF' : '#1A1A1A' }]} numberOfLines={1}>{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Text style={styles(nightMode).readingLine} numberOfLines={1}>{readingLine}</Text>
            </View>
            {dateLine ? <Text style={[styles(nightMode).dateLine, { color: nightMode ? '#8E95A8' : '#7D7667' }]} numberOfLines={1}>{dateLine}</Text> : null}
          </View>
          <Text style={[styles(nightMode).chevron, { color: nightMode ? '#5C6378' : '#AFA794' }]}>›</Text>
        </View>
      </TouchableOpacity>
      </TutorialAnchor>
    );
  }, [navigation, nightMode, manifests, surahNames, faces, handleLongPress, dispatch]);

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

  return (
    <View style={[styles(nightMode).container, { backgroundColor: nightMode ? '#10121A' : '#FAF7EE', paddingBottom: insets.bottom }]}>
      {/* Top Header */}
      <View style={[styles(nightMode).header, { backgroundColor: nightMode ? '#171A24' : '#F3EFE4', borderBottomColor: nightMode ? '#242838' : '#E2DDD0', paddingTop: 14 + statusBarPad }]}>
        <View style={styles(nightMode).titleRow}>
          <View style={styles(nightMode).titleDot} />
          <Text style={[styles(nightMode).title, { color: nightMode ? '#FFFFFF' : '#1A1A1A' }]}>Students</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TutorialAnchor id="sync-pill"><SyncStatus /></TutorialAnchor>

          {/* 3-Line Hamburger Menu Button */}
          <TouchableOpacity
            style={styles(nightMode).menuBtn}
            onPress={() => setMenuModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles(nightMode).menuLine, { backgroundColor: nightMode ? '#FFFFFF' : '#1C3D72' }]} />
            <View style={[styles(nightMode).menuLine, { backgroundColor: nightMode ? '#FFFFFF' : '#1C3D72', width: 15 }]} />
            <View style={[styles(nightMode).menuLine, { backgroundColor: nightMode ? '#FFFFFF' : '#1C3D72' }]} />
            {pendingChanges > 0 && <View style={styles(nightMode).menuPendingDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Featured "My Quran" Hero Card */}
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
        {myQuranStudent ? (
          <TutorialAnchor id="my-quran-resume">
            <TouchableOpacity
              style={[
                styles(nightMode).card,
                styles(nightMode).heroCard,
                {
                  backgroundColor: nightMode ? '#18233C' : '#EAF0FA',
                  borderColor: nightMode ? '#2D3F66' : '#C7D7F0',
                }
              ]}
              onPress={handleMyQuranPress}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles(nightMode).heroBadge, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]}>
                    <Text style={styles(nightMode).heroBadgeText}>MY QURAN</Text>
                  </View>
                  {myQuranLastSeenAt ? (
                    <Text style={[styles(nightMode).heroTimeAgo, { color: nightMode ? '#93A4C7' : '#55698C' }]}>
                      {myQuranTimeAgo(myQuranLastSeenAt)}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles(nightMode).continueBtn, { backgroundColor: nightMode ? '#2B3C61' : '#1C3D72' }]}>
                  <Text style={[styles(nightMode).continueBtnText, { color: nightMode ? '#99C0FF' : '#FFFFFF' }]}>Continue ➔</Text>
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={[styles(nightMode).heroTitle, { color: nightMode ? '#FFFFFF' : '#111D33' }]}>
                  {currentSurahTitle}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <View style={[styles(nightMode).heroPill, { backgroundColor: nightMode ? 'rgba(123,167,219,0.18)' : '#DDE8F8' }]}>
                    <Text style={[styles(nightMode).heroPillText, { color: nightMode ? '#8EBEF5' : '#1C3D72' }]}>
                      Page {myQuranResumeInfo ? myQuranResumeInfo.page : 1}
                    </Text>
                  </View>
                  <View style={[styles(nightMode).heroPill, { backgroundColor: nightMode ? 'rgba(123,167,219,0.18)' : '#DDE8F8', marginLeft: 6 }]}>
                    <Text style={[styles(nightMode).heroPillText, { color: nightMode ? '#8EBEF5' : '#1C3D72' }]}>
                      Juz {myQuranResumeInfo ? myQuranResumeInfo.juz : 1}
                    </Text>
                  </View>
                  {myQuranResumeInfo?.verse ? (
                    <View style={[styles(nightMode).heroPill, { backgroundColor: nightMode ? 'rgba(123,167,219,0.18)' : '#DDE8F8', marginLeft: 6 }]}>
                      <Text style={[styles(nightMode).heroPillText, { color: nightMode ? '#8EBEF5' : '#1C3D72' }]}>
                        Ayat {myQuranResumeInfo.verse}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          </TutorialAnchor>
        ) : (
          <View style={[styles(nightMode).card, { backgroundColor: nightMode ? '#18233C' : '#EAF0FA', borderColor: nightMode ? '#2D3F66' : '#C7D7F0', opacity: 0.7 }]}>
            <Text style={[styles(nightMode).readingLine, { textAlign: 'center', paddingVertical: 12 }]}>Setting up My Quran…</Text>
          </View>
        )}
      </View>

      {/* Student Cards List */}
      <FlatList
        style={{ flex: 1 }}
        data={sortedStudents}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 85 }}
        renderItem={renderItem}
      />

      {/* Rolling Animated FAB */}
      <TutorialAnchor id="dashboard-fab" style={{ position: 'absolute', right: 20, bottom: adCollapsed ? 94 : 138 }}>
        <Animated.View style={[styles(nightMode).fabContainer, { width: fabWidth }]}>
          <TouchableOpacity
            style={[styles(nightMode).fabTouchable, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]}
            onPress={() => setAddModal(true)}
            activeOpacity={0.85}
          >
            <Animated.Text style={[styles(nightMode).fabPlus, { color: nightMode ? '#0F1829' : '#FFFFFF', transform: [{ rotate: fabRotate }] }]}>
              +
            </Animated.Text>
            <Animated.Text
              numberOfLines={1}
              style={[
                styles(nightMode).fabTextLabel,
                {
                  color: nightMode ? '#0F1829' : '#FFFFFF',
                  opacity: fabTextOpacity,
                  transform: [{ translateX: fabTextTranslate }],
                }
              ]}
            >
              Add Student
            </Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      </TutorialAnchor>

      {/* 3-Line Menu Modal */}
      <Modal visible={menuModalVisible} transparent animationType="fade" onRequestClose={() => setMenuModalVisible(false)}>
        <Pressable style={styles(nightMode).menuBackdrop} onPress={() => setMenuModalVisible(false)}>
          <View style={[styles(nightMode).menuDropdown, { backgroundColor: nightMode ? '#1C202E' : '#FFFFFF', borderColor: nightMode ? '#323950' : '#E0DCD0', top: statusBarPad + 58 }]}>
            {/* Settings Option */}
            <TouchableOpacity
              style={styles(nightMode).menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                setSettingsModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, marginRight: 12 }}>⚙️</Text>
              <Text style={[styles(nightMode).menuItemText, { color: nightMode ? '#FFFFFF' : '#1A1A1A' }]}>Settings</Text>
            </TouchableOpacity>

            <View style={[styles(nightMode).menuDivider, { backgroundColor: nightMode ? '#2B3145' : '#EFECE2' }]} />

            {/* Save to Cloud / Sync Option */}
            <TouchableOpacity
              style={styles(nightMode).menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                handleManualSync();
              }}
              disabled={isSyncing}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, marginRight: 12 }}>☁️</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles(nightMode).menuItemText, { color: nightMode ? '#FFFFFF' : '#1A1A1A' }]}>
                  {isSyncing ? 'Syncing...' : 'Save to Cloud (Sync)'}
                </Text>
                {pendingChanges > 0 && (
                  <View style={styles(nightMode).badgePill}>
                    <Text style={styles(nightMode).badgePillText}>{pendingChanges}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <View style={[styles(nightMode).menuDivider, { backgroundColor: nightMode ? '#2B3145' : '#EFECE2' }]} />

            {/* Logout Option */}
            <TouchableOpacity
              style={styles(nightMode).menuItem}
              onPress={async () => {
                setMenuModalVisible(false);
                await logoutUser();
                dispatch(logout());
                navigation.replace('Login');
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, marginRight: 12 }}>🚪</Text>
              <Text style={[styles(nightMode).menuItemText, { color: '#FF5252', fontWeight: '700' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      {settingsModalVisible && (
        <Modal visible={settingsModalVisible} animationType="slide" onRequestClose={() => setSettingsModalVisible(false)}>
          <View style={{ flex: 1 }}>
            <SettingsScreen onClose={() => setSettingsModalVisible(false)} />
          </View>
        </Modal>
      )}

      {/* Add Student Modal */}
      <Modal visible={addModal} transparent animationType="fade" onRequestClose={() => setAddModal(false)}>
        <View style={styles(nightMode).modalOverlay}>
          <View style={[styles(nightMode).modalContent, { backgroundColor: nightMode ? '#1C202E' : '#FAF7EE', borderColor: nightMode ? '#323950' : '#DCD6C5' }]}>
            <Text style={[styles(nightMode).modalTitle, { color: nightMode ? '#FFFFFF' : '#1A1A1A' }]}>Add Student</Text>
            <TextInput
              style={[styles(nightMode).input, { color: nightMode ? '#FFFFFF' : '#1A1A1A', backgroundColor: nightMode ? '#121520' : '#F0EBE0', borderColor: nightMode ? '#38405A' : '#CDC4B0' }]}
              placeholder="Student name"
              placeholderTextColor={nightMode ? '#757E9E' : '#999080'}
              onChangeText={setName}
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <TouchableOpacity style={[styles(nightMode).cancelBtn, { backgroundColor: nightMode ? '#2A2E40' : '#E2DCD0' }]} onPress={() => setAddModal(false)}>
                <Text style={[styles(nightMode).cancelText, { color: nightMode ? '#FFFFFF' : '#333333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles(nightMode).saveBtn, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]} onPress={handleCreate}>
                <Text style={[styles(nightMode).saveText, { color: nightMode ? '#0F1829' : '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Student Modal */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={styles(nightMode).modalOverlay}>
          <View style={[styles(nightMode).modalContent, { backgroundColor: nightMode ? '#1C202E' : '#FAF7EE', borderColor: nightMode ? '#323950' : '#DCD6C5' }]}>
            <Text style={[styles(nightMode).modalTitle, { color: nightMode ? '#FFFFFF' : '#1A1A1A' }]}>Edit Student</Text>
            <TextInput
              style={[styles(nightMode).input, { color: nightMode ? '#FFFFFF' : '#1A1A1A', backgroundColor: nightMode ? '#121520' : '#F0EBE0', borderColor: nightMode ? '#38405A' : '#CDC4B0' }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Student name"
              placeholderTextColor={nightMode ? '#757E9E' : '#999080'}
              autoFocus
            />
            <View style={styles(nightMode).photoRow}>
              {faces[editId] ? (
                <Image source={{ uri: `file://${faces[editId]}` }} style={styles(nightMode).photoPreview} resizeMode="cover" />
              ) : (
                <View style={[styles(nightMode).photoPreview, styles(nightMode).photoPlaceholder]}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: (nightMode ? '#7BA7DB' : '#1C3D72') }}>{(editName || '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <TouchableOpacity style={[styles(nightMode).photoBtn, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]} onPress={() => pickPhoto(false)}>
                <Text style={[styles(nightMode).photoBtnText, { color: nightMode ? '#0F1829' : '#FFFFFF' }]}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles(nightMode).photoBtn, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]} onPress={() => pickPhoto(true)}>
                <Text style={[styles(nightMode).photoBtnText, { color: nightMode ? '#0F1829' : '#FFFFFF' }]}>Camera</Text>
              </TouchableOpacity>
              {faces[editId] ? (
                <TouchableOpacity style={[styles(nightMode).photoBtn, { backgroundColor: '#FF4444' }]} onPress={removePhoto}>
                  <Text style={[styles(nightMode).photoBtnText, { color: '#FFFFFF' }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <TouchableOpacity style={[styles(nightMode).cancelBtn, { backgroundColor: nightMode ? '#2A2E40' : '#E2DCD0' }]} onPress={() => setEditModal(false)}>
                <Text style={[styles(nightMode).cancelText, { color: nightMode ? '#FFFFFF' : '#333333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles(nightMode).saveBtn, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]} onPress={handleEdit}>
                <Text style={[styles(nightMode).saveText, { color: nightMode ? '#0F1829' : '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal visible={alertModal.visible} title={alertModal.title} message={alertModal.message} buttons={alertModal.buttons} onClose={() => setAlertModal({ ...alertModal, visible: false })} />
      <DashboardFooter myQuran={myQuranStudent} navigation={navigation} />
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), marginRight: 8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  menuBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: nightMode ? '#222738' : '#E8E3D5', justifyContent: 'center', alignItems: 'center', marginLeft: 10, position: 'relative' },
  menuLine: { width: 19, height: 2.2, borderRadius: 1.5, marginVertical: 1.8 },
  menuPendingDot: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9800', borderWidth: 1.5, borderColor: nightMode ? '#171A24' : '#F3EFE4' },
  card: { padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 17, fontWeight: '800' },
  avatarImage: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  cardBody: { flex: 1 },
  studentName: { fontSize: 15.5, fontWeight: '700', letterSpacing: 0.1 },
  readingLine: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), fontSize: 12, fontWeight: '600' },
  dateLine: { fontSize: 10.5, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '600', marginLeft: 6 },
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
  fabTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  fabPlus: { fontSize: 24, fontWeight: '700', lineHeight: 26, marginRight: 6 },
  fabTextLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
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
  photoPlaceholder: { backgroundColor: (nightMode ? '#222738' : '#E6DEC8'), justifyContent: 'center', alignItems: 'center' },
  photoBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginLeft: 6 },
  photoBtnText: { fontWeight: '700', fontSize: 12 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 12, marginRight: 6 },
  cancelText: { fontWeight: '600', fontSize: 14 },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 12, marginLeft: 6 },
  saveText: { fontWeight: '700', fontSize: 14 },
});
