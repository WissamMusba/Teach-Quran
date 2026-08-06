/**
 * FILE: src/screens/DashboardScreen.tsx
 * ROLE: Post-login hub — lists students (cache-first with background refresh), CRUD via
 *       modals + long-press, manual sync of the offline queue, logout, and entry point
 *       into QuranView for a selected student.
 * DEPENDS ON: src/api/student.ts, src/api/auth.ts, src/api/sync.ts, src/database/localDB.ts,
 *             src/store/{studentSlice,authSlice,quranSlice,syncSlice,drawingSlice}.ts,
 *             src/components/common/{AlertModal,SyncStatus}.tsx,
 *             src/components/sync/SyncIndicator.tsx
 * USED BY: registered as stack screen "Dashboard" in App.tsx; reached from
 *          SplashScreen.tsx / LoginScreen.tsx (replace) and via "back" from QuranViewScreen.tsx
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { purgeLocalStudent } from '../database/localDB';
import { processSyncQueue } from '../api/sync';
import { setSyncing, setSynced, setOffline } from '../store/syncSlice';

export default function DashboardScreen({ navigation }: any) {
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [name, setName] = useState('');
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', buttons: undefined as any });
  const dispatch = useDispatch();
  const students = useSelector((s: any) => s.student.list);
  const pendingChanges = useSelector((s: any) => s.sync.pendingChanges);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const syncStatus = useSelector((s: any) => s.sync.status);
  const prevSyncStatus = useRef<string | null>(null);

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
   *        src/database/localDB.ts), Firestore set/get.
   * CALLED BY: header "Sync (n)" button (disabled only while syncing — no longer gated on
   *            pendingChanges, so it always runs a full push+pull for testing).
   * AFFECTS: syncSlice.status + syncSlice.pendingChanges (the badge shown in this header);
   *          SyncStatus pill + SyncIndicator re-render; Firestore studentData docs.
   * NOTES: OVERLAPPING-SYNC-LOOPS: the same queue is also processed by App.tsx's global
   *        scheduler — on login, on a 30-min interval, and on AppState foreground (see the
   *        "GOTCHA" comment at App.tsx:31-33) — so a manual sync here can race those
   *        automatic loops. The result counts come from the fixed backend (src/api/sync.ts);
   *        pushed/pulled are numbers when the backend reports them.
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
   * CALLED BY: onLongPress on each student card (delayLongPress=400).
   * AFFECTS: Firestore students/{id}; SQLite student cache; studentSlice.list/currentStudent.
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
  }, []);

  /**
   * WHAT: Renames a student both in Firestore and in the Redux list.
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
   * WHAT: Renders a student card; tap selects the student and enters QuranView.
   * FLOW (onPress): 1) dispatch(setCurrentStudent(item)) (currentStudent=item, studentData=null
   *          — forces QuranView to re-hydrate); 2) dispatch(setSurah({surahId: 1, verses: []}))
   *          resets the reader to surah 1; 3) dispatch(setToolbarExpanded(false)) collapses the
   *          drawing toolbar; 4) navigation.navigate('QuranView') — no params; QuranView reads
   *          currentStudent from Redux.
   * CALLS: setCurrentStudent, setSurah, setToolbarExpanded; navigation.navigate.
   * CALLED BY: FlatList renderItem (students list).
   * AFFECTS: studentSlice.currentStudent/studentData; quranSlice; drawingSlice.toolbarExpanded;
   *          navigation -> QuranView.
   * NOTES: No studentId param is passed — QuranView is fully driven by studentSlice.currentStudent
   *        (that is why setting studentData=null matters). nightMode from settingsSlice
   *        re-styles card/container colors.
   */
  const renderItem = useCallback(({ item }: any) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: nightMode ? '#1a1a2e' : '#f0f4ff', borderColor: nightMode ? '#2a2a4a' : '#d0d8e8' }]} onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); dispatch(setToolbarExpanded(false)); navigation.navigate('QuranView'); }} onLongPress={() => handleLongPress(item)} activeOpacity={0.7} delayLongPress={400}>
      <Text style={[styles.studentName, { color: nightMode ? '#fff' : '#1a1a2e' }]}>{item.name}</Text>
    </TouchableOpacity>
  ), [navigation, nightMode]);

  /**
   * UI WIRING:
   * - Header: title + SyncStatus pill + manual "Sync (n)" button (n = pendingChanges badge
   *   read from syncSlice at the top of the component; disabled only while a sync is in
   *   flight — NOT gated on pendingChanges, so it always runs a full push+pull) + Logout button.
   * - FlatList of students (renderItem); FAB opens the Add Student modal.
   * - Add Student modal (autoFocus TextInput) / Edit modal (pre-filled value).
   * - SyncIndicator overlay (global syncing spinner) + AlertModal for confirm/error dialogs.
   */
  return (
    <View style={[styles.container, { backgroundColor: nightMode ? '#121212' : '#f2f2f7' }]}>
      <View style={[styles.header, { backgroundColor: nightMode ? '#1e1e1e' : '#ffffff', borderBottomColor: nightMode ? '#2a2a2a' : '#e0e0e0' }]}>
        <Text style={[styles.title, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Students</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SyncStatus />
          <TouchableOpacity onPress={handleManualSync} disabled={isSyncing}>
            <Text style={[styles.syncBtn, (isSyncing || pendingChanges === 0) && { color: '#555' }]}>{isSyncing ? 'Syncing...' : `Sync (${pendingChanges})`}</Text>
          </TouchableOpacity>
          {/* LOGOUT (inline async onPress): await logoutUser() (Firebase signOut) ->
              dispatch(logout()) (authSlice: user=null, isAuthenticated=false — tears down
              App.tsx's global sync effect/interval/listener) -> navigation.replace('Login').
              NOTE: Redux student list + sync badge are NOT cleared — a second login shows
              the previous user's cached list until the mount effect re-fetches. */}
          <TouchableOpacity onPress={async () => { await logoutUser(); dispatch(logout()); navigation.replace('Login'); }}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList data={students} keyExtractor={(item: any) => item.id} contentContainerStyle={{ padding: 16 }} renderItem={renderItem} />
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
  title: { fontSize: 22, fontWeight: '700' },
  syncBtn: { color: '#00d4aa', marginLeft: 12, fontSize: 13, fontWeight: '600' },
  logout: { color: '#ff4444', marginLeft: 12, fontSize: 13, fontWeight: '600' },
  card: { padding: 18, borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  studentName: { fontSize: 18, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#00d4aa', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { color: '#121212', fontSize: 28, fontWeight: '700', lineHeight: 30 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { width: '82%', padding: 24, borderRadius: 12, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, marginRight: 6 },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#00d4aa', borderRadius: 8, marginLeft: 6 },
  saveText: { color: '#121212', fontWeight: '700' }
});
