import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS, SPACING, scaleFont } from '../../utils/theme';
export default function SyncStatus() {
  const { status, pendingChanges } = useSelector((state: any) => state.sync);
  let color = COLORS.textMuted, text = 'Idle';
  if (status === 'syncing') { color = COLORS.accent; text = 'Syncing...'; }
  else if (status === 'offline') { color = COLORS.red; text = `Offline (${pendingChanges})`; }
  else if (status === 'synced') { color = COLORS.green; text = 'Synced'; }
  return <View style={styles.row}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.text}>{text}</Text></View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs }, dot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.sm }, text: { fontSize: scaleFont(12), color: COLORS.textSecondary } });
