import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { getStudents, createStudent, deleteStudent } from '../api/student';
import { setStudents, addStudent, removeStudent, setCurrentStudent } from '../store/studentSlice';
import { logoutUser } from '../api/auth';
import { logout } from '../store/authSlice';
import { setSurah } from '../store/quranSlice';
import SyncStatus from '../components/common/SyncStatus';
import { purgeLocalStudent } from '../database/localDB';
import { processSyncQueue } from '../api/sync';

export default function DashboardScreen({ navigation }: any) {
  const [modal, setModal] = useState(false); const [name, setName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const dispatch = useDispatch(); const students = useSelector((s: any) => s.student.list);
  const pendingChanges = useSelector((s: any) => s.sync.pendingChanges);

  useEffect(() => { getStudents().then(res => res.success && dispatch(setStudents(res.students))); }, []);

  const handleCreate = async () => { const res = await createStudent(name); if (res.success) { dispatch(addStudent({ id: res.studentId, name })); setModal(false); setName(''); } };

  const handleManualSync = async () => {
    if (pendingChanges === 0) { Alert.alert('Up to Date', 'Nothing to sync.'); return; }
    setIsSyncing(true); await processSyncQueue(); setIsSyncing(false);
  };

  const handleDelete = (id: string) => Alert.alert('Delete', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteStudent(id); await purgeLocalStudent(id); dispatch(removeStudent(id)); } }
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Students</Text>
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
      <FlatList data={students} keyExtractor={(item: any) => item.id} contentContainerStyle={{ padding: 16 }} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); navigation.navigate('QuranView'); }} onLongPress={() => handleDelete(item.id)} activeOpacity={0.7}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentHint}>Tap to open  ·  Long-press to delete</Text>
        </TouchableOpacity>
      )} />
      <TouchableOpacity style={styles.fab} onPress={() => setModal(true)} activeOpacity={0.8}><Text style={styles.fabText}>+</Text></TouchableOpacity>
      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Student</Text>
            <TextInput style={styles.input} placeholder="Student name" placeholderTextColor="#666" onChangeText={setName} autoFocus />
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1e1e1e', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  syncBtn: { color: '#00d4aa', marginLeft: 12, fontSize: 13, fontWeight: '600' },
  logout: { color: '#ff4444', marginLeft: 12, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#1a1a2e', padding: 18, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a4a' },
  studentName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  studentHint: { fontSize: 11, color: '#666', marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#00d4aa', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { color: '#121212', fontSize: 28, fontWeight: '700', lineHeight: 30 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { width: '82%', backgroundColor: '#1e1e1e', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#fff' },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 12, color: '#fff', backgroundColor: '#121212', fontSize: 15 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, marginRight: 6 },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#00d4aa', borderRadius: 8, marginLeft: 6 },
  saveText: { color: '#121212', fontWeight: '700' }
});
