import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import VoiceNotePlayer from '../components/audio/VoiceNotePlayer';
import { COLORS, SPACING, RADIUS, scaleFont, SHADOWS } from '../utils/theme';
export default function NotesScreen() {
  const navigation = useNavigation<any>();
  const studentData = useSelector((s: any) => s.student.studentData);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const allNotes = studentData?.notes ? Object.entries(studentData.notes).filter(([, v]) => v) : [];
  const handleNavigate = (vKey: string) => { const cleanKey = vKey.replace('audio:', ''); const [s, v] = cleanKey.split('_').map(Number); if (s && v) navigation.navigate('QuranView', { surahId: s, scrollToVerse: v }); };
  const parseVoice = (value: string) => { const p = value.split('|'); return { path: p[1] || '', duration: parseInt(p[2]) || 0 }; };
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.title}>📝 Notes</Text>
      {allNotes.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyIcon}>📝</Text><Text style={styles.emptyText}>No notes yet</Text><Text style={styles.emptySubtext}>Long-press a verse to add notes</Text></View>
      ) : (
        <FlatList data={allNotes} keyExtractor={([k]) => k} initialNumToRender={20} maxToRenderPerBatch={20} windowSize={10} removeClippedSubviews contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl }}
          renderItem={({ item }: any) => { const [key, value] = item; const isVoice = key.startsWith('audio:') || (value as string).startsWith('voice|'); const cleanKey = key.replace('audio:', ''); const [s, v] = cleanKey.split('_').map(Number); return (
            <TouchableOpacity style={[styles.card, SHADOWS.sm]} onPress={() => handleNavigate(key)} activeOpacity={0.7}>
              <Text style={styles.headerText}>Surat {surahNames[s] || '...'} ({s}:{v})</Text>
              {isVoice ? (<VoiceNotePlayer uri={parseVoice(value as string).path} label={`Voice Note — ${s}:${v}`} />) : (<Text style={styles.noteText}>{value as string}</Text>)}
            </TouchableOpacity>
          ); }} />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  title: { fontSize: scaleFont(24), fontWeight: '800', color: COLORS.textPrimary, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.sm },
  card: { backgroundColor: COLORS.bgCard, padding: SPACING.xl, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  headerText: { color: COLORS.primary, fontSize: scaleFont(14), fontWeight: '700', marginBottom: SPACING.sm },
  noteText: { color: COLORS.textPrimary, fontSize: scaleFont(15), lineHeight: 24 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.lg },
  emptyText: { color: COLORS.textSecondary, fontSize: scaleFont(17), fontWeight: '600' },
  emptySubtext: { color: COLORS.textMuted, fontSize: scaleFont(13), marginTop: SPACING.xs },
});
