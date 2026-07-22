import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
export default function SyncStatus() {
  const { status, pendingChanges } = useSelector((state: any) => state.sync);
  let color = '#888', text = 'Idle';
  if (status === 'syncing') { color = '#0066FF'; text = 'Syncing...'; }
  else if (status === 'offline') { color = '#FF0000'; text = `Offline (${pendingChanges})`; }
  else if (status === 'synced') { color = '#00CC00'; text = 'Synced'; }
  return <View style={styles.row}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.text}>{text}</Text></View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' }, dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 }, text: { fontSize: 12, color: '#555' } });