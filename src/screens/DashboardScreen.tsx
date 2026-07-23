import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { getStudents, createStudent, deleteStudent } from '../api/student';
import { setStudents, addStudent, removeStudent, setCurrentStudent } from '../store/studentSlice';
import { logoutUser } from '../api/auth';
import { logout } from '../store/authSlice';
import { setSurah } from '../store/quranSlice';
import SyncStatus from '../components/common/SyncStatus';
import { purgeLocalStudent, processSyncQueue } from '../database/localDB';

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
    { text: 'Cancel' }, 
    { text: 'Delete', onPress: async () => { 
        await deleteStudent(id); 
        await purgeLocalStudent(id); 
        dispatch(removeStudent(id)); 
      } 
    }
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Students</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SyncStatus />
          <TouchableOpacity onPress={handleManualSync} disabled={isSyncing || pendingChanges === 0}>
            <Text style={[styles.logout, (isSyncing || pendingChanges === 0) && { color: '#555' }]}>{isSyncing ? 'Syncing...' : `Sync (${pendingChanges})`}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { 
            await logoutUser(); 
            dispatch(logout()); 
            navigation.replace('Login');
          }}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList data={students} keyExtractor={(item: any) => item.id} contentContainerStyle={{ padding: 15 }} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => { 
            dispatch(setCurrentStudent(item)); 
            dispatch(setSurah({ surahId: 1, verses: [] })); // ⚠️ FIX: Reset to Surah 1 for new student
            navigation.navigate('QuranView'); 
        }} onLongPress={() => handleDelete(item.id)}>
          <Text style={styles.name}>{item.name}</Text>
        </TouchableOpacity>
      )} />
      <TouchableOpacity style={styles.fab} onPress={() => setModal(true)}><Text style={styles.fabText}>+ Add Student</Text></TouchableOpacity>
      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.modalView}><View style={styles.modalContent}><Text style={styles.modalTitle}>Add Student</Text><TextInput style={styles.input} placeholder="Name" onChangeText={setName} /><View style={{ flexDirection: 'row' }}><TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}><Text>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.btnText}>Save</Text></TouchableOpacity></View></View></View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#121212' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#1e1e1e', borderBottomWidth: 1, borderBottomColor: '#333' }, title: { fontSize: 24, fontWeight: 'bold', color: '#fff' }, logout: { color: '#FF0000', marginLeft: 15 }, card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 10, marginBottom: 10 }, name: { fontSize: 20, fontWeight: 'bold', color: '#fff' }, fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#0066FF', padding: 15, borderRadius: 30 }, fabText: { color: '#fff', fontWeight: 'bold' }, modalView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }, modalContent: { width: '80%', backgroundColor: '#1e1e1e', padding: 20, borderRadius: 10 }, modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#fff' }, input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10, marginBottom: 15, color: '#fff', backgroundColor: '#121212' }, cancelBtn: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, marginRight: 5 }, saveBtn: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#0066FF', borderRadius: 8, marginLeft: 5 }, btnText: { color: '#fff', fontWeight: 'bold' } });