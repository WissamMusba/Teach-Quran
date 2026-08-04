/**
 * FILE: src/components/common/SyncStatus.tsx
 * ROLE: Inline dot + text sync state badge for the Dashboard header row (local-only indicator; never triggers sync itself).
 * DEPENDS ON: Redux sync slice — `state.sync.status` ('idle'|'syncing'|'synced'|'offline') and `state.sync.pendingChanges`.
 * USED BY: src/screens/DashboardScreen.tsx:10,76 — right side of the header, next to the manual Sync button.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';

/**
 * SyncStatus() — maps the sync status to a colored dot + label.
 * WHAT: 'syncing' -> blue 'Syncing...'; 'offline' -> red `Offline (${pendingChanges})`; 'synced' -> green 'Synced'; otherwise grey 'Idle'.
 * FLOW: Picks color/text from state.sync.status, then renders dot + label; offline shows the pending-change count.
 * CALLS: none (rendering only).
 * CALLED BY: DashboardScreen.tsx:76.
 * AFFECTS: Rendering only (reads state.sync). The manual sync that mutates this state lives in
 *          DashboardScreen.tsx:42-47 (handleManualSync -> setSyncing/setSynced/setOffline).
 */
export default function SyncStatus() {
  const { status, pendingChanges } = useSelector((state: any) => state.sync);
  let color = '#888', text = 'Idle';
  if (status === 'syncing') { color = '#0066FF'; text = 'Syncing...'; }
  else if (status === 'offline') { color = '#FF0000'; text = `Offline (${pendingChanges})`; }
  else if (status === 'synced') { color = '#00CC00'; text = 'Synced'; }
  return <View style={styles.row}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.text}>{text}</Text></View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' }, dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 }, text: { fontSize: 12, color: '#555' } });