import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { toggleTranslation, setFontSize, setReadingMode } from '../store/quranSlice';
import { RootState } from '../store';
export default function SettingsScreen() {
  const dispatch = useDispatch();
  const { showTranslation, fontSize, readingMode } = useSelector((state: RootState) => state.quran);
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Reading Settings</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Show Translation</Text>
        <Switch value={showTranslation} onValueChange={() => dispatch(toggleTranslation())} />
      </View>
      <Text style={styles.label}>Reading Mode</Text>
      <View style={styles.modeContainer}>
        {['ayah', 'continuous', 'page'].map((mode) => (
          <TouchableOpacity key={mode} style={[styles.modeBtn, readingMode === mode && styles.activeMode]} onPress={() => dispatch(setReadingMode(mode))}>
            <Text style={readingMode === mode ? styles.activeText : styles.inactiveText}>{mode === 'ayah' ? 'Ayah List' : mode === 'continuous' ? 'Continuous' : 'Page Swipe'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Arabic Font Size</Text>
      <View style={styles.sizeContainer}>
        {['small', 'medium', 'large', 'xl'].map((size) => (
          <TouchableOpacity key={size} style={[styles.sizeBtn, fontSize === size && styles.activeSize]} onPress={() => dispatch(setFontSize(size))}>
            <Text style={fontSize === size ? styles.activeText : styles.inactiveText}>{size.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#121212' }, header: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, color: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  label: { fontSize: 18, color: '#fff', marginBottom: 10 },
  modeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  modeBtn: { padding: 10, borderWidth: 1, borderColor: '#333', borderRadius: 8, width: '32%', alignItems: 'center' },
  activeMode: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  sizeContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  sizeBtn: { padding: 10, borderWidth: 1, borderColor: '#333', borderRadius: 8, width: '23%', alignItems: 'center' },
  activeSize: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  activeText: { color: '#fff', fontWeight: 'bold' }, inactiveText: { color: '#aaa' }
});