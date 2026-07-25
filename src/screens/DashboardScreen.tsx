import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { getStudents, createStudent, deleteStudent } from '../api/student';
import { setStudents, addStudent, removeStudent, setCurrentStudent } from '../store/studentSlice';
import { logoutUser } from '../api/auth';
import { logout } from '../store/authSlice';
import { setSurah } from '../store/quranSlice';
import SyncStatus from '../components/common/SyncStatus';
import { purgeLocalStudent, cacheStudentList } from '../database/localDB';
import { processSyncQueue } from '../api/sync';
import { COLORS, SPACING, RADIUS, scaleFont, SHADOWS } from '../utils/theme';
export default function DashboardScreen({ navigation }: any) {
  const [modal, setModal] = useState(false); const [name, setName] = useState(''); const [isSyncing, setIsSyncing] = useState(false); const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();
  const students = useSelector((s: any) => s.student.list);
  const pendingChanges = useSelector((s: any) => s.sync.pendingChanges);
  useEffect(() => { getStudents().then(res => { if (res.success) dispatch(setStudents(res.students)); }).finally(() => setIsLoading(false)); }, []);
  const handleCreate = async () => { if (!name.trim()) { Alert.alert('Error', 'Please enter a student name.'); return; } const res = await createStudent(name.trim()); if (res.success) { const item = { id: res.studentId!, name: name.trim() }; dispatch(addStudent(item)); await cacheStudentList([...students, item]); setModal(false); setName(''); } };
  const handleManualSync = async () => { if (pendingChanges === 0) { Alert.alert('Up to Date', 'Nothing to sync.'); return; } setIsSyncing(true); await processSyncQueue(); setIsSyncing(false); };
  const handleDelete = (id: string) => Alert.alert('Delete Student', 'Are you sure? This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteStudent(id); await purgeLocalStudent(id); dispatch(removeStudent(id)); await cacheStudentList(students.filter((s: any) => s.id !== id)); } }]);
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View><Text style={styles.title}>Students</Text><Text style={styles.subtitle}>{students.length} student{students.length !== 1 ? 's' : ''}</Text></View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleManualSync} style={styles.syncBtn} activeOpacity={0.7}><Text style={styles.syncText}>{isSyncing ? '⏳' : '🔄'} {pendingChanges}</Text></TouchableOpacity>
          <TouchableOpacity onPress={async () => { await logoutUser(); dispatch(logout()); navigation.replace('Login'); }} style={styles.logoutBtn} activeOpacity={0.7}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
        </View>
      </View>
      <SyncStatus />
      {isLoading ? (<View style={styles.loadingState}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.loadingText}>Loading students…</Text></View>)
        : students.length === 0 ? (<View style={styles.emptyState}><Text style={styles.emptyIcon}>👨‍🏫</Text><Text style={styles.emptyText}>No students yet</Text><Text style={styles.emptySubtext}>Tap + to add your first student</Text></View>)
        : (<FlatList data={students} keyExtractor={(item: any) => item.id} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
            renderItem={({ item, index }: any) => (<Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
              <TouchableOpacity style={[styles.card, SHADOWS.sm]} onPress={() => { dispatch(setCurrentStudent(item)); dispatch(setSurah({ surahId: 1, verses: [] })); navigation.navigate('QuranView'); }} onLongPress={() => handleDelete(item.id)} activeOpacity={0.7}>
                <View style={styles.cardAvatar}><Text style={styles.cardAvatarText}>{item.name.charAt(0).toUpperCase()}</Text></View>
                <View style={styles.cardInfo}><Text style={styles.cardName}>{item.name}</Text><Text style={styles.cardHint}>Tap to open • Long press to delete</Text></View>
                <Text style={styles.cardArrow}>›</Text>
              </TouchableOpacity></Animated.View>)} />)}
      <TouchableOpacity style={[styles.fab, SHADOWS.lg]} onPress={() => setModal(true)} activeOpacity={0.8}><Text style={styles.fabText}>+</Text></TouchableOpacity>
      <Modal visible={modal} transparent animationType="fade">
        <View style={styles.modalView}><Animated.View entering={FadeIn.duration(200)} style={[styles.modalContent, SHADOWS.lg]}>
          <Text style={styles.modalTitle}>Add Student</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Student name" placeholderTextColor={COLORS.textMuted} autoFocus />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModal(false); setName(''); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveText}>Add</Text></TouchableOpacity>
          </View>
        </Animated.View></View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, backgroundColor: COLORS.bgCard, borderBottomWidth: 1, borderBottomColor: COLORS.borderDark },
  title: { fontSize: scaleFont(26), fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: scaleFont(13), color: COLORS.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  syncBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.08)' },
  syncText: { color: COLORS.textSecondary, fontSize: scaleFont(14) },
  logoutBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,68,68,0.15)' },
  logoutText: { color: COLORS.red, fontSize: scaleFont(14), fontWeight: '600' },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.md, fontSize: scaleFont(15) },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.lg },
  emptyText: { color: COLORS.textSecondary, fontSize: scaleFont(18), fontWeight: '600' },
  emptySubtext: { color: COLORS.textMuted, fontSize: scaleFont(14), marginTop: SPACING.xs },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, padding: SPACING.xl, borderRadius: RADIUS.lg, marginBottom: SPACING.md },
  cardAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.lg },
  cardAvatarText: { color: COLORS.bgDark, fontSize: scaleFont(20), fontWeight: '800' },
  cardInfo: { flex: 1 }, cardName: { fontSize: scaleFont(18), fontWeight: '700', color: COLORS.textPrimary },
  cardHint: { fontSize: scaleFont(12), color: COLORS.textMuted, marginTop: 3 },
  cardArrow: { fontSize: scaleFont(24), color: COLORS.textMuted, marginLeft: SPACING.sm },
  fab: { position: 'absolute', bottom: SPACING.xxl, right: SPACING.xxl, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  fabText: { color: '#fff', fontSize: scaleFont(30), fontWeight: '300', marginTop: -2 },
  modalView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.overlay, padding: SPACING.xxl },
  modalContent: { width: '100%', maxWidth: 360, backgroundColor: COLORS.bgCard, padding: SPACING.xxl, borderRadius: RADIUS.lg },
  modalTitle: { fontSize: scaleFont(20), fontWeight: '700', marginBottom: SPACING.xl, color: COLORS.textPrimary },
  input: { borderWidth: 1, borderColor: COLORS.borderDark, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xl, color: COLORS.textPrimary, backgroundColor: COLORS.bgInput, fontSize: scaleFont(16) },
  modalActions: { flexDirection: 'row', gap: SPACING.md },
  cancelBtn: { flex: 1, padding: SPACING.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.md },
  cancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 1, padding: SPACING.md, alignItems: 'center', backgroundColor: COLORS.accent, borderRadius: RADIUS.md },
  saveText: { color: '#fff', fontWeight: '700' },
});
