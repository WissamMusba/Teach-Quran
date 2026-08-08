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
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { getStudents, createStudent, deleteStudent, updateStudent } from '../api/student';
import { setStudents, addStudent, removeStudent, updateStudent as updateStudentSlice, setCurrentStudent } from '../store/studentSlice';
import { logoutUser } from '../api/auth';
import { logout } from '../store/authSlice';
import { setSurah } from '../store/quranSlice';
import { setToolbarExpanded } from '../store/drawingSlice';
import SyncStatus from '../components/common/SyncStatus';
import SyncIndicator from '../components/sync/SyncIndicator';
import AlertModal from '../components/common/AlertModal';
import { getManifest, purgeLocalStudent } from '../database/localDB';
import { processSyncQueue } from '../api/sync';
import { setSyncing, setSynced, setOffline } from '../store/syncSlice';
import { formatDate, formatTime, toMillis } from '../utils/format';

export default function DashboardScreen({ navigation }: any) {
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [name, setName] = useState('');
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', buttons: undefined as any });
  // last-read cache: { studentId -> manifest } resolved asynchronously from SQLite.
  const [manifests, setManifests] = useState<Record<string, any>>({});
  const dispatch = useDispatch();
  const students = useSelector((s: any) => s.student.list);
  const pendingChanges = useSelector((s: any) => s.sync.pendingChanges);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const syncStatus = useSelector((s: any) => s.sync.status);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
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
  const sortedStudents = useMemo(() => {
    const arr = students ? [...students] : [];
    return arr.sort((a: any, b: any) => toMillis(a?.createdAt) - toMillis(b?.createdAt));
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
    getStudents().then(res => res.success && dispatch(setStudents(res.students)))
  }, [dispatch]));

  useEffect(() => {
    const prev = prevSyncStatus.current;
    prevSyncStatus.current = syncStatus;
    if (prev === 'syncing' && syncStatus !== 'syncing') {
      getStudents().then(res => res.success && dispatch(setStudents(res.students)));
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
    if (res.success) { dispatch(addStudent({ id: res.studentId, name })); setAddModal(false); setName(''); }
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
    const res = await updateStudent(editId, editName.trim());
    if (res.success) { dispatch(updateStudentSlice({ id: editId, name: editName.trim() })); setEditModal(false); }
    else showAlert('Error', res.error);
  }, [editId, editName]);

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
  const renderItem = useCallback(({ item }: any) => {
    // Last-read line: manifest is cached per student in local state (see mount effect).
    const manifest = manifests[item.id];
    const lr = manifest?.lastRead;
    let readingLine: string;
    let dateLine: string | null = null;
    if (manifest && lr?.surah) {
      const nm = surahNames?.[lr.surah] || `Surah ${lr.surah}`;
      readingLine = `Reading: ${nm} · Ayat ${lr.verse}`;
      dateLine = lr.updatedAt ? `Date: ${formatDate(lr.updatedAt)} · Time: ${formatTime(lr.updatedAt)}` : '';
    } else { readingLine = manifest ? 'Not read yet' : '…'; }
    const initial = (item.name || '?').charAt(0).toUpperCase();

    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: nightMode ? '#1a1a2e' : '#ffffff', borderColor: nightMode ? '#2a2a4a' : '#e5e7f0' }]} onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); dispatch(setToolbarExpanded(false)); navigation.navigate('StudentHub'); }} onLongPress={() => handleLongPress(item)} activeOpacity={0.7} delayLongPress={400}>
        <View style={styles.cardRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <View style={styles.cardBody}>
            <Text style={[styles.studentName, { color: nightMode ? '#fff' : '#1a1a1a' }]} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.readingLine} numberOfLines={1}>{readingLine}</Text>
            {dateLine ? <Text style={[styles.dateLine, { color: nightMode ? '#8a90a0' : '#6b7280' }]} numberOfLines={1}>{dateLine}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, nightMode, manifests, surahNames]);

  /**
   * UI WIRING:
   * - Header: title (with teal accent dot) + SyncStatus pill + manual "Sync (n)" button
   *   (n = pendingChanges badge; disabled only while a sync is in flight — always runs a full
   *   push+run) + Logout button.
   * - Sorted FlatList of students (sortedStudents, oldest first); renderItem above.
   * - FAB opens the Add Student modal.
   * - Add Student modal (autoFocus TextInput) / Edit modal (pre-filled value).
   * - SyncIndicator overlay (global syncing spinner) + AlertModal for confirm/error dialogs.
   */
  return (
    <View style={[styles.container, { backgroundColor: nightMode ? '#121212' : '#f2f2f7' }]}>
      <View style={[styles.header, { backgroundColor: nightMode ? '#1e1e1e' : '#ffffff', borderBottomColor: nightMode ? '#2a2a2a' : '#e0e0e0' }]}>
        <View style={styles.titleRow}><View style={styles.titleDot} /><Text style={[styles.title, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Students</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SyncStatus />
          <TouchableOpacity onPress={handleManualSync} disabled={isSyncing}>
            <Text style={[styles.syncBtn, (isSyncing || pendingChanges === 0) && { color: '#555' }]}>{isSyncing ? 'Syncing...' : `Sync (${pendingChanges})`}</Text>
          </TouchableOpacity>
          {/* LOGOUT (inline async onPress): await logoutUser() (Firebase signOut) ->
              dispatch(logout()) (authSlice user=null, isAuthenticated=false) -> navigation.replace('Login'). */}
          <TouchableOpacity onPress={async () => { await logoutUser(); dispatch(logout()); navigation.replace('Login'); }}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList data={sortedStudents} keyExtractor={(item: any) => item.id} contentContainerStyle={{ padding: 16 }} renderItem={renderItem} />
      <TouchableOpacity style={styles.fab} onPress={() => setAddModal(true)} activeOpacity={0.8}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      <Modal visible={addModal} transparent animationType="fade" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: nightMode ? '#1e1e1e' : '#ffffff', borderColor: nightMode ? '#2a2a2a' : '#d0d0d0' }]}>
            <Text style={[styles.modalTitle, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Add Student</Text>
            <TextInput style={[styles.input, { color: nightMode ? '#fff' : '#1a1a1a', backgroundColor: nightMode ? '#121212' : '#f5f5f5', borderColor: nightMode ? '#333' : '#ccc' }]} placeholder="Student name" placeholderTextColor="#666" onChangeText={setName} autoFocus />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: nightMode ? '#333' : '#e0e0e0' }]} onPress={() => setAddModal(false)}><Text style={[styles.cancelText, { color: nightMode ? '#fff' : '#333' }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: nightMode ? '#1e1e1e' : '#ffffff', borderColor: nightMode ? '#2a2a2a' : '#d0d0d0' }]}>
            <Text style={[styles.modalTitle, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Edit Student Name</Text>
            <TextInput style={[styles.input, { color: nightMode ? '#fff' : '#1a1a1a', backgroundColor: nightMode ? '#121212' : '#f5f5f5', borderColor: nightMode ? '#333' : '#ccc' }]} value={editName} onChangeText={setEditName} placeholder="Student name" placeholderTextColor="#666" autoFocus />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: nightMode ? '#333' : '#e0e0e0' }]} onPress={() => setEditModal(false)}><Text style={[styles.cancelText, { color: nightMode ? '#fff' : '#333' }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleEdit}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SyncIndicator />
      <AlertModal visible={alertModal.visible} title={alertModal.title} message={alertModal.message} buttons={alertModal.buttons} onClose={() => setAlertModal({ ...alertModal, visible: false })} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00d4aa', marginRight: 8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  syncBtn: { color: '#00d4aa', marginLeft: 12, fontSize: 13, fontWeight: '600' },
  logout: { color: '#ff4444', marginLeft: 12, fontSize: 13, fontWeight: '600' },
  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#00d4aa', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { color: '#121212', fontSize: 22, fontWeight: '800' },
  cardBody: { flex: 1 },
  studentName: { fontSize: 17, fontWeight: '700' },
  readingLine: { color: '#00d4aa', fontSize: 13, fontWeight: '600', marginTop: 4 },
  dateLine: { fontSize: 12, marginTop: 2 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#00d4aa', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  fabText: { color: '#121212', fontSize: 28, fontWeight: '700', lineHeight: 30 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { width: '82%', padding: 24, borderRadius: 16, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#333', borderRadius: 10, marginRight: 6 },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#00d4aa', borderRadius: 10, marginLeft: 6 },
  saveText: { color: '#121212', fontWeight: '700' }
});