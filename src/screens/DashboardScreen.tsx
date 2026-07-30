import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput } from 'react-native';
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

  useEffect(() => { getStudents().then(res => res.success && dispatch(setStudents(res.students))); }, []);

  const showAlert = useCallback((title: string, message: string, buttons?: any) => {
    setAlertModal({ visible: true, title, message, buttons });
  }, []);

  const handleCreate = useCallback(async () => {
    const res = await createStudent(name);
    if (res.success) { dispatch(addStudent({ id: res.studentId, name })); setAddModal(false); setName(''); }
    else showAlert('Error', res.error);
  }, [name]);

  const handleManualSync = useCallback(async () => {
    if (pendingChanges === 0) { showAlert('Up to Date', 'Nothing to sync.'); return; }
    dispatch(setSyncing()); setIsSyncing(true);
    const result = await processSyncQueue();
    setIsSyncing(false); if (result.success) dispatch(setSynced()); else dispatch(setOffline());
  }, [pendingChanges, dispatch]);

  const handleLongPress = useCallback((item: any) => {
    showAlert(item.name, 'Choose an action:', [
      { text: 'Edit Name', onPress: () => { setEditId(item.id); setEditName(item.name); setEditModal(true); } },
      { text: 'Delete', style: 'destructive' as const, onPress: async () => {
        await deleteStudent(item.id); await purgeLocalStudent(item.id); dispatch(removeStudent(item.id));
      }},
    ]);
  }, []);

  const handleEdit = useCallback(async () => {
    if (!editName.trim()) return;
    const res = await updateStudent(editId, editName.trim());
    if (res.success) { dispatch(updateStudentSlice({ id: editId, name: editName.trim() })); setEditModal(false); }
    else showAlert('Error', res.error);
  }, [editId, editName]);

  const renderItem = useCallback(({ item }: any) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: nightMode ? '#1a1a2e' : '#f0f4ff', borderColor: nightMode ? '#2a2a4a' : '#d0d8e8' }]} onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); dispatch(setToolbarExpanded(false)); navigation.navigate('QuranView'); }} onLongPress={() => handleLongPress(item)} activeOpacity={0.7} delayLongPress={400}>
      <Text style={[styles.studentName, { color: nightMode ? '#fff' : '#1a1a2e' }]}>{item.name}</Text>
    </TouchableOpacity>
  ), [navigation, nightMode]);

  return (
    <View style={[styles.container, { backgroundColor: nightMode ? '#121212' : '#f2f2f7' }]}>
      <View style={[styles.header, { backgroundColor: nightMode ? '#1e1e1e' : '#ffffff', borderBottomColor: nightMode ? '#2a2a2a' : '#e0e0e0' }]}>
        <Text style={[styles.title, { color: nightMode ? '#fff' : '#1a1a1a' }]}>Students</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SyncStatus />
          <TouchableOpacity onPress={handleManualSync} disabled={isSyncing || pendingChanges === 0}>
            <Text style={[styles.syncBtn, (isSyncing || pendingChanges === 0) && { color: '#555' }]}>{isSyncing ? 'Syncing...' : `Sync (${pendingChanges})`}</Text>
          </TouchableOpacity>
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
