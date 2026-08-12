/**
 * FILE: src/components/sync/SyncIndicator.tsx
 * ROLE: Transient floating "toast" (absolute, bottom:60) announcing syncing / success / failure; fades in and out via Animated.
 * DEPENDS ON: Redux sync slice — `state.sync.status` ('idle'|'syncing'|'synced'|'offline') and `state.sync.pendingChanges`.
 * USED BY: src/screens/DashboardScreen.tsx:11,114 — overlay on the student list screen.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSelector } from 'react-redux';

/**
 * SyncIndicator() — transient pill toast mirroring the sync slice (same state as SyncStatus, different wording).
 * WHAT: Shows a pill on status==='syncing' (fade in 200ms); fades out (400ms) once status becomes 'synced' or 'offline'.
 * FLOW: 1) 'syncing' -> visible + fade to 1. 2) 'synced'/'offline' -> fade to 0 then setVisible(false). 3) Returns null when not visible.
 * CALLS: none (rendering only).
 * CALLED BY: DashboardScreen.tsx:114.
 * AFFECTS: Rendering only (reads state.sync).
 * NOTES: Text differs from SyncStatus ('Sync failed' vs 'Offline (N)'). Fades use `useNativeDriver: true`
 *        (opacity only — a legitimate native-driver use, unlike AnimatedHeader).
 */
const SyncIndicator = () => {
  const { status, pendingChanges } = useSelector((s: any) => s.sync);
  const [visible, setVisible] = useState(false);
  const [fade] = useState(new Animated.Value(0));

  useEffect(() => {
    if (status === 'syncing') {
      setVisible(true);
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (status === 'synced' || status === 'offline') {
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setVisible(false);
      });
    }
  }, [status]);

  if (!visible) return null;

  return (
    <Animated.View style={[s.wrap, { opacity: fade }]}>
      <Text style={s.text}>
        {status === 'syncing' ? 'Syncing...' : status === 'offline' ? 'Sync failed' : 'Synced \u2713'}
      </Text>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, zIndex: 999,
  },
  text: { color: '#1A1A1A', fontSize: 13, fontWeight: '600' },
});

export default SyncIndicator;
