/**
 * FILE: src/screens/DashboardScreen.tsx
 * ROLE: Post-login hub — lists students (cache-first with background refresh), CRUD via
 *       modals + long-press, manual sync of the offline queue, logout, and entry point
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
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Image } from 'react-native';
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
import SyncIndicator from '../components/sync/SyncIndicator';
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

export default function DashboardScreen({ navigation }: any) {
  const statusBarPad = useSafeAreaInsets().top;
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
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

  /**
   * WHAT: Sorted copy of the Redux student list — OLDEST first (ascending by createdAt),
   *       so students appear in creation order (top = created first).
   * FLOW: 1) [...students] copy — the Redux array itself is NEVER mutated; 2) sort ascending
   *       by toMillis(item.createdAt) (src/utils/format.ts normalizes Firestore Timestamp
   *       objects as stored in the SQLite cache, numbers, or ISO strings); a missing/null
   *       createdAt normalizes to 0 and, being the smallest value, floats the student to the top.
   * AFFECTS: FlatList data only — getStudents() still populates Redux exactly as before.
   */
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

  // v97: resolve each student's LOCAL photo path (student_faces table — device-only).
  useEffect(() => {
    let active = true;
    const ids = (students || []).map((s: any) => s?.id).filter(Boolean);
    if (ids.length === 0) { setFaces({}); return; }
    ids.forEach((id: string) => {
      getStudentFace(id).then((path) => { if (active) setFaces((prev) => ({ ...prev, [id]: path })); }).catch(() => {});
    });
    return () => { active = false; };
  }, [students]);

  /**
   * WHAT: Reads each student's cached manifest (SQLite student_manifest_cache) once and caches
   *       { studentId: manifest } locally so every card can show a "Last read" line.
   * FLOW: Iterate the current ids; for each await getManifest(studentId) (local, cheap) and
   *       merge the result into manifests state; unresolved ids render '…' until resolved and
   *       nothing here blocks card taps (getManifest never blocks the render).
   * CALLS: getManifest -> SELECT student_manifest_cache (src/database/localDB.ts).
   * CALLED BY: React on mount/whenever the Redux student list reference changes
   *            (focus refresh or sync-completion refetch replaces the array).
   * AFFECTS: local manifests state -> renderItem "Last read" lines.
   */
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

  /**
   * WHAT: Pinned My Quran resume info — same derivation as StudentHubScreen's
   *       RESUME (useFocusEffect): getLastPageSeenLocal (device-only local_student_state,
   *       written by QuranView per settled page) falling back to lastRead
   *       (manifest lastRead synced), then getVersePage -> resumeInfo {page,juz,surah,verse}.
   *       This lets the pinned card show Reading page N · Para J · timeAgo.
   */
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
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }, []);
  const myQuranResumeSubtitle = useMemo(() => {
    if (!myQuranResumeInfo) return '';
    const parts = [`Reading page ${myQuranResumeInfo.page + 1}`, `Para ${myQuranResumeInfo.juz}`];
    const t = myQuranLastSeenAt || (myQuranLastRead?.updatedAt ? String(myQuranLastRead.updatedAt) : '');
    const ago = myQuranTimeAgo(t);
    if (ago) parts.push(ago);
    return parts.join(' · ');
  }, [myQuranResumeInfo, myQuranLastSeenAt, myQuranLastRead, myQuranTimeAgo]);
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

  /**
   * WHAT: Fires the Tier-1 startup anchor prefetcher once the student list exists.
   * FLOW: Derives the same ids the manifest effect above uses and hands them to
   *       startStartupPrefetch (src/utils/startupPrefetch.ts) — that module defers the work
   *       behind InteractionManager + 1500ms (Dashboard paints first) and runs its own
   *       once-per-process guard, so re-fires here (list refresh / focus) are cheap no-ops.
   * CALLS: startStartupPrefetch.
   * CALLED BY: React on mount / whenever the Redux student list reference changes.
   * AFFECTS: mushaf page/verse/layout-cache warm state (background, best-effort).
   */
  useEffect(() => {
    const ids = (students || []).map((s: any) => s?.id).filter(Boolean);
    if (ids.length) startStartupPrefetch(ids);
  }, [students]);

  /**
   * WHAT: Refresh the student list on every focus AND after every completed sync pull.
   * FLOW: 1) useFocusEffect re-fetches on mount and every time the screen regains focus
   *          (covers returning from QuranView) — getStudents() (src/api/student.ts) is
   *          cache-first: returns the cached SQLite list immediately and kicks a silent Firestore
   *          refresh in the background; cold start falls back to the Firestore query; 2) the
   *          sync-completion watcher below re-reads the (now fresh) SQLite cache every time a
   *          sync run finishes — App.tsx dispatches setSyncing→setSynced around every requestSync,
   *          and pullRemote caches the full students list to SQLite before setSynced, so a student
   *          added on another device appears within one sync cycle, no manual action needed.
   * CALLS: getStudents -> getCachedStudentList/cacheStudentList (localDB), refreshInBackground.
   * CALLED BY: React on mount/focus (useFocusEffect) and on sync status change (watcher effect).
   * AFFECTS: studentSlice.list; SQLite student list cache.
   * NOTES: Offline cold start with no cache yields an empty list silently (res.success=false is
   *        ignored by the .then).
   */
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

  /**
   * WHAT: Opens the shared AlertModal with a title/message/optional action buttons.
   * CALLS: setAlertModal (local state).
   * CALLED BY: handleCreate/handleManualSync/handleLongPress/handleEdit (errors, confirmations,
   *            and the Edit/Delete action sheet).
   * AFFECTS: local alertModal state -> AlertModal render.
   */
  const showAlert = useCallback((title: string, message: string, buttons?: any) => {
    setAlertModal({ visible: true, title, message, buttons });
  }, []);

  /**
   * WHAT: Creates a student on Firestore and appends it to the Redux list.
   * FLOW: 1) createStudent(name) (src/api/student.ts: users/{uid}/students add + initial
   *          studentData doc with empty bookmarks/highlights/drawings/notes/history);
   *          2) success -> dispatch(addStudent({id: res.studentId, name})), close modal,
   *          clear input; failure -> showAlert('Error', res.error).
   * CALLS: createStudent -> Firestore add; dispatch(addStudent).
   * CALLED BY: "Save" button in Add Student modal.
   * AFFECTS: Firestore students/{id} + students/{id}/data/studentData; studentSlice.list.
   * NOTES: SQLite cache NOT updated here (stale until next getStudents). Students are never
   *        queued offline — no pendingChanges increment, and createStudent throws unhandled
   *        when offline (no try/catch in src/api/student.ts).
   */
  const handleCreate = useCallback(async () => {
    const res = await createStudent(name);
    if (res.success) { dispatch(addStudent({ id: res.studentId, name })); setAddModal(false); setName(''); emitTutorialEvent('student_created', res.studentId); }
    else showAlert('Error', res.error);
  }, [name]);

  /**
   * WHAT: Manual full-sync trigger — always runs a push+pull of the offline queue so the
   *       user can test syncing; reports the pushed/pulled counts.
   * FLOW: 1) dispatch(setSyncing()) + setIsSyncing(true) -> header button shows "Syncing...";
   *          2) await processSyncQueue({ pull: true }) (src/api/sync.ts): pushes each dirty
   *          student's cached studentData to Firestore and pulls remote changes back; returns
   *          {success, pushed, pulled, error}; 3) setIsSyncing(false); success -> dispatch
   *          (setSynced()) + showAlert('Sync Complete', 'Pushed: n | Pulled: m'); failure ->
   *          dispatch(setOffline()) + showAlert('Sync Failed', error).
   * CALLS: processSyncQueue -> sync queue push + pull helpers (src/api/sync.ts,
   *         src/database/localDB.ts), Firestore set/get.
   * CALLED BY: header "Sync (n)" button (disabled only while syncing — no longer gated on
   *            pendingChanges, so it always runs a full push/pull for testing).
   * AFFECTS: syncSlice.status + syncSlice.pendingChanges (the badge shown in this header);
   *          SyncStatus pill + SyncIndicator re-render; Firestore studentData docs.
   * NOTES: OVERLAPPING-SYNC-LOOPS: the same queue is also processed by App.tsx's global
   *        scheduler — on login, on a 30-min interval, and on AppState foreground (see the
   *        "GOTCHA" comment at App.tsx:31-33) — so a manual sync here can race those
   *        automatic loops.
   */
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
  }, [dispatch]);

  /**
   * WHAT: Long-press on a student card opens an action dialog (Edit Name / Delete).
   * FLOW: showAlert(item.name, 'Choose an action:', [...]) — Edit pre-fills the edit modal;
   *       Delete runs all three removals: 1) await deleteStudent(item.id) (Firestore delete),
   *       2) await purgeLocalStudent(item.id) (SQLite student cache removal),
   *       3) dispatch(removeStudent(item.id)) (studentSlice also nulls currentStudent/
   *       studentData if the deleted student was selected).
   * CALLS: deleteStudent (src/api/student.ts), purgeLocalStudent (src/database/localDB.ts),
   *        removeStudent (src/store/studentSlice.ts).
   * CALLED BY / onLongPress on each student card (delayLongPress=400).
   * AFFECTS: Firestore students/{id}; SQLite; studentSlice.list/currentStudent.
   * NOTES: No confirmation dialog — delete happens immediately from the action sheet, and
   *        fails unhandled when offline (no try/catch in src/api/student.ts).
   */
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
  }, [showAlert]);

  /**
   * Renames a student both in Firestore and in the Redux list.
   * FLOW: 1) guard empty editName -> updateStudent(editId, editName.trim()) (Firestore
   *          update({name})); 2) success -> dispatch(updateStudentSlice({id, name})) (also
   *          patches currentStudent's name) + close modal; failure -> showAlert('Error').
   * CALLS: updateStudent (src/api/student.ts); dispatch(updateStudentSlice).
   * CALLED BY: "Save" button in Edit Student modal.
   * AFFECTS: Firestore students/{id}.name; studentSlice.list + currentStudent.
   */
  const handleEdit = useCallback(async () => {
    if (!editName.trim()) return;
    const cur = (students || []).find((s: any) => s?.id === editId);
    if (cur && isMyQuranStudent(cur)) { showAlert('My Quran', 'My Quran cannot be renamed.', [{ text: 'OK' }]); return; }
    const res = await updateStudent(editId, editName.trim());
    if (res.success) { dispatch(updateStudentSlice({ id: editId, name: editName.trim() })); setEditModal(false); }
    else showAlert('Error', res.error);
  }, [editId, editName, students, showAlert]);

  /**
   * Renders a student card; tap selects the student and enters QuranView.
   * FLOW (onPress): 1) dispatch(setCurrentStudent(item)) (currentStudent=item, studentData=null
   *          — forces StudentHub/QuranView to re-hydrate); 2) dispatch(setSurah({surahId: 1, verses: []}))
   *          resets the reader to surah 1; 3) dispatch(setToolbarExpanded(false)) collapses the
   *          drawing toolbar; 4) navigation.navigate('StudentHub') — behind it the StudentHub
   *          deep-links into QuranView ({surahId, scrollToVerse} / {page}) or the list screens.
   * CALLS: setCurrentStudent, setSurah, setToolbarExpanded; navigation.navigate.
   * AFFECTS: studentSlice.currentStudent/studentData; quranSlice; drawingSlice.toolbarExpanded;
   *          navigation -> StudentHub.
   */
  /**
   * v97 — DEVICE-ONLY student photo: pick from gallery/camera, copy into app-private
   * storage (student_faces/{id}.jpg) and record the path in SQLite. NEVER synced.
   * CALLS: react-native-image-picker, react-native-fs, saveStudentFace/clearStudentFace.
   */
  const pickPhoto = useCallback(async (fromCamera: boolean) => {
    if (!editId) return;
    try {
      // Circular crop UI (uCrop overlay) so the face fills the avatar exactly.
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
      // image-crop-picker THROWS on user cancel (E_PICKER_CANCELLED) — silently ignore.
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
    // Last-read line: manifest is cached per student in local state (see mount effect).
    const manifest = manifests[item.id];
    const lr = manifest?.lastRead;
    let readingLine: string;
    let dateLine: string | null = null;
    if (manifest && lr?.surah) {
      const ls = Number(lr.surah);
      const lv = Number(lr.verse);
      const nm = surahNames?.[ls] || `Surah ${ls}`;
      readingLine = `Reading: ${nm} · Ayat ${lv}`;
      dateLine = lr.updatedAt ? `Date: ${formatDate(lr.updatedAt)} · Time: ${formatTime(lr.updatedAt)}` : '';
    } else { readingLine = manifest ? 'Not read yet' : '…'; }
    const initial = (item.name || '?').charAt(0).toUpperCase();

    return (
      <TutorialAnchor id={index === 0 ? 'student-card' : `student-card-${item.id}`}>
      <TouchableOpacity style={[styles(nightMode).card, { backgroundColor: nightMode ? (index % 2 === 0 ? '#1a1a2e' : '#161628') : (index % 2 === 0 ? '#FBF9F4' : '#EFECE4'), borderColor: nightMode ? (index % 2 === 0 ? '#2a2a4a' : '#232344') : (index % 2 === 0 ? '#e2ddd2' : '#d9d3c6') }]} onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); dispatch(setToolbarExpanded(false)); emitTutorialEvent('student_opened'); navigation.navigate('StudentHub'); }} onLongPress={() => handleLongPress(item)} activeOpacity={0.7} delayLongPress={400}>
        <View style={styles(nightMode).cardRow}>
          {faces[item.id] ? (
            <Image source={{ uri: `file://${faces[item.id]}` }} style={styles(nightMode).avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles(nightMode).avatar}><Text style={styles(nightMode).avatarText}>{initial}</Text></View>
          )}
          <View style={styles(nightMode).cardBody}>
            <Text style={[styles(nightMode).studentName, { color: nightMode ? '#fff' : '#1a1a1a' }]} numberOfLines={1}>{item.name}</Text>
            <Text style={styles(nightMode).readingLine} numberOfLines={1}>{readingLine}</Text>
            {dateLine ? <Text style={[styles(nightMode).dateLine, { color: nightMode ? '#8a90a0' : '#6b7280' }]} numberOfLines={1}>{dateLine}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
      </TutorialAnchor>
    );
  }, [navigation, nightMode, manifests, surahNames]);

  /**
   * UI WIRING:
   * - Header: title (with blue accent dot) + SyncStatus pill + manual "Sync (n)" button
   *   (n = pendingChanges badge; disabled only while a sync is in flight — always runs a full
   *   push+run) + Logout button.
   * - Pinned My Quran card (direct Resume to QuranView — same lastPageSeen/lastRead -> getVersePage -> page/juz logic as StudentHub).
   * - Sorted FlatList of non-My-Quran students; renderItem above.
   * - FAB opens the Add Student modal.
   * - Add Student modal (autoFocus TextInput) / Edit modal (pre-filled value).
   * - Pinned DashboardFooter (Surah Index | Bookmarks | Go to page on My Quran) above CollapsibleBannerAd.
   * - SyncIndicator overlay (global syncing spinner) + AlertModal for confirm/error dialogs.
   */
  const myQuranCardSubtitle = useMemo(() => {
    if (!myQuranStudent) return 'Setting up…';
    if (!myQuranResumeInfo) return myQuranResumeSubtitle || '…';
    return myQuranResumeSubtitle || `Reading page ${myQuranResumeInfo.page + 1} · Para ${myQuranResumeInfo.juz}`;
  }, [myQuranStudent, myQuranResumeInfo, myQuranResumeSubtitle]);
  const myQuranDailyLine = useMemo(() => {
    if (!myQuranLastRead?.surah) return '';
    const ls = Number(myQuranLastRead.surah);
    const lv = Number(myQuranLastRead.verse);
    const nm = surahNames?.[ls] || `Surah ${ls}`;
    return `${nm} · Ayat ${lv}${myQuranLastRead.updatedAt ? ` · ${formatDate(myQuranLastRead.updatedAt)}` : ''}`;
  }, [myQuranLastRead, surahNames]);
  const handleMyQuranPress = useCallback(() => {
    if (!myQuranStudent?.id) return;
    dispatch(setCurrentStudent(myQuranStudent));
    dispatch(setSurah({ surahId: 1, verses: [] }));
    dispatch(setToolbarExpanded(false));
    const page = myQuranResumeInfo?.page ?? 1;
    emitTutorialEvent('quran_opened');
    navigation.navigate('QuranView' as any, { page } as any);
  }, [myQuranStudent, myQuranResumeInfo, dispatch, navigation]);

  return (
    <View style={[styles(nightMode).container, { backgroundColor: nightMode ? '#121212' : '#F4F1EA' }]}>
      <View style={[styles(nightMode).header, { backgroundColor: nightMode ? '#1e1e1e' : '#FBF9F4', borderBottomColor: nightMode ? '#2a2a2a' : '#e0e0e0', paddingTop: 16 + statusBarPad }]}>
        <View style={styles(nightMode).titleRow}><View style={styles(nightMode).titleDot} /><Text style={[styles(nightMode).title, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Students</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TutorialAnchor id="sync-pill"><SyncStatus /></TutorialAnchor>
          <TouchableOpacity onPress={handleManualSync} disabled={isSyncing}>
            <Text style={[styles(nightMode).syncBtn, (isSyncing || pendingChanges === 0) && { color: '#555' }]}>{isSyncing ? 'Syncing...' : `Sync (${pendingChanges})`}</Text>
          </TouchableOpacity>
          {/* LOGOUT (inline async onPress): await logoutUser() (Firebase signOut) ->
              dispatch(logout()) (authSlice user=null, isAuthenticated=false) -> navigation.replace('Login'). */}
          <TouchableOpacity onPress={async () => { await logoutUser(); dispatch(logout()); navigation.replace('Login'); }}>
            <Text style={styles(nightMode).logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Pinned My Quran — direct Resume to QuranView (same resume info as StudentHub). Non-deletable, non-renameable. */}
      <View style={{ paddingHorizontal: 10, paddingTop: 10 }}>
        {myQuranStudent ? (
          <TutorialAnchor id="my-quran-resume">
            <TouchableOpacity
              style={[styles(nightMode).card, styles(nightMode).myQuranCard, { backgroundColor: nightMode ? '#1e2a4a' : '#eef3ff', borderColor: nightMode ? '#2f4a7a' : '#c5d3f0' }]}
              onPress={handleMyQuranPress}
              activeOpacity={0.7}
            >
              <View style={styles(nightMode).cardRow}>
                <View style={[styles(nightMode).avatar, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]}>
                  <Text style={styles(nightMode).avatarText}>Q</Text>
                </View>
                <View style={styles(nightMode).cardBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles(nightMode).studentName, { color: nightMode ? '#fff' : '#1a1a1a' }]}>My Quran</Text>
                    <View style={[styles(nightMode).pinnedDot, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]} />
                  </View>
                  <Text style={styles(nightMode).readingLine} numberOfLines={1}>{myQuranCardSubtitle}</Text>
                  {myQuranDailyLine ? <Text style={[styles(nightMode).dateLine, { color: nightMode ? '#8a90a0' : '#6b7280' }]} numberOfLines={1}>{myQuranDailyLine}</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          </TutorialAnchor>
        ) : (
          <View style={[styles(nightMode).card, { backgroundColor: nightMode ? '#1a1a2e' : '#ffffff', borderColor: nightMode ? '#2a2a4a' : '#e5e7f0', opacity: 0.7 }]}>
            <Text style={[styles(nightMode).readingLine]}>Setting up My Quran…</Text>
          </View>
        )}
      </View>
      <FlatList style={{ flex: 1 }} data={sortedStudents} keyExtractor={(item: any) => item.id} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 72 }} renderItem={renderItem} />
      {/* position/right/bottom live on the TutorialAnchor wrapper (not the button): an absolute
          child of an unstyled anchor positions against the anchor's 0x0 box and the anchor never
          measures — the step-2 spotlight/hand would never find the FAB (same fix as draw-toolbar). */}
      <TutorialAnchor id="dashboard-fab" style={{ position: 'absolute', right: 24, bottom: adCollapsed ? 96 : 140 }}>
      <TouchableOpacity style={styles(nightMode).fab} onPress={() => setAddModal(true)} activeOpacity={0.8}><Text style={styles(nightMode).fabText}>+</Text></TouchableOpacity>
      </TutorialAnchor>

      <Modal visible={addModal} transparent animationType="fade" onRequestClose={() => setAddModal(false)}>
        <View style={styles(nightMode).modalOverlay}>
          <View style={[styles(nightMode).modalContent, { backgroundColor: nightMode ? '#1e1e1e' : '#FBF9F4', borderColor: nightMode ? '#2a2a2a' : '#d0d0d0' }]}>
            <Text style={[styles(nightMode).modalTitle, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Add Student</Text>
            <TextInput style={[styles(nightMode).input, { color: nightMode ? '#fff' : '#1a1a1a', backgroundColor: nightMode ? '#121212' : '#f5f5f5', borderColor: nightMode ? '#333' : '#ccc' }]} placeholder="Student name" placeholderTextColor="#666" onChangeText={setName} autoFocus />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={[styles(nightMode).cancelBtn, { backgroundColor: nightMode ? '#333' : '#e0e0e0' }]} onPress={() => setAddModal(false)}><Text style={[styles(nightMode).cancelText, { color: nightMode ? '#fff' : '#333' }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles(nightMode).saveBtn} onPress={handleCreate}><Text style={styles(nightMode).saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={styles(nightMode).modalOverlay}>
          <View style={[styles(nightMode).modalContent, { backgroundColor: nightMode ? '#1e1e1e' : '#FBF9F4', borderColor: nightMode ? '#2a2a2a' : '#d0d0d0' }]}>
            <Text style={[styles(nightMode).modalTitle, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Edit Student</Text>
            <TextInput style={[styles(nightMode).input, { color: nightMode ? '#fff' : '#1a1a1a', backgroundColor: nightMode ? '#121212' : '#f5f5f5', borderColor: nightMode ? '#333' : '#ccc' }]} value={editName} onChangeText={setEditName} placeholder="Student name" placeholderTextColor="#666" autoFocus />
            {/* v97: device-only photo (gallery / camera / remove) — never synced. */}
            <View style={styles(nightMode).photoRow}>
              {faces[editId] ? (
                <Image source={{ uri: `file://${faces[editId]}` }} style={styles(nightMode).photoPreview} resizeMode="cover" />
              ) : (
                <View style={[styles(nightMode).photoPreview, styles(nightMode).photoPlaceholder]}><Text style={{ fontSize: 20, fontWeight: '700', color: (nightMode ? '#7BA7DB' : '#1C3D72') }}>{(editName || '?').charAt(0).toUpperCase()}</Text></View>
              )}
              <TouchableOpacity style={styles(nightMode).photoBtn} onPress={() => pickPhoto(false)}><Text style={styles(nightMode).photoBtnText}>Gallery</Text></TouchableOpacity>
              <TouchableOpacity style={styles(nightMode).photoBtn} onPress={() => pickPhoto(true)}><Text style={styles(nightMode).photoBtnText}>Camera</Text></TouchableOpacity>
              {faces[editId] ? <TouchableOpacity style={[styles(nightMode).photoBtn, { backgroundColor: '#ff4444' }]} onPress={removePhoto}><Text style={styles(nightMode).photoBtnText}>Remove</Text></TouchableOpacity> : null}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={[styles(nightMode).cancelBtn, { backgroundColor: nightMode ? '#333' : '#e0e0e0' }]} onPress={() => setEditModal(false)}><Text style={[styles(nightMode).cancelText, { color: nightMode ? '#fff' : '#333' }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles(nightMode).saveBtn} onPress={handleEdit}><Text style={styles(nightMode).saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

<SyncIndicator />
      <AlertModal visible={alertModal.visible} title={alertModal.title} message={alertModal.message} buttons={alertModal.buttons} onClose={() => setAlertModal({ ...alertModal, visible: false })} />
      <DashboardFooter myQuran={myQuranStudent} navigation={navigation} />
      <CollapsibleBannerAd />
    </View>
  );
}
const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), marginRight: 8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  syncBtn: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), marginLeft: 12, fontSize: 13, fontWeight: '600' },
  logout: { color: '#ff4444', marginLeft: 12, fontSize: 13, fontWeight: '600' },
  card: { padding: 10, borderRadius: 12, marginBottom: 6, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#121212', fontSize: 16, fontWeight: '800' },
  avatarImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10, resizeMode: 'cover' },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  photoPreview: { width: 56, height: 56, borderRadius: 28, marginRight: 10, resizeMode: 'cover' },
  photoPlaceholder: { backgroundColor: (nightMode ? '#2a2a4a' : '#e8edf5'), justifyContent: 'center', alignItems: 'center' },
  photoBtn: { backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginLeft: 6 },
  photoBtnText: { color: '#121212', fontWeight: '700', fontSize: 12 },
  cardBody: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700' },
  readingLine: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  dateLine: { fontSize: 10.5, marginTop: 1 },
  myQuranCard: { paddingVertical: 12 },
  pinnedDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  fab: { backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  fabText: { color: '#121212', fontSize: 28, fontWeight: '700', lineHeight: 30 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { width: '82%', padding: 24, borderRadius: 16, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#333', borderRadius: 10, marginRight: 6 },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), borderRadius: 10, marginLeft: 6 },
  saveText: { color: '#121212', fontWeight: '700' }
});