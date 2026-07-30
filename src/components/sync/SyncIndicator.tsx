import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSelector } from 'react-redux';

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
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

export default SyncIndicator;
